import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCostItems } from '@/lib/permissions';
import { CostCategory } from '@prisma/client';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const costItems = await prisma.costItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { category: 'asc' }, { title: 'asc' }],
    });

    return NextResponse.json({ costItems });
  } catch (error) {
    console.error('Error fetching cost items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    const { category, title } = body;

    if (!category || !title) {
      return NextResponse.json(
        { error: 'Category and title are required' },
        { status: 400 }
      );
    }

    const maxOrder = await prisma.costItem.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const costItem = await prisma.costItem.create({
      data: {
        category: category as CostCategory,
        title,
        sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ costItem });
  } catch (error) {
    console.error('Error creating cost item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
