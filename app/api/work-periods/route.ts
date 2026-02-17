import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import { getExpectedPeriods } from '@/lib/periods';
import { WorkPeriodType, BillingType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceId = request.nextUrl.searchParams.get('serviceId');
    if (!serviceId) {
      return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { site: { include: { client: { select: { id: true, name: true, sellerEmployeeId: true, accountManagerId: true, legalEntityId: true } } } } },
    });
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      service.site.client.accountManagerId,
      service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let periods = await prisma.workPeriod.findMany({
      where: { serviceId },
      include: {
        invoices: {
          include: {
            payments: true,
            legalEntity: { select: { id: true, name: true } },
          },
        },
        invoiceLines: { select: { id: true } },
        periodInvoiceNotes: { select: { id: true } },
        periodReport: {
          include: { accountManager: { select: { id: true, fullName: true } } },
        },
        closeoutDocuments: { select: { id: true } },
      },
      orderBy: { dateFrom: 'desc' },
    });

    const serviceForExpected = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { startDate: true, endDate: true, billingType: true, price: true },
    });
    if (serviceForExpected) {
      const existingForCalc = periods.map((p) => ({
        dateFrom: p.dateFrom.toISOString().slice(0, 10),
        dateTo: p.dateTo.toISOString().slice(0, 10),
        periodType: p.periodType,
      }));
      const expected = getExpectedPeriods(
        new Date(serviceForExpected.startDate),
        serviceForExpected.billingType as BillingType,
        serviceForExpected.endDate ? new Date(serviceForExpected.endDate) : undefined,
        existingForCalc
      );
      const existingKeys = new Set(periods.map((p) => `${p.dateFrom.toISOString().slice(0, 10)}:${p.dateTo.toISOString().slice(0, 10)}`));
      let anyCreated = false;
      for (const ep of expected) {
        if (existingKeys.has(`${ep.dateFrom}:${ep.dateTo}`)) continue;
        const dateFrom = new Date(ep.dateFrom + 'T00:00:00.000Z');
        const dateTo = new Date(ep.dateTo + 'T00:00:00.000Z');
        try {
          await prisma.workPeriod.create({
            data: {
              serviceId,
              dateFrom,
              dateTo,
              periodType: 'STANDARD',
              invoiceNotRequired: false,
              expectedAmount: serviceForExpected.price ?? undefined,
            },
          });
          existingKeys.add(`${ep.dateFrom}:${ep.dateTo}`);
          anyCreated = true;
        } catch (e: any) {
          if (e?.code === 'P2002') {
            existingKeys.add(`${ep.dateFrom}:${ep.dateTo}`);
          }
        }
      }
      if (anyCreated) {
        periods = await prisma.workPeriod.findMany({
          where: { serviceId },
          include: {
            invoices: {
              include: {
                payments: true,
                legalEntity: { select: { id: true, name: true } },
              },
            },
            invoiceLines: { select: { id: true } },
            periodInvoiceNotes: { select: { id: true } },
            periodReport: {
              include: { accountManager: { select: { id: true, fullName: true } } },
            },
            closeoutDocuments: { select: { id: true } },
          },
          orderBy: { dateFrom: 'desc' },
        });
      }
    }

    let clientGenerateClosingDocs = false;
    const legalEntityId = service.site.client.legalEntityId;
    if (legalEntityId) {
      try {
        const le = await prisma.legalEntity.findUnique({
          where: { id: legalEntityId },
          select: { generateClosingDocs: true },
        });
        clientGenerateClosingDocs = le?.generateClosingDocs ?? false;
      } catch {
        // ignore
      }
    }

    const periodIds = periods.map((p) => p.id);
    const incomeSums =
      periodIds.length > 0
        ? await prisma.income.groupBy({
            by: ['workPeriodId'],
            where: { workPeriodId: { in: periodIds } },
            _sum: { amount: true },
          })
        : [];
    const incomeByPeriod = new Map<string, number>();
    for (const x of incomeSums) {
      if (x.workPeriodId != null) incomeByPeriod.set(x.workPeriodId, Number(x._sum.amount ?? 0));
    }

    const serialized = periods.map((p) => {
      const row = JSON.parse(JSON.stringify(p, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
      (row as any).incomeSum = incomeByPeriod.get(p.id) ?? 0;
      (row as any).hasAttachedInvoice =
        (p.invoices?.length ?? 0) > 0 ||
        (p.invoiceLines?.length ?? 0) > 0 ||
        (p.periodInvoiceNotes?.length ?? 0) > 0;
      return row;
    });
    return NextResponse.json({
      workPeriods: serialized,
      clientGenerateClosingDocs,
    });
  } catch (e: any) {
    console.error('GET work-periods', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { serviceId, dateFrom, dateTo, periodType, invoiceNotRequired, expectedAmount } = body;

    if (!serviceId || !dateFrom || !dateTo) {
      return NextResponse.json({ error: 'serviceId, dateFrom, dateTo are required' }, { status: 400 });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { site: { include: { client: true } } },
    });
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      service.site.client.accountManagerId,
      service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const validTypes: WorkPeriodType[] = ['STANDARD', 'EXTENDED', 'BONUS', 'COMPENSATION'];
    const type = validTypes.includes(periodType) ? periodType : 'STANDARD';

    const expectedAmountBigInt =
      expectedAmount != null && expectedAmount !== ''
        ? BigInt(Math.round(parseFloat(expectedAmount) * 100))
        : service.price ?? undefined;

    const norm = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d).slice(0, 10)) ? new Date(String(d).slice(0, 10) + 'T00:00:00.000Z') : new Date(d);
    const period = await prisma.workPeriod.create({
      data: {
        serviceId,
        dateFrom: norm(dateFrom),
        dateTo: norm(dateTo),
        periodType: type,
        invoiceNotRequired: Boolean(invoiceNotRequired),
        expectedAmount: expectedAmountBigInt,
      },
      include: {
        invoices: true,
        periodReport: true,
      },
    });

    const out = JSON.parse(JSON.stringify(period, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ workPeriod: out });
  } catch (e: any) {
    console.error('POST work-periods', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
