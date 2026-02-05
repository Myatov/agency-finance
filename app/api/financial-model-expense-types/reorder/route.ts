import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCostItems } from '@/lib/permissions';

export async function PUT(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await canManageCostItems(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    const { typeIds } = body;
    if (!Array.isArray(typeIds)) {
      return NextResponse.json({ error: 'typeIds must be an array' }, { status: 400 });
    }
    await Promise.all(
      typeIds.map((id: string, index: number) =>
        prisma.financialModelExpenseType.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );
    const types = await prisma.financialModelExpenseType.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json({ types });
  } catch (error) {
    console.error('Error reordering financial model expense types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
