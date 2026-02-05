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
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ costItems });
  } catch (error) {
    console.error('Error reordering cost items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
