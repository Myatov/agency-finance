import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessBulkTaxExpenses } from '@/lib/permissions';
import { notifyBulkTaxExpenses } from '@/lib/telegram';

/**
 * POST: создать расходы по выбранным доходам (налог УСН и опционально НДС).
 * body: { costItemId, legalEntityId, incomeIds: string[], costItemIdVat?: string }
 * Доступ: только OWNER и CEO.
 * Защита от дублей: по доходам, для которых уже есть расход с sourceIncomeId, пропуск.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccessBulkTaxExpenses(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const costItemId = typeof body.costItemId === 'string' ? body.costItemId.trim() : '';
    const legalEntityId = typeof body.legalEntityId === 'string' ? body.legalEntityId.trim() : '';
    const costItemIdVat = typeof body.costItemIdVat === 'string' ? body.costItemIdVat.trim() || null : null;
    const incomeIds = Array.isArray(body.incomeIds) ? body.incomeIds.filter((id: unknown): id is string => typeof id === 'string') : [];

    if (!costItemId || !legalEntityId || incomeIds.length === 0) {
      return NextResponse.json(
        { error: 'Требуются costItemId, legalEntityId и непустой массив incomeIds' },
        { status: 400 }
      );
    }

    const [costItem, legalEntity, costItemVat] = await Promise.all([
      prisma.costItem.findUnique({ where: { id: costItemId } }),
      prisma.legalEntity.findUnique({ where: { id: legalEntityId }, select: { name: true, usnPercent: true, vatPercent: true } }),
      costItemIdVat ? prisma.costItem.findUnique({ where: { id: costItemIdVat } }) : Promise.resolve(null),
    ]);
    if (!costItem) return NextResponse.json({ error: 'Статья расхода не найдена' }, { status: 404 });
    if (!legalEntity) return NextResponse.json({ error: 'Юрлицо не найдено' }, { status: 404 });
    if (costItemIdVat && !costItemVat) return NextResponse.json({ error: 'Статья расхода НДС не найдена' }, { status: 404 });

    const usnPercent = Number(legalEntity.usnPercent) || 0;
    const vatPercent = costItemIdVat && costItemVat ? Number(legalEntity.vatPercent) || 0 : 0;

    const incomes = await prisma.income.findMany({
      where: { id: { in: incomeIds }, legalEntityId },
      include: {
        service: { select: { siteId: true } },
        workPeriod: { select: { dateFrom: true, dateTo: true } },
      },
    });

    const existing = await prisma.expense.findMany({
      where: { sourceIncomeId: { in: incomes.map((i) => i.id) } },
      select: { sourceIncomeId: true },
    });
    const existingIncomeIds = new Set((existing.map((e) => e.sourceIncomeId).filter(Boolean) as string[]));

    const created: { id: string; amount: number; comment: string | null }[] = [];
    let totalAmountKopecks = 0;
    const now = new Date();

    for (const inc of incomes) {
      if (existingIncomeIds.has(inc.id)) continue;

      const periodLabel = inc.workPeriod
        ? `${inc.workPeriod.dateFrom.toLocaleDateString('ru-RU')} — ${inc.workPeriod.dateTo.toLocaleDateString('ru-RU')}`
        : inc.incomeDate.toLocaleDateString('ru-RU');

      const taxKopecks = Math.round((Number(inc.amount) * usnPercent) / 100);
      if (taxKopecks > 0) {
        const comment = `Налог с дохода за период ${periodLabel} (масс.)`;
        const expense = await prisma.expense.create({
          data: {
            amount: BigInt(taxKopecks),
            costItemId,
            title: costItem.title,
            siteId: inc.service.siteId,
            serviceId: inc.serviceId,
            legalEntityId,
            comment,
            createdByUserId: user.id,
            paymentAt: now,
            sourceIncomeId: inc.id,
          },
        });
        created.push({ id: expense.id, amount: taxKopecks, comment });
        totalAmountKopecks += taxKopecks;
      }

      if (vatPercent > 0 && costItemIdVat && costItemVat) {
        const vatKopecks = Math.round((Number(inc.amount) * vatPercent) / 100);
        if (vatKopecks > 0) {
          const vatComment = `НДС с дохода за период ${periodLabel} (масс.)`;
          const vatExpense = await prisma.expense.create({
            data: {
              amount: BigInt(vatKopecks),
              costItemId: costItemIdVat,
              title: costItemVat.title,
              siteId: inc.service.siteId,
              serviceId: inc.serviceId,
              legalEntityId,
              comment: vatComment,
              createdByUserId: user.id,
              paymentAt: now,
            },
          });
          created.push({ id: vatExpense.id, amount: vatKopecks, comment: vatComment });
          totalAmountKopecks += vatKopecks;
        }
      }
    }

    const totalRub = (totalAmountKopecks / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    notifyBulkTaxExpenses(created.length, totalRub, legalEntity.name, user.fullName).catch((err) =>
      console.error('[Telegram] notifyBulkTaxExpenses error:', err)
    );

    return NextResponse.json({
      success: true,
      created: created.length,
      expenses: created,
    });
  } catch (e) {
    console.error('POST bulk-tax-expenses/create', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
