import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import { WorkPeriodType } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const period = await prisma.workPeriod.findUnique({
      where: { id },
      include: {
        service: {
          include: {
            site: { include: { client: true } },
            product: { select: { id: true, name: true } },
          },
        },
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
    });

    if (!period) return NextResponse.json({ error: 'Work period not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      period.service.site.accountManagerId,
      period.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const out = JSON.parse(JSON.stringify(period, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ workPeriod: out });
  } catch (e: any) {
    console.error('GET work-periods/[id]', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const period = await prisma.workPeriod.findUnique({
      where: { id },
      include: {
        service: { include: { site: { include: { client: true } } } },
      },
    });
    if (!period) return NextResponse.json({ error: 'Work period not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      period.service.site.accountManagerId,
      period.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { dateFrom, dateTo, periodType, invoiceNotRequired } = body;

    const updateData: any = {};
    if (dateFrom !== undefined) updateData.dateFrom = new Date(dateFrom);
    if (dateTo !== undefined) updateData.dateTo = new Date(dateTo);
    if (periodType !== undefined) {
      const valid: WorkPeriodType[] = ['STANDARD', 'EXTENDED', 'BONUS', 'COMPENSATION'];
      updateData.periodType = valid.includes(periodType) ? periodType : period.periodType;
    }
    if (invoiceNotRequired !== undefined) updateData.invoiceNotRequired = Boolean(invoiceNotRequired);

    const updated = await prisma.workPeriod.update({
      where: { id },
      data: updateData,
      include: { invoices: true, periodReport: true },
    });

    const out = JSON.parse(JSON.stringify(updated, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ workPeriod: out });
  } catch (e: any) {
    console.error('PUT work-periods/[id]', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const period = await prisma.workPeriod.findUnique({
      where: { id },
      include: {
        service: { include: { site: { include: { client: true } } } },
      },
    });
    if (!period) return NextResponse.json({ error: 'Work period not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      period.service.site.accountManagerId,
      period.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.workPeriod.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE work-periods/[id]', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
