import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasViewAllPermission } from '@/lib/permissions';
import { getExpectedPeriods } from '@/lib/periods';
import { BillingType } from '@prisma/client';

/** Данные для раздела «Оплаты»: периоды с ожидаемой суммой, оплачено, остаток, статус.
 *  Возвращаются ВСЕ периоды по фильтрам, в т.ч. без выставленных счетов (invoicesCount может быть 0). */
export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const viewAll = await hasViewAllPermission(user, 'services');
    const accountManagerId = request.nextUrl.searchParams.get('accountManagerId') || undefined;
    const clientId = request.nextUrl.searchParams.get('clientId') || undefined;
    const dateFrom = request.nextUrl.searchParams.get('dateFrom') || undefined;
    const dateTo = request.nextUrl.searchParams.get('dateTo') || undefined;
    const overdueOnly = request.nextUrl.searchParams.get('overdueOnly') === '1';

    const wherePeriod: any = {};
    if (dateFrom) wherePeriod.dateFrom = { gte: new Date(dateFrom) };
    if (dateTo) wherePeriod.dateTo = { lte: new Date(dateTo) };

    const andParts: any[] = [];
    if (accountManagerId) andParts.push({ site: { accountManagerId } });
    if (clientId) andParts.push({ site: { clientId } });
    if (!viewAll) {
      andParts.push({
        OR: [
          { site: { accountManagerId: user.id } },
          { site: { creatorId: user.id } },
          { site: { client: { sellerEmployeeId: user.id } } },
        ],
      });
    }
    if (andParts.length) wherePeriod.service = { AND: andParts };

    // Без фильтра по наличию счетов — показываем и периоды без счетов
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
        periodReport: true,
      },
      orderBy: { dateTo: 'asc' },
      take: 200,
    });

    const now = new Date();
    const periodKey = (sid: string, from: string, to: string) => `${sid}:${from}:${to}`;
    const existingKeys = new Set(
      periods.map((p) => periodKey(p.serviceId, p.dateFrom.toISOString().slice(0, 10), p.dateTo.toISOString().slice(0, 10)))
    );

    const rows = periods.map((p) => {
      const expected = p.service.price ? Number(p.service.price) : 0;
      const paid = p.invoices.reduce((sum, inv) => {
        return sum + inv.payments.reduce((s, pay) => s + Number(pay.amount), 0);
      }, 0);
      const totalInvoiced = p.invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const balance = totalInvoiced - paid;
      const hasReport = !!p.periodReport;
      const isOverdue = !hasReport && p.dateTo < now;
      const risk = isOverdue || (p.dateTo >= now && !hasReport && totalInvoiced > 0);
      return {
        id: p.id,
        serviceId: p.serviceId,
        dateFrom: p.dateFrom.toISOString().slice(0, 10),
        dateTo: p.dateTo.toISOString().slice(0, 10),
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
        isOverdue,
        risk,
        invoicesCount: p.invoices.length,
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
      for (const ep of expected) {
        if (existingKeys.has(periodKey(svc.id, ep.dateFrom, ep.dateTo))) continue;
        const from = new Date(ep.dateFrom);
        const to = new Date(ep.dateTo);
        if (dateFromFilter && to < dateFromFilter) continue;
        if (dateToFilter && from > dateToFilter) continue;
        const expectedAmount = svc.price ? Number(svc.price) : 0;
        const hasReport = false;
        const isOverdue = to < now;
        const risk = isOverdue || (!hasReport && to >= now);
        rows.push({
          id: `virtual:${svc.id}:${ep.dateFrom}:${ep.dateTo}`,
          serviceId: svc.id,
          dateFrom: ep.dateFrom,
          dateTo: ep.dateTo,
          periodType: 'STANDARD',
          invoiceNotRequired: false,
          client: svc.site.client,
          site: { id: svc.site.id, title: svc.site.title },
          product: svc.product,
          accountManager: svc.site.accountManager,
          expectedAmount: String(expectedAmount),
          totalInvoiced: '0',
          paid: '0',
          balance: '0',
          hasReport: false,
          isOverdue,
          risk,
          invoicesCount: 0,
          isVirtual: true,
        });
      }
    }

    rows.sort((a, b) => a.dateTo.localeCompare(b.dateTo));

    let result = rows;
    if (overdueOnly) result = result.filter((r) => r.isOverdue || r.risk);

    const planTotal = result.reduce((s, r) => s + Number(r.expectedAmount), 0);
    const factTotal = result.reduce((s, r) => s + Number(r.paid), 0);

    return NextResponse.json({
      periods: result,
      summary: {
        planTotal: String(planTotal),
        factTotal: String(factTotal),
        deviation: String(planTotal - factTotal),
      },
    });
  } catch (e: any) {
    console.error('GET payments-dashboard', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
