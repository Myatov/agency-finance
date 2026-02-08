import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditClient } from '@/lib/permissions';
import { getPublicOrigin } from '@/lib/utils';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function generateToken(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await canEditClient(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id: clientId } = await params;
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const access = await prisma.clientPortalAccess.findUnique({
      where: { clientId },
      select: { accessToken: true, createdAt: true, createdBy: { select: { fullName: true } } },
    });

    const baseUrl = getPublicOrigin(request) || request.nextUrl.origin;
    const portalLink = access
      ? `${baseUrl}/cabinet/enter/${access.accessToken}`
      : null;

    return NextResponse.json({
      hasAccess: !!access,
      portalLink,
      accessToken: access?.accessToken ?? null,
      createdAt: access?.createdAt ?? null,
      createdBy: access?.createdBy?.fullName ?? null,
    });
  } catch (e) {
    console.error('GET clients/[id]/portal-access', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await canEditClient(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id: clientId } = await params;
    const body = await request.json();
    const password = typeof body.password === 'string' ? body.password.trim() : '';
    if (!password || password.length < 4) {
      return NextResponse.json(
        { error: 'Пароль обязателен (минимум 4 символа)' },
        { status: 400 }
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const passwordHash = await bcrypt.hash(password, 10);
    const baseUrl = getPublicOrigin(request) || request.nextUrl.origin;

    const existing = await prisma.clientPortalAccess.findUnique({
      where: { clientId },
    });

    let accessToken: string;
    if (existing) {
      await prisma.clientPortalAccess.update({
        where: { clientId },
        data: { passwordHash, updatedAt: new Date() },
      });
      accessToken = existing.accessToken;
    } else {
      accessToken = generateToken();
      await prisma.clientPortalAccess.create({
        data: {
          clientId,
          passwordHash,
          accessToken,
          createdByUserId: user.id,
        },
      });
    }

    const portalLink = `${baseUrl}/cabinet/enter/${accessToken}`;

    return NextResponse.json({
      success: true,
      portalLink,
      accessToken,
      message: existing ? 'Пароль обновлён' : 'Доступ создан',
    });
  } catch (e) {
    console.error('POST clients/[id]/portal-access', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
