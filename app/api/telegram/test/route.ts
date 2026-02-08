import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  sendTelegramMessage,
  getExpensesChatId,
  getPersonalChatId,
} from '@/lib/telegram';

/**
 * GET /api/telegram/test — отправить тестовое сообщение в оба чата.
 * Нужна авторизация. Результат покажет, доходят ли сообщения и какие ошибки от Telegram.
 */
export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) {
      return NextResponse.json({
        ok: false,
        error: 'TELEGRAM_BOT_TOKEN не задан в .env',
        groupId: getExpensesChatId(),
        personalId: getPersonalChatId(),
      });
    }

    const groupId = getExpensesChatId();
    const personalId = getPersonalChatId();
    const text = `[Тест] Уведомления расхода работают. ${new Date().toLocaleString('ru-RU')}`;

    const results: { chat: string; chatId: string | null; ok: boolean }[] = [];

    if (groupId) {
      const ok = await sendTelegramMessage(groupId, text);
      results.push({ chat: 'group', chatId: groupId, ok });
    } else {
      results.push({ chat: 'group', chatId: null, ok: false });
    }

    if (personalId) {
      const ok = await sendTelegramMessage(personalId, text);
      results.push({ chat: 'personal', chatId: personalId, ok });
    } else {
      results.push({ chat: 'personal', chatId: null, ok: false });
    }

    return NextResponse.json({
      ok: results.every((r) => r.ok),
      tokenSet: true,
      results,
      hint: 'Смотри логи сервера (pm2 logs) — там текст ошибки от Telegram, если ok: false.',
    });
  } catch (e) {
    console.error('[Telegram] test error:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
