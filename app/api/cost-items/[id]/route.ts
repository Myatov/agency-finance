import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCostItems } from '@/lib/permissions';
import { CostCategory } from '@prisma/client';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await canManageCostItems(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = params.id;
    const body = await request.json();
    const { category, title } = body;

    if (!category || !title) {
      return NextResponse.json(
        { error: 'Category and title are required' },
        { status: 400 }
      );
    }

    const costItem = await prisma.costItem.update({
      where: { id },
      data: {
        category: category as CostCategory,
        title,
      },
    });

    return NextResponse.json(costItem);
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Cost item not found' }, { status: 404 });
    }
    console.error('Error updating cost item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await canManageCostItems(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = params.id;

    const expenseCount = await prisma.expense.count({
      where: { costItemId: id },
    });

    if (expenseCount > 0) {
      return NextResponse.json(
        { error: 'Нельзя удалить статью расходов: она используется в расходах' },
        { status: 400 }
      );
    }

    await prisma.costItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Cost item not found' }, { status: 404 });
    }
    console.error('Error deleting cost item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
