import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!token) {
      return NextResponse.json(
        { error: 'Требуется токен (ссылка)' },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findUnique({
      where: { portalToken: token },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Неверная ссылка' },
        { status: 401 }
      );
    }

    if (agent.portalPassword) {
      if (!password) {
        return NextResponse.json(
          { error: 'Требуется пароль' },
          { status: 400 }
        );
      }
      const valid = await bcrypt.compare(password, agent.portalPassword);
      if (!valid) {
        return NextResponse.json(
          { error: 'Неверный пароль' },
          { status: 401 }
        );
      }
    }

    const cookieStore = await cookies();
    cookieStore.set('agentPortal', agent.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      agentId: agent.id,
      redirectTo: '/agent-portal',
    });
  } catch (e) {
    console.error('Agent portal login error:', e);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
