import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            workPeriod: {
              include: {
                service: { include: { site: { include: { client: true } } } },
              },
            },
          },
        },
        creator: { select: { id: true, fullName: true } },
      },
    });

    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      payment.invoice.workPeriod.service.site.client.accountManagerId,
      payment.invoice.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const out = JSON.parse(JSON.stringify(payment, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ payment: out });
  } catch (e: any) {
    console.error('GET payments/[id]', e);
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
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            workPeriod: {
              include: {
                service: { include: { site: { include: { client: true } } } },
              },
            },
          },
        },
      },
    });

    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      payment.invoice.workPeriod.service.site.client.accountManagerId,
      payment.invoice.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.payment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE payments/[id]', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
