import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCostItems } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const costItems = await prisma.costItem.findMany({
      include: {
        costCategory: true,
        financialModelExpenseType: true,
      },
    });

    // Фильтруем записи с отсутствующими связями (на случай проблем после миграции)
    const validItems = costItems.filter(
      (item) => item.costCategory && item.financialModelExpenseType
    );

    // Логируем проблемные записи
    const invalidItems = costItems.filter(
      (item) => !item.costCategory || !item.financialModelExpenseType
    );
    if (invalidItems.length > 0) {
      console.warn(`Found ${invalidItems.length} cost items with missing relations:`, invalidItems.map((i) => ({ id: i.id, costCategoryId: i.costCategoryId, financialModelExpenseTypeId: i.financialModelExpenseTypeId })));
    }

    // Сортируем в коде для устойчивости
    validItems.sort((a, b) => {
      const catOrderA = a.costCategory?.sortOrder ?? 999;
      const catOrderB = b.costCategory?.sortOrder ?? 999;
      if (catOrderA !== catOrderB) return catOrderA - catOrderB;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({ costItems: validItems });
  } catch (error) {
    console.error('Error fetching cost items:', error);
    const errorDetails = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error stack:', errorStack);
    
    // Проверяем, является ли ошибка связанной с отсутствием модели Prisma
    if (errorDetails.includes('costCategory') || errorDetails.includes('CostCategory') || 
        errorDetails.includes('financialModelExpenseType') || errorDetails.includes('FinancialModelExpenseType') ||
        errorDetails.includes('Unknown arg') || errorDetails.includes('does not exist')) {
      return NextResponse.json(
        { 
          error: 'Database schema error: Prisma Client не содержит новые модели. На сервере необходимо выполнить: npm run db:generate и перезапустить приложение.',
          details: errorDetails,
          solution: 'Выполните на сервере: npm run db:generate && pm2 restart app (или перезапустите приложение другим способом)'
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorDetails },
      { status: 500 }
    );
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
    const { costCategoryId, title, financialModelExpenseTypeId } = body;

    if (!costCategoryId || !title || !financialModelExpenseTypeId) {
      return NextResponse.json(
        { error: 'costCategoryId, title and financialModelExpenseTypeId are required' },
        { status: 400 }
      );
    }

    const maxOrder = await prisma.costItem.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const costItem = await prisma.costItem.create({
      data: {
        costCategoryId,
        title: title.trim(),
        financialModelExpenseTypeId,
        sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      },
      include: {
        costCategory: true,
        financialModelExpenseType: true,
      },
    });

    return NextResponse.json({ costItem });
  } catch (error) {
    console.error('Error creating cost item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
