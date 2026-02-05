import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCostItems } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let categories: Array<{ id: string; name: string; sortOrder: number }>;
    try {
      categories = await prisma.costCategory.findMany({
        orderBy: { sortOrder: 'asc' },
      });
    } catch (prismaError: unknown) {
      const errMsg = prismaError instanceof Error ? prismaError.message : String(prismaError);
      if (!/costCategory|CostCategory|Unknown|does not exist/.test(errMsg)) throw prismaError;
      console.warn('Using raw SQL fallback for cost categories:', errMsg);
      const rows = await prisma.$queryRaw<Array<{ id: string; name: string; sortOrder: number }>>`
        SELECT id, name, "sortOrder" FROM "CostCategory" ORDER BY "sortOrder" ASC
      `;
      categories = rows;
    }
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching cost categories:', error);
    const errorDetails = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorDetails },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await canManageCostItems(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const { name } = body;
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const maxOrder = await prisma.costCategory.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const category = await prisma.costCategory.create({
      data: { name: name.trim(), sortOrder: (maxOrder?.sortOrder ?? -1) + 1 },
    });
    return NextResponse.json(category);
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Категория с таким названием уже есть' }, { status: 400 });
    }
    console.error('Error creating cost category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
