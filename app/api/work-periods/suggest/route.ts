import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';

/** Предлагает следующий период: от (dateTo предыдущего + 1 день) на 1 месяц (конец - 1 день следующего месяца). */
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
      service.site.client.accountManagerId,
      service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const lastPeriod = await prisma.workPeriod.findFirst({
      where: { serviceId },
      orderBy: { dateTo: 'desc' },
    });

    let dateFrom: Date;
    if (lastPeriod) {
      const nextDay = new Date(lastPeriod.dateTo);
      nextDay.setDate(nextDay.getDate() + 1);
      dateFrom = nextDay;
    } else {
      dateFrom = new Date(service.startDate);
    }

    const dateTo = new Date(dateFrom);
    dateTo.setMonth(dateTo.getMonth() + 1);
    dateTo.setDate(0);

    return NextResponse.json({
      suggested: {
        dateFrom: dateFrom.toISOString().slice(0, 10),
        dateTo: dateTo.toISOString().slice(0, 10),
      },
      expectedAmount: service.price != null ? service.price.toString() : null,
    });
  } catch (e: any) {
    console.error('GET work-periods/suggest', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
