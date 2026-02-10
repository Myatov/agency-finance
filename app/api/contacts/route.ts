import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canView = await hasPermission(user, 'contacts', 'view');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';

    const where: Record<string, unknown> = {};
    if (q) {
      const pattern = `%${q}%`;
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone1: { contains: q, mode: 'insensitive' } },
        { phone2: { contains: q, mode: 'insensitive' } },
        { telegram: { contains: q, mode: 'insensitive' } },
        { whatsapp: { contains: q, mode: 'insensitive' } },
      ];
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { clientLinks: true } },
      },
    });

    return NextResponse.json({ contacts }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canCreate = await hasPermission(user, 'contacts', 'create');
    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const opt = (v: unknown) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);
    const name = body.name != null ? String(body.name).trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Имя обязательно' }, { status: 400 });
    }

    const phone1 = opt(body.phone1);
    const phone2 = opt(body.phone2);
    const telegram = opt(body.telegram);
    const whatsapp = opt(body.whatsapp);
    const position = opt(body.position);
    const note = opt(body.note);
    let birthDate: Date | null = null;
    if (body.birthDate) {
      const d = new Date(body.birthDate);
      if (!isNaN(d.getTime())) birthDate = d;
    }

    const contact = await prisma.contact.create({
      data: {
        name,
        phone1,
        phone2,
        birthDate,
        telegram,
        whatsapp,
        position,
        note,
      },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Error creating contact:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
