import { NextRequest, NextResponse } from 'next/server';
import { loginClientPortal, setClientPortalSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token =
      typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Требуются ссылка (токен) и пароль' },
        { status: 400 }
      );
    }

    const result = await loginClientPortal(token, password);

    if (!result) {
      return NextResponse.json(
        { error: 'Неверная ссылка или пароль' },
        { status: 401 }
      );
    }

    await setClientPortalSession(result.clientId);

    return NextResponse.json({
      success: true,
      clientId: result.clientId,
      redirectTo: '/cabinet',
    });
  } catch (e) {
    console.error('Client portal login error:', e);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
