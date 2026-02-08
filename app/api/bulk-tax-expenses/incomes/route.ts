import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessBulkTaxExpenses } from '@/lib/permissions';

/**
 * GET: доходы по юрлицу за период для массового формирования налоговых расходов.
 * Доступ: только OWNER и CEO.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccessBulkTaxExpenses(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const legalEntityId = request.nextUrl.searchParams.get('legalEntityId');
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');

    if (!legalEntityId || !dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'Требуются legalEntityId, dateFrom, dateTo' },
        { status: 400 }
      );
    }

    const legalEntity = await prisma.legalEntity.findUnique({
      where: { id: legalEntityId },
      select: { id: true, name: true, usnPercent: true, vatPercent: true },
    });
    if (!legalEntity) {
      return NextResponse.json({ error: 'Юрлицо не найдено' }, { status: 404 });
    }

    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (to < from) {
      return NextResponse.json({ error: 'dateTo должен быть не раньше dateFrom' }, { status: 400 });
    }

    const incomes = await prisma.income.findMany({
      where: {
        legalEntityId,
        incomeDate: { gte: from, lte: to },
      },
      include: {
        service: {
          include: {
            product: { select: { name: true } },
            site: {
              include: {
                client: { select: { name: true } },
                accountManager: { select: { id: true, fullName: true } },
              },
            },
          },
        },
        workPeriod: {
          select: { id: true, dateFrom: true, dateTo: true },
        },
      },
      orderBy: { incomeDate: 'asc' },
    });

    const incomeIds = incomes.map((i) => i.id);
    const existingExpenses = await prisma.expense.findMany({
      where: { sourceIncomeId: { in: incomeIds } },
      select: { sourceIncomeId: true },
    });
    const existingByIncome = new Set((existingExpenses.map((e) => e.sourceIncomeId).filter(Boolean) as string[]));

    const usnPercent = Number(legalEntity.usnPercent) || 0;
    const vatPercent = Number(legalEntity.vatPercent) || 0;
    const rows = incomes.map((inc) => {
      const amountKopecks = Number(inc.amount);
      const taxKopecks = Math.round((amountKopecks * usnPercent) / 100);
      const vatKopecks = vatPercent > 0 ? Math.round((amountKopecks * vatPercent) / 100) : 0;
      return {
        id: inc.id,
        incomeDate: inc.incomeDate,
        amount: amountKopecks,
        amountRub: amountKopecks / 100,
        taxAmount: taxKopecks,
        taxAmountRub: taxKopecks / 100,
        vatAmount: vatKopecks,
        vatAmountRub: vatKopecks / 100,
        hasExistingExpense: existingByIncome.has(inc.id),
        productName: inc.service.product.name,
        siteTitle: inc.service.site.title,
        clientName: inc.service.site.client.name,
        periodFrom: inc.workPeriod?.dateFrom ?? null,
        periodTo: inc.workPeriod?.dateTo ?? null,
        accountManager: inc.service.site.accountManager?.fullName ?? null,
      };
    });

    return NextResponse.json({
      legalEntity: { id: legalEntity.id, name: legalEntity.name, usnPercent, vatPercent: Number(legalEntity.vatPercent) || 0 },
      incomes: rows,
    });
  } catch (e) {
    console.error('GET bulk-tax-expenses/incomes', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
