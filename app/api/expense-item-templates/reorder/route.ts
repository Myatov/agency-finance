import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageProducts } from '@/lib/permissions';

export async function PUT(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await canManageProducts(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { templateIds } = body;

    if (!Array.isArray(templateIds)) {
      return NextResponse.json({ error: 'templateIds must be an array' }, { status: 400 });
    }

    // Update sortOrder for each template
    await Promise.all(
      templateIds.map((templateId: string, index: number) =>
        prisma.expenseItemTemplate.update({
          where: { id: templateId },
          data: { sortOrder: index },
        })
      )
    );

    const expenseItemTemplates = await prisma.expenseItemTemplate.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ expenseItemTemplates });
  } catch (error) {
    console.error('Error reordering expense item templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
