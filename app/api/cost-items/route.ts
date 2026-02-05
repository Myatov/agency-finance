import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCostItems } from '@/lib/permissions';

type CostItemWithRelations = {
  id: string;
  costCategoryId: string;
  title: string;
  sortOrder: number;
  financialModelExpenseTypeId: string;
  costCategory: { id: string; name: string; sortOrder: number } | null;
  financialModelExpenseType: { id: string; name: string; sortOrder: number } | null;
};

function sortCostItems(items: CostItemWithRelations[]) {
  items.sort((a, b) => {
    const catOrderA = a.costCategory?.sortOrder ?? 999;
    const catOrderB = b.costCategory?.sortOrder ?? 999;
    if (catOrderA !== catOrderB) return catOrderA - catOrderB;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
}

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let costItems: CostItemWithRelations[];

    try {
      const raw = await prisma.costItem.findMany({
        include: {
          costCategory: true,
          financialModelExpenseType: true,
        },
      });
      costItems = raw as CostItemWithRelations[];
    } catch (prismaError: unknown) {
      const errMsg = prismaError instanceof Error ? prismaError.message : String(prismaError);
      const isMissingModel =
        /costCategory|CostCategory|financialModelExpenseType|FinancialModelExpenseType|Unknown arg|does not exist/.test(errMsg);

      if (!isMissingModel) throw prismaError;

      // Fallback: загрузка через raw SQL (работает при старом Prisma Client)
      console.warn('Prisma Client missing new models, using raw SQL fallback:', errMsg);
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          costCategoryId: string;
          title: string;
          sortOrder: number;
          financialModelExpenseTypeId: string;
          category_name: string | null;
          category_sortOrder: number | null;
          type_name: string | null;
          type_sortOrder: number | null;
        }>
      >`
        SELECT ci.id, ci."costCategoryId", ci.title, ci."sortOrder", ci."financialModelExpenseTypeId",
               cc.name as category_name, cc."sortOrder" as category_sortOrder,
               fm.name as type_name, fm."sortOrder" as type_sortOrder
        FROM "CostItem" ci
        LEFT JOIN "CostCategory" cc ON cc.id = ci."costCategoryId"
        LEFT JOIN "FinancialModelExpenseType" fm ON fm.id = ci."financialModelExpenseTypeId"
        ORDER BY cc."sortOrder" ASC NULLS LAST, ci."sortOrder" ASC, ci.title ASC
      `;
      costItems = rows.map((r) => ({
        id: r.id,
        costCategoryId: r.costCategoryId,
        title: r.title,
        sortOrder: r.sortOrder,
        financialModelExpenseTypeId: r.financialModelExpenseTypeId,
        costCategory:
          r.category_name != null && r.category_sortOrder != null
            ? { id: '', name: r.category_name, sortOrder: r.category_sortOrder }
            : null,
        financialModelExpenseType:
          r.type_name != null && r.type_sortOrder != null
            ? { id: '', name: r.type_name, sortOrder: r.type_sortOrder }
            : null,
      }));
    }

    const validItems = costItems.filter(
      (item) => item.costCategory && item.financialModelExpenseType
    );
    sortCostItems(validItems);
    return NextResponse.json({ costItems: validItems });
  } catch (error) {
    console.error('Error fetching cost items:', error);
    const errorDetails = error instanceof Error ? error.message : String(error);
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
