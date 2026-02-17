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
                    legalEntity: { select: { id: true, name: true, generateClosingDocs: true } },
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
            lines: true,
            legalEntity: { select: { id: true, name: true } },
          },
        },
        periodInvoiceNotes: {
          include: { legalEntity: { select: { id: true, name: true } } },
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

    // Счета по строкам: счёт может быть привязан к периоду через InvoiceLine (несколько услуг в одном счёте)
    const invoicesViaLines = await prisma.invoice.findMany({
      where: { lines: { some: { workPeriodId: id } } },
      include: {
        payments: true,
        lines: true,
        legalEntity: { select: { id: true, name: true } },
      },
    });
    const periodInvoiceIds = new Set(period.invoices.map((i) => i.id));
    const mergedInvoices = [...period.invoices];
    for (const inv of invoicesViaLines) {
      if (!periodInvoiceIds.has(inv.id)) {
        mergedInvoices.push(inv);
        periodInvoiceIds.add(inv.id);
      }
    }

    const out = JSON.parse(
      JSON.stringify(
        { ...period, invoices: mergedInvoices, periodInvoiceNotes: period.periodInvoiceNotes },
        (_, v) => (typeof v === 'bigint' ? v.toString() : v)
      )
    );
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
      include: {
        invoices: { include: { payments: true, lines: true, legalEntity: { select: { id: true, name: true } } } },
        periodReport: true,
        periodInvoiceNotes: { include: { legalEntity: { select: { id: true, name: true } } } },
      },
    });

    // Cascade date shift to subsequent periods when dateTo is extended
    const cascade = request.nextUrl.searchParams.get('cascade') === 'true';
    let cascadedPeriods: any[] = [];
    if (cascade && dateTo !== undefined) {
      const oldDateTo = period.dateTo.getTime();
      const newDateTo = updated.dateTo.getTime();
      const diffMs = newDateTo - oldDateTo;
      if (diffMs > 0) {
        const following = await prisma.workPeriod.findMany({
          where: {
            serviceId: period.serviceId,
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
          cascadedPeriods.push(shifted);
        }
      }
    }

    const out = JSON.parse(JSON.stringify(updated, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    const cascadedOut = cascadedPeriods.length > 0
      ? JSON.parse(JSON.stringify(cascadedPeriods, (_, v) => (typeof v === 'bigint' ? v.toString() : v)))
      : [];
    return NextResponse.json({ workPeriod: out, cascadedPeriods: cascadedOut });
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

    const [incomesCount, invoicesCount] = await Promise.all([
      prisma.income.count({ where: { workPeriodId: id } }),
      prisma.invoice.count({ where: { workPeriodId: id } }),
    ]);
    if (incomesCount > 0) {
      return NextResponse.json(
        { error: 'Удаление невозможно: к этому периоду привязаны доходы в разделе «Доходы». Сначала отвяжите или удалите их.' },
        { status: 400 }
      );
    }
    if (invoicesCount > 0) {
      return NextResponse.json(
        { error: 'Удаление невозможно: к этому периоду привязаны счета. Удаление периода приведёт к удалению счетов.' },
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
