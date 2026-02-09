import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasViewAllPermission, hasPermission } from '@/lib/permissions';
import { getExpectedPeriods } from '@/lib/periods';
import { BillingType } from '@prisma/client';

/** Данные для раздела «Оплаты»: периоды с ожидаемой суммой, оплачено, остаток, статус.
 *  Возвращаются ВСЕ периоды по фильтрам, в т.ч. без выставленных счетов (invoicesCount может быть 0). */
export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const canViewPayments = await hasPermission(user, 'payments', 'view');
    if (!canViewPayments) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const viewAllPayments = await hasViewAllPermission(user, 'payments');
    // При просмотре только своих отчётов — принудительно только текущий пользователь (аккаунт-менеджер)
    const accountManagerIdParam = request.nextUrl.searchParams.get('accountManagerId') || undefined;
    const accountManagerId = !viewAllPayments ? user.id : accountManagerIdParam;
    const clientId = request.nextUrl.searchParams.get('clientId') || undefined;
    const dateFrom = request.nextUrl.searchParams.get('dateFrom') || undefined;
    const dateTo = request.nextUrl.searchParams.get('dateTo') || undefined;
    const overdueOnly = request.nextUrl.searchParams.get('overdueOnly') === '1';
    const paymentOverdueOnly = request.nextUrl.searchParams.get('paymentOverdueOnly') === '1';

    const andParts: any[] = [];
    if (accountManagerId) andParts.push({ site: { accountManagerId } });
    if (clientId) andParts.push({ site: { clientId } });
    if (!viewAllPayments) {
      andParts.push({ site: { accountManagerId: user.id } });
    }

    // Период включаем, если он пересекается с диапазоном [dateFrom, dateTo]; все условия в одном AND для стабильной загрузки связей
    const wherePeriodConditions: any[] = [];
    if (dateFrom && dateTo) {
      wherePeriodConditions.push(
        { dateTo: { gte: new Date(dateFrom) } },
        { dateFrom: { lte: new Date(dateTo) } }
      );
    } else if (dateFrom) {
      wherePeriodConditions.push({ dateTo: { gte: new Date(dateFrom) } });
    } else if (dateTo) {
      wherePeriodConditions.push({ dateFrom: { lte: new Date(dateTo) } });
    }
    if (andParts.length) wherePeriodConditions.push({ service: { AND: andParts } });
    const wherePeriod = wherePeriodConditions.length > 0 ? { AND: wherePeriodConditions } : {};

    // Все id периодов по фильтру (без take) — для полного учёта доходов и сводки
    const allPeriodIds = await prisma.workPeriod.findMany({
      where: wherePeriod,
      select: { id: true },
    });
    const periodIdsAll = allPeriodIds.map((p) => p.id);

    const incomeSums =
      periodIdsAll.length > 0
        ? await prisma.income.groupBy({
            by: ['workPeriodId'],
            where: { workPeriodId: { in: periodIdsAll } },
            _sum: { amount: true },
          })
        : [];
    const incomeByPeriod = new Map<string, number>();
    for (const x of incomeSums) {
      if (x.workPeriodId != null) incomeByPeriod.set(x.workPeriodId, Number(x._sum.amount ?? 0));
    }

    const totalIncomesAll = Array.from(incomeByPeriod.values()).reduce((s, v) => s + v, 0);
    const factTotalFromAllPeriods = totalIncomesAll;

    // Без фильтра по наличию счетов — показываем и периоды без счетов (для таблицы берём больше записей)
    const periods = await prisma.workPeriod.findMany({
      where: wherePeriod,
      include: {
        service: {
          include: {
            site: {
              include: {
                client: { select: { id: true, name: true } },
                accountManager: { select: { id: true, fullName: true } },
              },
            },
            product: { select: { id: true, name: true } },
          },
        },
        invoices: {
          include: {
            payments: true,
            legalEntity: { select: { id: true, name: true } },
          },
        },
        invoiceLines: { select: { id: true } },
        periodInvoiceNotes: { select: { id: true } },
        periodReport: true,
        closeoutDocuments: { take: 1, select: { id: true } },
      },
      orderBy: { dateTo: 'asc' },
      take: 500,
    });

    const periodIdsForFlags = periods.map((p) => p.id);
    const [reportsForPeriods, closeoutForPeriods] =
      periodIdsForFlags.length > 0
        ? await Promise.all([
            prisma.workPeriodReport.findMany({
              where: { workPeriodId: { in: periodIdsForFlags } },
              select: { workPeriodId: true },
            }),
            prisma.closeoutDocument.findMany({
              where: { workPeriodId: { in: periodIdsForFlags } },
              select: { workPeriodId: true },
            }),
          ])
        : [[], []];
    const hasReportIds = new Set(reportsForPeriods.map((r) => r.workPeriodId));
    const hasCloseoutDocIds = new Set(closeoutForPeriods.map((d) => d.workPeriodId));

    const now = new Date();
    const periodKey = (sid: string, from: string, to: string) => `${sid}:${from}:${to}`;
    const existingKeys = new Set(
      periods.map((p) => periodKey(p.serviceId, p.dateFrom.toISOString().slice(0, 10), p.dateTo.toISOString().slice(0, 10)))
    );

    const isPrepay = (pt: string) => pt === 'FULL_PREPAY' || pt === 'PARTIAL_PREPAY';

    const rows = periods.map((p) => {
      const invoices = p.invoices ?? [];
      const expected =
        p.expectedAmount != null
          ? Number(p.expectedAmount)
          : p.service?.price
            ? Number(p.service.price)
            : 0;
      const incomeSum = incomeByPeriod.get(p.id) ?? 0;
      const paid = incomeSum;
      const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const balance = expected - paid;
      const hasReport = hasReportIds.has(p.id);
      const hasInvoice =
        invoices.length > 0 ||
        (p.invoiceLines?.length ?? 0) > 0 ||
        (p.periodInvoiceNotes?.length ?? 0) > 0;
      const hasCloseoutDoc = hasCloseoutDocIds.has(p.id);
      const prepay = isPrepay(p.service?.prepaymentType ?? 'POSTPAY');
      const paymentDueDate = prepay ? new Date(p.dateFrom) : new Date(p.dateTo);
      const isPaymentOverdue = paymentDueDate < now && balance > 0;
      const isOverdue = !hasReport && p.dateTo < now;
      const risk = isOverdue || (p.dateTo >= now && !hasReport && totalInvoiced > 0);
      return {
        id: p.id,
        serviceId: p.serviceId,
        dateFrom: p.dateFrom.toISOString().slice(0, 10),
        dateTo: p.dateTo.toISOString().slice(0, 10),
        paymentDueDate: paymentDueDate.toISOString().slice(0, 10),
        periodType: p.periodType,
        invoiceNotRequired: p.invoiceNotRequired,
        client: p.service.site.client,
        site: { id: p.service.site.id, title: p.service.site.title },
        product: p.service.product,
        accountManager: p.service.site.accountManager,
        expectedAmount: String(expected),
        totalInvoiced: String(totalInvoiced),
        paid: String(paid),
        balance: String(balance),
        hasReport,
        hasInvoice,
        hasCloseoutDoc,
        isOverdue,
        isPaymentOverdue,
        risk,
        invoicesCount: invoices.length,
        isVirtual: false,
      };
    });

    const whereServiceForVirtual: any = { status: 'ACTIVE' };
    if (andParts.length) whereServiceForVirtual.AND = andParts;
    const servicesForVirtual = await prisma.service.findMany({
      where: whereServiceForVirtual,
      include: {
        site: {
          include: {
            client: { select: { id: true, name: true } },
            accountManager: { select: { id: true, fullName: true } },
          },
        },
        product: { select: { id: true, name: true } },
      },
      take: 100,
    });

    const dateFromFilter = dateFrom ? new Date(dateFrom) : null;
    const dateToFilter = dateTo ? new Date(dateTo) : null;

    for (const svc of servicesForVirtual) {
      const expected = getExpectedPeriods(
        new Date(svc.startDate),
        svc.billingType as BillingType,
        svc.endDate ? new Date(svc.endDate) : undefined
      );
      const svcPrepay = isPrepay(svc.prepaymentType ?? 'POSTPAY');
      for (const ep of expected) {
        if (existingKeys.has(periodKey(svc.id, ep.dateFrom, ep.dateTo))) continue;
        const from = new Date(ep.dateFrom);
        const to = new Date(ep.dateTo);
        const paymentDueDate = svcPrepay ? from : to;
        if (dateFromFilter && paymentDueDate < dateFromFilter) continue;
        if (dateToFilter && paymentDueDate > dateToFilter) continue;
        const expectedAmount = svc.price ? Number(svc.price) : 0;
        const hasReport = false;
        const hasInvoice = false;
        const hasCloseoutDoc = false;
        const isOverdue = to < now;
        const isPaymentOverdue = paymentDueDate < now && expectedAmount > 0;
        const risk = isOverdue || (!hasReport && to >= now);
        rows.push({
          id: `virtual:${svc.id}:${ep.dateFrom}:${ep.dateTo}`,
          serviceId: svc.id,
          dateFrom: ep.dateFrom,
          dateTo: ep.dateTo,
          paymentDueDate: paymentDueDate.toISOString().slice(0, 10),
          periodType: 'STANDARD',
          invoiceNotRequired: false,
          client: svc.site.client,
          site: { id: svc.site.id, title: svc.site.title },
          product: svc.product,
          accountManager: svc.site.accountManager,
          expectedAmount: String(expectedAmount),
          totalInvoiced: '0',
          paid: '0',
          balance: String(expectedAmount),
          hasReport: false,
          hasInvoice: false,
          hasCloseoutDoc: false,
          isOverdue,
          isPaymentOverdue,
          risk,
          invoicesCount: 0,
          isVirtual: true,
        });
      }
    }

    // Фильтр по «месяцу оплаты»: период входит в отчёт только если дата оплаты (по типу «Когда выставлять счёт») попадает в диапазон
    const filterByPaymentDate = (r: { paymentDueDate: string }) => {
      if (!dateFrom && !dateTo) return true;
      const d = r.paymentDueDate;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };

    let result = rows.filter(filterByPaymentDate);
    result.sort((a, b) => a.dateTo.localeCompare(b.dateTo));

    const planTotal = result.reduce((s, r) => s + Number(r.expectedAmount), 0);
    const factTotalFromFiltered = result
      .filter((r) => !r.isVirtual)
      .reduce((s, r) => s + (incomeByPeriod.get(r.id) ?? 0), 0);

    if (overdueOnly) {
      // Просрочки: периоды, где не заполнен хотя бы один из элементов — Отчёт / Счёт / Акт
      result = result.filter(
        (r) =>
          !r.hasReport ||
          (!r.invoiceNotRequired && !r.hasInvoice) ||
          !r.hasCloseoutDoc
      );
    }
    if (paymentOverdueOnly) {
      result = result.filter((r) => r.isPaymentOverdue);
    }

    return NextResponse.json({
      periods: result,
      summary: {
        planTotal: String(planTotal),
        factTotal: String(factTotalFromFiltered),
        deviation: String(planTotal - factTotalFromFiltered),
      },
      viewAllPayments,
      currentUserId: user.id,
    });
  } catch (e: any) {
    console.error('GET payments-dashboard', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
