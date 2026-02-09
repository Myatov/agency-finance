import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import { getExpectedPeriods } from '@/lib/periods';
import { BillingType } from '@prisma/client';

/** Ожидаемые периоды по услуге: из даты старта + тип биллинга. Сопоставление с существующими WorkPeriod. */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceId = params.id;
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        site: { include: { client: true } },
        workPeriods: {
          orderBy: { dateFrom: 'asc' },
        },
      },
    });

    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      service.site.accountManagerId,
      service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const startDate = new Date(service.startDate);
    const endLimit = service.endDate ? new Date(service.endDate) : undefined;
    const expected = getExpectedPeriods(
      startDate,
      service.billingType as BillingType,
      endLimit
    );

    const existing = service.workPeriods.map((p) => ({
      id: p.id,
      dateFrom: p.dateFrom.toISOString().slice(0, 10),
      dateTo: p.dateTo.toISOString().slice(0, 10),
      expectedAmount: p.expectedAmount != null ? String(p.expectedAmount) : null,
    }));

    const defaultExpected = service.price != null ? String(service.price) : null;
    const merged = expected.map((ep) => {
      const found = existing.find(
        (e) => e.dateFrom === ep.dateFrom && e.dateTo === ep.dateTo
      );
      return {
        dateFrom: ep.dateFrom,
        dateTo: ep.dateTo,
        isInvoicePeriod: ep.isInvoicePeriod ?? true,
        workPeriodId: found?.id ?? null,
        expectedAmountKopecks: found
          ? (found.expectedAmount ?? defaultExpected)
          : defaultExpected,
      };
    });

    return NextResponse.json({
      serviceId,
      billingType: service.billingType,
      startDate: service.startDate.toISOString().slice(0, 10),
      periods: merged,
    });
  } catch (e: any) {
    console.error('GET services expected-periods', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
