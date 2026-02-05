import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCostItems } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const types = await prisma.financialModelExpenseType.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json({ types });
  } catch (error) {
    console.error('Error fetching financial model expense types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await canManageCostItems(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    const { name } = body;
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const maxOrder = await prisma.financialModelExpenseType.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const type = await prisma.financialModelExpenseType.create({
      data: { name: name.trim(), sortOrder: (maxOrder?.sortOrder ?? -1) + 1 },
    });
    return NextResponse.json(type);
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Вид с таким названием уже есть' }, { status: 400 });
    }
    console.error('Error creating financial model expense type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
