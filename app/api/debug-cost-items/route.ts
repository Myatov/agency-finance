import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  try {
    const user = await getSession();
    diagnostics.checks.auth = user ? 'OK' : 'FAILED';
  } catch (e) {
    diagnostics.checks.auth = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Проверка CostCategory
  try {
    const count = await prisma.costCategory.count();
    diagnostics.checks.costCategory = { available: true, count };
  } catch (e) {
    diagnostics.checks.costCategory = {
      available: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    };
  }

  // Проверка FinancialModelExpenseType
  try {
    const count = await prisma.financialModelExpenseType.count();
    diagnostics.checks.financialModelExpenseType = { available: true, count };
  } catch (e) {
    diagnostics.checks.financialModelExpenseType = {
      available: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    };
  }

  // Проверка CostItem
  try {
    const count = await prisma.costItem.count();
    diagnostics.checks.costItem = { available: true, count };
    
    // Попытка получить с include
    try {
      const items = await prisma.costItem.findMany({
        take: 1,
        include: {
          costCategory: true,
          financialModelExpenseType: true,
        },
      });
      diagnostics.checks.costItemWithRelations = { success: true, sample: items[0] || null };
    } catch (e) {
      diagnostics.checks.costItemWithRelations = {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  } catch (e) {
    diagnostics.checks.costItem = {
      available: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
