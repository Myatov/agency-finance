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
    const { categoryIds } = body;
    if (!Array.isArray(categoryIds)) {
      return NextResponse.json({ error: 'categoryIds must be an array' }, { status: 400 });
    }
    await Promise.all(
      categoryIds.map((id: string, index: number) =>
        prisma.costCategory.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );
    const categories = await prisma.costCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error reordering cost categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
