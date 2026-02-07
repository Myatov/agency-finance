import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import { WorkPeriodType } from '@prisma/client';

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
      include: { site: { include: { client: true } } },
    });
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      service.site.accountManagerId,
      service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const periods = await prisma.workPeriod.findMany({
      where: { serviceId },
      include: {
        invoices: {
          include: {
            payments: true,
            legalEntity: { select: { id: true, name: true } },
          },
        },
        periodReport: {
          include: { accountManager: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: { dateFrom: 'desc' },
    });

    const serialized = periods.map((p) => JSON.parse(JSON.stringify(p, (_, v) => (typeof v === 'bigint' ? v.toString() : v))));
    return NextResponse.json({ workPeriods: serialized });
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
    const { serviceId, dateFrom, dateTo, periodType, invoiceNotRequired } = body;

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
      service.site.accountManagerId,
      service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const validTypes: WorkPeriodType[] = ['STANDARD', 'EXTENDED', 'BONUS', 'COMPENSATION'];
    const type = validTypes.includes(periodType) ? periodType : 'STANDARD';

    const period = await prisma.workPeriod.create({
      data: {
        serviceId,
        dateFrom: new Date(dateFrom),
        dateTo: new Date(dateTo),
        periodType: type,
        invoiceNotRequired: Boolean(invoiceNotRequired),
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
