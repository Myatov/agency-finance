import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCostItems } from '@/lib/permissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await canManageCostItems(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    const { name } = body;
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const type = await prisma.financialModelExpenseType.update({
      where: { id: params.id },
      data: { name: name.trim() },
    });
    return NextResponse.json(type);
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (e.code === 'P2002') return NextResponse.json({ error: 'Вид с таким названием уже есть' }, { status: 400 });
    console.error('Error updating financial model expense type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await canManageCostItems(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const count = await prisma.costItem.count({ where: { financialModelExpenseTypeId: params.id } });
    if (count > 0) {
      return NextResponse.json(
        { error: 'Нельзя удалить вид: есть статьи расходов с этим видом' },
        { status: 400 }
      );
    }
    await prisma.financialModelExpenseType.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    console.error('Error deleting financial model expense type:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
