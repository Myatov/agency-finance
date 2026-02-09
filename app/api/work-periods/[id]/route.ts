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
            site: {
              include: {
                client: {
                  include: {
                    legalEntity: { select: { id: true, name: true } },
                  },
                },
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
        periodReport: {
          include: { accountManager: { select: { id: true, fullName: true } } },
        },
        closeoutDocuments: {
          select: { id: true, originalName: true, docType: true, uploadedAt: true },
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
    const { dateFrom, dateTo, periodType, invoiceNotRequired, expectedAmount } = body;

    const updateData: any = {};
    if (dateFrom !== undefined) updateData.dateFrom = new Date(dateFrom);
    if (dateTo !== undefined) updateData.dateTo = new Date(dateTo);
    if (periodType !== undefined) {
      const valid: WorkPeriodType[] = ['STANDARD', 'EXTENDED', 'BONUS', 'COMPENSATION'];
      updateData.periodType = valid.includes(periodType) ? periodType : period.periodType;
    }
    if (invoiceNotRequired !== undefined) updateData.invoiceNotRequired = Boolean(invoiceNotRequired);
    if (expectedAmount !== undefined) {
      updateData.expectedAmount =
        expectedAmount != null && expectedAmount !== ''
          ? BigInt(Math.round(parseFloat(String(expectedAmount)) * 100))
          : null;
    }

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

    const incomesCount = await prisma.income.count({
      where: { workPeriodId: id },
    });
    if (incomesCount > 0) {
      return NextResponse.json(
        { error: 'Удаление невозможно: к этому периоду привязаны доходы в разделе «Доходы». Сначала отвяжите или удалите их.' },
        { status: 400 }
      );
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const periodEnd = new Date(period.dateTo);
    const periodEndDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
    if (periodEndDate.getTime() <= todayStart.getTime()) {
      return NextResponse.json(
        { error: 'Нельзя удалить прошлый период или период, в который входит сегодняшняя дата. Удалять можно только будущие периоды без доходов.' },
        { status: 400 }
      );
    }

    await prisma.workPeriod.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE work-periods/[id]', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
