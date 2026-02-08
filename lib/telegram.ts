/**
 * Отправка сообщений в Telegram через Bot API.
 * Токен бота: TELEGRAM_BOT_TOKEN. Чат расходов: TELEGRAM_EXPENSES_CHAT_ID.
 */

const TELEGRAM_API = 'https://api.telegram.org';

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token?.trim()) {
    console.warn('Telegram: TELEGRAM_BOT_TOKEN не задан, уведомление не отправлено');
    return false;
  }
  try {
    const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Telegram sendMessage error:', res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Telegram sendMessage exception:', e);
    return false;
  }
}

/** Chat ID группы «Расходы» для уведомлений о расходах. */
export function getExpensesChatId(): string | null {
  return process.env.TELEGRAM_EXPENSES_CHAT_ID?.trim() || null;
}

/** Данные расхода для форматирования уведомления (поля из prisma include). */
export type ExpenseNotifyPayload = {
  amount: bigint | string;
  paymentAt: Date;
  creator?: { fullName: string } | null;
  updater?: { fullName: string } | null;
  site?: { title: string; client?: { name: string | null } | null } | null;
  service?: { product?: { name: string } | null } | null;
};

function toRubles(amount: bigint | string): string {
  const n = typeof amount === 'bigint' ? Number(amount) : parseFloat(String(amount));
  return (n / 100).toFixed(2);
}

function toDateStr(d: Date): string {
  return new Date(d).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function dash(s: string | null | undefined): string {
  return s != null && String(s).trim() !== '' ? String(s).trim() : '—';
}

/**
 * Формирует текст уведомления об расходе: заголовок (Внесение/Корректировка) и строка
 * Дата - Клиент - Проект - Услуга - Период - Сумма.
 */
export function formatExpenseNotification(
  payload: ExpenseNotifyPayload,
  isCorrection: boolean
): string {
  const userName = isCorrection
    ? dash(payload.updater?.fullName)
    : dash(payload.creator?.fullName);
  const header = isCorrection
    ? `Корректировка расхода от ${userName}`
    : `Внесение расхода от ${userName}`;
  const date = toDateStr(payload.paymentAt);
  const client = dash(payload.site?.client?.name);
  const project = dash(payload.site?.title);
  const service = dash(payload.service?.product?.name);
  const period = '—'; // в модели Expense нет периода
  const sum = toRubles(payload.amount);
  const line = `${date} - ${client} - ${project} - ${service} - ${period} - ${sum}`;
  return `${header}\n${line}`;
}

/**
 * Отправляет в группу «Расходы» уведомление о создании или изменении расхода.
 * Ничего не делает, если TELEGRAM_EXPENSES_CHAT_ID не задан.
 */
export async function notifyExpense(
  payload: ExpenseNotifyPayload,
  isCorrection: boolean
): Promise<boolean> {
  const chatId = getExpensesChatId();
  if (!chatId) return false;
  const text = formatExpenseNotification(payload, isCorrection);
  return sendTelegramMessage(chatId, text);
}
