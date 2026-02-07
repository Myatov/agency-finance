import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import type { SessionUser } from '@/lib/auth';

async function getInvoiceWithAccess(user: SessionUser, id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      workPeriod: {
        include: {
          service: { include: { site: { include: { client: true } } } },
        },
      },
      payments: true,
      legalEntity: { select: { id: true, name: true } },
    },
  });
  if (!invoice) return null;
  const canAccess = await canAccessServiceForPeriods(
    user,
    invoice.workPeriod.service.site.accountManagerId,
    invoice.workPeriod.service.site.client.sellerEmployeeId
  );
  return canAccess ? invoice : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const invoice = await getInvoiceWithAccess(user, id);
    if (invoice === null) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice === undefined) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const out = JSON.parse(JSON.stringify(invoice, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ invoice: out });
  } catch (e: any) {
    console.error('GET invoices/[id]', e);
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
    const invoice = await getInvoiceWithAccess(user, id);
    if (invoice === null) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice === undefined) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { amount, coverageFrom, coverageTo, invoiceNumber, invoiceNotRequired } = body;

    const updateData: any = {};
    if (amount !== undefined) updateData.amount = BigInt(Math.round(parseFloat(String(amount)) * 100));
    if (coverageFrom !== undefined) updateData.coverageFrom = coverageFrom ? new Date(coverageFrom) : null;
    if (coverageTo !== undefined) updateData.coverageTo = coverageTo ? new Date(coverageTo) : null;
    if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber && String(invoiceNumber).trim() ? String(invoiceNumber).trim() : null;
    if (invoiceNotRequired !== undefined) updateData.invoiceNotRequired = Boolean(invoiceNotRequired);

    const updated = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { payments: true, legalEntity: { select: { id: true, name: true } } },
    });

    const out = JSON.parse(JSON.stringify(updated, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ invoice: out });
  } catch (e: any) {
    console.error('PUT invoices/[id]', e);
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
    const invoice = await getInvoiceWithAccess(user, id);
    if (invoice === null) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice === undefined) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.invoice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE invoices/[id]', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
