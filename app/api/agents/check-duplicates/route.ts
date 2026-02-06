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
    const phone = opt(body.phone);
    const telegram = opt(body.telegram);
    const description = opt(body.description);
    const excludeAgentId = body.excludeAgentId != null && String(body.excludeAgentId).trim() !== '' ? String(body.excludeAgentId).trim() : null;

    if (!phone && !telegram && !description) {
      return NextResponse.json({ duplicates: [] });
    }

    const orConditions: Array<Record<string, unknown>> = [];
    if (phone) orConditions.push({ phone: { equals: phone, mode: 'insensitive' } });
    if (telegram) orConditions.push({ telegram: { equals: telegram, mode: 'insensitive' } });
    if (description) orConditions.push({ description: { equals: description, mode: 'insensitive' } });

    const where: Record<string, unknown> = {
      OR: orConditions,
    };
    if (excludeAgentId) {
      where.id = { not: excludeAgentId };
    }

    const duplicates = await prisma.agent.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error('Error checking agent duplicates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
