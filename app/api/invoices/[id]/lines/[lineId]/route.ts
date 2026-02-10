import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import type { SessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import { deleteInvoicePdfFile } from '@/lib/invoice-pdf';

async function canAccessInvoiceLine(user: SessionUser, invoiceId: string): Promise<boolean> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      workPeriod: {
        include: {
          service: {
            include: { site: { include: { client: true } } },
          },
        },
      },
      lines: {
        include: {
          workPeriod: {
            include: {
              service: {
                include: { site: { include: { client: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!invoice) return false;
  const canMain = await canAccessServiceForPeriods(
    user,
    invoice.workPeriod.service.site.accountManagerId,
    invoice.workPeriod.service.site.client.sellerEmployeeId
  );
  if (canMain) return true;
  for (const l of invoice.lines) {
    const can = await canAccessServiceForPeriods(
      user,
      l.workPeriod.service.site.accountManagerId,
      l.workPeriod.service.site.client.sellerEmployeeId
    );
    if (can) return true;
  }
  return false;
}

/**
 * DELETE /api/invoices/[id]/lines/[lineId] — удалить строку из счёта. Если строка была единственной — удаляется весь счёт.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId, lineId } = await params;
    const line = await prisma.invoiceLine.findFirst({ where: { id: lineId, invoiceId } });
    if (!line) return NextResponse.json({ error: 'Строка счёта не найдена' }, { status: 404 });

    const allowed = await canAccessInvoiceLine(user, invoiceId);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { select: { id: true } } },
    });
    if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 });

    const lineCount = invoice.lines.length;
    if (lineCount <= 1) {
      deleteInvoicePdfFile(invoiceId);
      await prisma.invoice.delete({ where: { id: invoiceId } });
      return NextResponse.json({ deletedLine: true, deletedInvoice: true });
    }
    await prisma.invoiceLine.delete({ where: { id: lineId } });
    const newTotal = await prisma.invoiceLine.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    });
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { amount: newTotal._sum.amount ?? BigInt(0) },
    });
    return NextResponse.json({ deletedLine: true, deletedInvoice: false });
  } catch (e: any) {
    console.error('DELETE invoices/[id]/lines/[lineId]', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

/**
 * PATCH /api/invoices/[id]/lines/[lineId] — изменить название услуги/сайта в строке счёта.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId, lineId } = await params;
    const line = await prisma.invoiceLine.findFirst({ where: { id: lineId, invoiceId } });
    if (!line) return NextResponse.json({ error: 'Строка счёта не найдена' }, { status: 404 });

    const allowed = await canAccessInvoiceLine(user, invoiceId);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { serviceNameOverride, siteNameOverride, periodOverride } = body;

    const updateData: { serviceNameOverride?: string | null; siteNameOverride?: string | null; periodOverride?: string | null } = {};
    if (serviceNameOverride !== undefined) updateData.serviceNameOverride = serviceNameOverride ? String(serviceNameOverride).trim() : null;
    if (siteNameOverride !== undefined) updateData.siteNameOverride = siteNameOverride ? String(siteNameOverride).trim() : null;
    if (periodOverride !== undefined) updateData.periodOverride = periodOverride ? String(periodOverride).trim() : null;

    const updated = await prisma.invoiceLine.update({
      where: { id: lineId },
      data: updateData,
      include: { workPeriod: { include: { service: { include: { product: { select: { name: true } }, site: { select: { title: true } } } } } } },
    });

    const out = JSON.parse(JSON.stringify(updated, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ line: out });
  } catch (e: any) {
    console.error('PATCH invoices/[id]/lines/[lineId]', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
