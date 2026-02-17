import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';

/**
 * GET /api/work-periods/[id]/available-invoices
 * Счета того же клиента, в которые можно добавить текущий период строкой (для кнопки «Добавить в счёт»).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: workPeriodId } = await params;
    const period = await prisma.workPeriod.findUnique({
      where: { id: workPeriodId },
      include: {
        service: { include: { site: { include: { client: true } } } },
      },
    });
    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      period.service.site.client.accountManagerId,
      period.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const clientId = period.service.site.clientId;
    const alreadyLinked = await prisma.invoiceLine.findMany({ where: { workPeriodId }, select: { invoiceId: true } }).then((rows) => rows.map((r) => r.invoiceId));

    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { workPeriod: { service: { site: { clientId } } } },
          { lines: { some: { workPeriod: { service: { site: { clientId } } } } } },
        ],
        ...(alreadyLinked.length > 0 ? { id: { notIn: alreadyLinked } } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        legalEntity: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const out = JSON.parse(JSON.stringify(invoices, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ invoices: out });
  } catch (e: any) {
    console.error('GET available-invoices', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
