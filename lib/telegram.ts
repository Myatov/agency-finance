/**
 * Отправка сообщений в Telegram через Bot API.
 * Токен: TELEGRAM_BOT_TOKEN. Группа расходов: TELEGRAM_EXPENSES_CHAT_ID. Личный чат: TELEGRAM_PERSONAL_CHAT_ID.
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
      console.error('Telegram sendMessage error:', res.status, chatId, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Telegram sendMessage exception:', chatId, e);
    return false;
  }
}

export function getExpensesChatId(): string | null {
  return process.env.TELEGRAM_EXPENSES_CHAT_ID?.trim() || null;
}

/** Личный чат для дублирования уведомлений о расходах (по умолчанию 135962813). */
export function getPersonalChatId(): string | null {
  const id = process.env.TELEGRAM_PERSONAL_CHAT_ID?.trim();
  if (id) return id;
  return '135962813'; // дублировать лично по умолчанию
}

/** Данные расхода для уведомления (поля из prisma include). */
export type ExpenseNotifyPayload = {
  amount: bigint | string;
  paymentAt: Date;
  comment?: string | null;
  creator?: { fullName: string } | null;
  updater?: { fullName: string } | null;
  costItem?: { title: string | null; costCategory?: { name: string } | null } | null;
  employee?: { fullName: string } | null;
  site?: { title: string; client?: { name: string | null } | null } | null;
  service?: { product?: { name: string } | null } | null;
  legalEntity?: { name: string } | null;
};

function toRubles(amount: bigint | string): string {
  const n = typeof amount === 'bigint' ? Number(amount) : parseFloat(String(amount));
  return (n / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function toDateStr(d: Date): string {
  return new Date(d).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function d(s: string | null | undefined): string {
  return s != null && String(s).trim() !== '' ? String(s).trim() : '—';
}

/**
 * Формирует лаконичное сообщение об расходе со всеми полями.
 */
export function formatExpenseNotification(
  payload: ExpenseNotifyPayload,
  isCorrection: boolean
): string {
  const who = isCorrection ? d(payload.updater?.fullName) : d(payload.creator?.fullName);
  const header = isCorrection ? `Корректировка расхода от ${who}` : `Внесение расхода от ${who}`;
  const date = toDateStr(payload.paymentAt);
  const sum = `${toRubles(payload.amount)} ₽`;
  const article = d(payload.costItem?.title ?? payload.costItem?.costCategory?.name);
  const client = d(payload.site?.client?.name);
  const project = d(payload.site?.title);
  const service = d(payload.service?.product?.name);
  const employee = d(payload.employee?.fullName);
  const legal = d(payload.legalEntity?.name);
  const comment = payload.comment != null && String(payload.comment).trim() !== '' ? String(payload.comment).trim() : null;

  const lines: string[] = [
    header,
    `${date} · ${sum} · Статья: ${article}`,
    `Клиент: ${client} · Проект: ${project} · Услуга: ${service}`,
    `Сотр.: ${employee} · Юрлицо: ${legal}`,
  ];
  if (comment) lines.push(`Комм.: ${comment}`);
  return lines.join('\n');
}

/**
 * Отправляет уведомление о расходе в группу «Расходы» и дублирует в личный чат.
 */
export async function notifyExpense(
  payload: ExpenseNotifyPayload,
  isCorrection: boolean
): Promise<void> {
  const text = formatExpenseNotification(payload, isCorrection);
  const groupId = getExpensesChatId();
  const personalId = getPersonalChatId();
  const promises: Promise<boolean>[] = [];
  if (groupId) promises.push(sendTelegramMessage(groupId, text));
  if (personalId) promises.push(sendTelegramMessage(personalId, text));
  await Promise.allSettled(promises);
}
