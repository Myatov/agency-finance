import { NextRequest, NextResponse } from 'next/server';
import { getSession, type SessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';

async function canAccessInvoiceLine(user: SessionUser, invoiceId: string): Promise<boolean> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      workPeriod: { include: { service: { include: { site: { include: { client: true } } } } } },
      lines: { include: { workPeriod: { include: { service: { include: { site: { include: { client: true } } } } } } } } },
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
    const { serviceNameOverride, siteNameOverride } = body;

    const updateData: { serviceNameOverride?: string | null; siteNameOverride?: string | null } = {};
    if (serviceNameOverride !== undefined) updateData.serviceNameOverride = serviceNameOverride ? String(serviceNameOverride).trim() : null;
    if (siteNameOverride !== undefined) updateData.siteNameOverride = siteNameOverride ? String(siteNameOverride).trim() : null;

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
