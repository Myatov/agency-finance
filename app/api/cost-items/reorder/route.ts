import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCostItems } from '@/lib/permissions';

export async function PUT(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await canManageCostItems(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { costItemIds } = body;

    if (!Array.isArray(costItemIds)) {
      return NextResponse.json(
        { error: 'costItemIds must be an array' },
        { status: 400 }
      );
    }

    await Promise.all(
      costItemIds.map((costItemId: string, index: number) =>
        prisma.costItem.update({
          where: { id: costItemId },
          data: { sortOrder: index },
        })
      )
    );

    const costItems = await prisma.costItem.findMany({
      include: {
        costCategory: true,
        financialModelExpenseType: true,
      },
    });

    // Сортируем в коде (как в GET route)
    costItems.sort((a, b) => {
      const catOrderA = a.costCategory?.sortOrder ?? 999;
      const catOrderB = b.costCategory?.sortOrder ?? 999;
      if (catOrderA !== catOrderB) return catOrderA - catOrderB;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({ costItems });
  } catch (error) {
    console.error('Error reordering cost items:', error);
    const errorDetails = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorDetails },
      { status: 500 }
    );
  }
}
