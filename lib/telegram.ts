/**
 * Отправка сообщений в Telegram через Bot API.
 * Токен: TELEGRAM_BOT_TOKEN. Группа расходов: TELEGRAM_EXPENSES_CHAT_ID. Личный чат: TELEGRAM_PERSONAL_CHAT_ID.
 */

const TELEGRAM_API = 'https://api.telegram.org';

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN не задан — уведомление не отправлено');
    return false;
  }
  try {
    const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        disable_web_page_preview: true,
      }),
    });
    const raw = await res.text();
    let data: { ok?: boolean; description?: string; error_code?: number };
    try {
      data = JSON.parse(raw) as { ok?: boolean; description?: string; error_code?: number };
    } catch {
      data = {};
    }
    if (!res.ok) {
      console.error('[Telegram] HTTP error', res.status, 'chat_id=', chatId, raw.slice(0, 300));
      return false;
    }
    if (data.ok === false) {
      console.error('[Telegram] API error chat_id=', chatId, ':', data.description || raw.slice(0, 200), 'code=', data.error_code);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Telegram] Exception chat_id=', chatId, e);
    return false;
  }
}

export function getExpensesChatId(): string | null {
  return process.env.TELEGRAM_EXPENSES_CHAT_ID?.trim() || null;
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
 * Отправляет уведомление о расходе только в группу «Расходы».
 */
export async function notifyExpense(
  payload: ExpenseNotifyPayload,
  isCorrection: boolean
): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    console.warn('[Telegram] notifyExpense: TELEGRAM_BOT_TOKEN не задан, пропуск');
    return;
  }
  const groupId = getExpensesChatId();
  if (!groupId) return;
  const text = formatExpenseNotification(payload, isCorrection);
  const ok = await sendTelegramMessage(groupId, text);
  if (!ok) {
    console.error('[Telegram] notifyExpense: не удалось отправить в группу', groupId);
  }
}

/**
 * Уведомление о новом клиенте в специальный чат.
 */
export async function notifyNewClient(client: {
  name: string;
  seller?: { fullName: string } | null;
  agent?: { name: string } | null;
}): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    console.warn('[Telegram] notifyNewClient: TELEGRAM_BOT_TOKEN не задан, пропуск');
    return;
  }
  const chatId = '-585982975';
  const lines: string[] = [
    'Новый клиент добавлен!',
    `Название: ${d(client.name)}`,
    `Продавец: ${d(client.seller?.fullName)}`,
  ];
  if (client.agent?.name) {
    lines.push(`Агент: ${client.agent.name}`);
  }
  const text = lines.join('\n');
  const ok = await sendTelegramMessage(chatId, text);
  if (!ok) {
    console.error('[Telegram] notifyNewClient: не удалось отправить в чат', chatId);
  }
}

/**
 * Одно уведомление о массовом формировании налоговых расходов (в группу «Расходы»).
 */
export async function notifyBulkTaxExpenses(
  createdCount: number,
  totalAmountRub: string,
  legalEntityName: string,
  creatorName: string
): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return;
  const groupId = getExpensesChatId();
  if (!groupId) return;
  const text = [
    'Массовое формирование расходов (налоги с доходов)',
    `Кто: ${creatorName}`,
    `Юрлицо: ${legalEntityName}`,
    `Создано расходов: ${createdCount}`,
    `Сумма всего: ${totalAmountRub} ₽`,
  ].join('\n');
  await sendTelegramMessage(groupId, text);
}
