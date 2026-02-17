import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageProducts } from '@/lib/permissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await canManageProducts(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const expenseItemTemplate = await prisma.expenseItemTemplate.update({
      where: { id: params.id },
      data: { name },
    });

    return NextResponse.json({ expenseItemTemplate });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Expense item template already exists' }, { status: 400 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Expense item template not found' }, { status: 404 });
    }
    console.error('Error updating expense item template:', error);
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

    if (!(await canManageProducts(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if template is used in ProductExpenseItem
    const productUsage = await prisma.productExpenseItem.findFirst({
      where: { expenseItemTemplateId: params.id },
    });

    if (productUsage) {
      return NextResponse.json(
        { error: 'Cannot delete template that is used in products' },
        { status: 400 }
      );
    }

    // Check if template is used in ServiceExpenseItem
    const serviceUsage = await prisma.serviceExpenseItem.findFirst({
      where: { expenseItemTemplateId: params.id },
    });

    if (serviceUsage) {
      return NextResponse.json(
        { error: 'Cannot delete template that is used in services' },
        { status: 400 }
      );
    }

    await prisma.expenseItemTemplate.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Expense item template not found' }, { status: 404 });
    }
    console.error('Error deleting expense item template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
