import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendTelegramMessage, getExpensesChatId } from '@/lib/telegram';

/**
 * GET /api/telegram/test — отправить тестовое сообщение в группу «Расходы».
 * Нужна авторизация.
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
      });
    }

    const groupId = getExpensesChatId();
    if (!groupId) {
      return NextResponse.json({
        ok: false,
        error: 'TELEGRAM_EXPENSES_CHAT_ID не задан',
        tokenSet: true,
      });
    }

    const text = `[Тест] Уведомления расхода работают. ${new Date().toLocaleString('ru-RU')}`;
    const ok = await sendTelegramMessage(groupId, text);

    return NextResponse.json({
      ok,
      tokenSet: true,
      groupId,
      hint: ok ? 'Сообщение отправлено в группу.' : 'Смотри логи сервера (pm2 logs) — там ошибка от Telegram.',
    });
  } catch (e) {
    console.error('[Telegram] test error:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
