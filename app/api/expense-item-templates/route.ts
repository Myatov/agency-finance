import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageProducts, hasPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canViewProducts = await hasPermission(user, 'products', 'view');
    const canViewServices = await hasPermission(user, 'services', 'view');
    const canCreateServices = await hasPermission(user, 'services', 'create');
    const canAccess = canViewProducts || canViewServices || canCreateServices;
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const expenseItemTemplates = await prisma.expenseItemTemplate.findMany({
      include: {
        department: { select: { id: true, name: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ expenseItemTemplates });
  } catch (error) {
    console.error('Error fetching expense item templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await canManageProducts(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, departmentId } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get max sortOrder and add 1 for new template
    const maxOrder = await prisma.expenseItemTemplate.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const expenseItemTemplate = await prisma.expenseItemTemplate.create({
      data: {
        name,
        departmentId: departmentId || null,
        sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ expenseItemTemplate });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Expense item template already exists' }, { status: 400 });
    }
    console.error('Error creating expense item template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
