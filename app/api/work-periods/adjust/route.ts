import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { serviceId, periodId, newDateTo, cascadeFollowing } = body;

    if (!serviceId || !periodId || !newDateTo) {
      return NextResponse.json(
        { error: 'serviceId, periodId, and newDateTo are required' },
        { status: 400 }
      );
    }

    const period = await prisma.workPeriod.findUnique({
      where: { id: periodId },
      include: {
        service: { include: { site: { include: { client: true } } } },
      },
    });

    if (!period) return NextResponse.json({ error: 'Work period not found' }, { status: 404 });
    if (period.serviceId !== serviceId) {
      return NextResponse.json({ error: 'Period does not belong to the specified service' }, { status: 400 });
    }

    const canAccess = await canAccessServiceForPeriods(
      user,
      period.service.site.client.accountManagerId,
      period.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const parsedNewDateTo = new Date(newDateTo + (newDateTo.length === 10 ? 'T00:00:00.000Z' : ''));
    if (isNaN(parsedNewDateTo.getTime())) {
      return NextResponse.json({ error: 'Invalid newDateTo date' }, { status: 400 });
    }

    if (parsedNewDateTo.getTime() <= period.dateFrom.getTime()) {
      return NextResponse.json(
        { error: 'newDateTo must be after the period dateFrom' },
        { status: 400 }
      );
    }

    const oldDateTo = period.dateTo.getTime();
    const diffMs = parsedNewDateTo.getTime() - oldDateTo;

    const updated = await prisma.workPeriod.update({
      where: { id: periodId },
      data: { dateTo: parsedNewDateTo },
    });

    const updatedPeriods: any[] = [updated];

    if (cascadeFollowing && diffMs !== 0) {
      const following = await prisma.workPeriod.findMany({
        where: {
          serviceId,
          dateFrom: { gt: period.dateTo },
        },
        orderBy: { dateFrom: 'asc' },
      });

      for (const fp of following) {
        const shifted = await prisma.workPeriod.update({
          where: { id: fp.id },
          data: {
            dateFrom: new Date(fp.dateFrom.getTime() + diffMs),
            dateTo: new Date(fp.dateTo.getTime() + diffMs),
          },
        });
        updatedPeriods.push(shifted);
      }
    }

    const out = JSON.parse(
      JSON.stringify(updatedPeriods, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    );
    return NextResponse.json({ updatedPeriods: out });
  } catch (e: any) {
    console.error('POST work-periods/adjust', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
