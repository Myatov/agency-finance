import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';

function getInvoiceClientId(invoice: {
  workPeriod: { service: { site: { clientId: string } } };
  lines: { workPeriod: { service: { site: { clientId: string } } } }[];
}): string {
  return invoice.workPeriod?.service?.site?.clientId ?? invoice.lines[0]?.workPeriod?.service?.site?.clientId ?? '';
}

/**
 * POST /api/invoices/[id]/lines — добавить строку в счёт (период + сумма).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId } = await params;
    const body = await request.json();
    const { workPeriodId, amount } = body;

    if (!workPeriodId || amount === undefined) {
      return NextResponse.json({ error: 'workPeriodId and amount are required' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        workPeriod: { include: { service: { include: { site: { include: { client: true } } } } } },
        lines: { include: { workPeriod: { include: { service: { include: { site: true } } } } } },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 });

    const canAccessInvoice = await canAccessServiceForPeriods(
      user,
      invoice.workPeriod.service.site.accountManagerId,
      invoice.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccessInvoice) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const period = await prisma.workPeriod.findUnique({
      where: { id: workPeriodId },
      include: { service: { include: { site: { include: { client: true } } } } },
    });
    if (!period) return NextResponse.json({ error: 'Период не найден' }, { status: 404 });

    const canAccessPeriod = await canAccessServiceForPeriods(
      user,
      period.service.site.accountManagerId,
      period.service.site.client.sellerEmployeeId
    );
    if (!canAccessPeriod) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const invoiceClientId = getInvoiceClientId(invoice);
    if (period.service.site.clientId !== invoiceClientId) {
      return NextResponse.json({ error: 'Период должен относиться к тому же клиенту, что и счёт' }, { status: 400 });
    }

    const already = await prisma.invoiceLine.findFirst({ where: { invoiceId, workPeriodId } });
    if (already) return NextResponse.json({ error: 'Этот период уже добавлен в счёт' }, { status: 400 });

    const amountBigInt = BigInt(Math.round(parseFloat(String(amount)) * 100));
    const maxOrder = await prisma.invoiceLine.findMany({ where: { invoiceId }, select: { sortOrder: true }, orderBy: { sortOrder: 'desc' }, take: 1 }).then((r) => r[0]?.sortOrder ?? -1);

    const newLine = await prisma.invoiceLine.create({
      data: {
        invoiceId,
        workPeriodId,
        amount: amountBigInt,
        sortOrder: maxOrder + 1,
      },
      include: { workPeriod: { include: { service: { include: { product: { select: { name: true } }, site: { select: { title: true } } } } } } },
    });

    const lines = await prisma.invoiceLine.findMany({ where: { invoiceId }, select: { amount: true } });
    const newTotal = lines.reduce((s, l) => s + l.amount, BigInt(0));
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { amount: newTotal },
    });

    const out = JSON.parse(JSON.stringify(newLine, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ line: out });
  } catch (e: any) {
    console.error('POST invoices/[id]/lines', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
