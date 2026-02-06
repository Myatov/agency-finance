import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const opt = (v: unknown) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);
    const phone1 = opt(body.phone1);
    const phone2 = opt(body.phone2);
    const telegram = opt(body.telegram);
    const whatsapp = opt(body.whatsapp);
    const excludeContactId = body.excludeContactId != null && String(body.excludeContactId).trim() !== '' ? String(body.excludeContactId).trim() : null;

    if (!phone1 && !phone2 && !telegram && !whatsapp) {
      return NextResponse.json({ duplicates: [] });
    }

    const orConditions: Array<Record<string, unknown>> = [];
    if (phone1) orConditions.push({ phone1: { equals: phone1, mode: 'insensitive' } });
    if (phone2) orConditions.push({ phone2: { equals: phone2, mode: 'insensitive' } });
    if (telegram) orConditions.push({ telegram: { equals: telegram, mode: 'insensitive' } });
    if (whatsapp) orConditions.push({ whatsapp: { equals: whatsapp, mode: 'insensitive' } });

    const where: Record<string, unknown> = {
      OR: orConditions,
    };
    if (excludeContactId) {
      where.id = { not: excludeContactId };
    }

    const duplicates = await prisma.contact.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
