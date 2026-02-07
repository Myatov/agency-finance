import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const invoiceId = request.nextUrl.searchParams.get('invoiceId');
    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        workPeriod: {
          include: {
            service: { include: { site: { include: { client: true } } } },
          },
        },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      invoice.workPeriod.service.site.accountManagerId,
      invoice.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const payments = await prisma.payment.findMany({
      where: { invoiceId },
      include: { creator: { select: { id: true, fullName: true } } },
      orderBy: { paidAt: 'desc' },
    });

    const out = JSON.parse(JSON.stringify(payments, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ payments: out });
  } catch (e: any) {
    console.error('GET payments', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { invoiceId, amount, paidAt, comment } = body;

    if (!invoiceId || amount === undefined) {
      return NextResponse.json({ error: 'invoiceId and amount are required' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        workPeriod: {
          include: {
            service: { include: { site: { include: { client: true } } } },
          },
        },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      invoice.workPeriod.service.site.accountManagerId,
      invoice.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const amountBigInt = BigInt(Math.round(parseFloat(String(amount)) * 100));

    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount: amountBigInt,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        comment: comment && String(comment).trim() ? String(comment).trim() : null,
        createdByUserId: user.id,
      },
      include: { creator: { select: { id: true, fullName: true } } },
    });

    const out = JSON.parse(JSON.stringify(payment, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ payment: out });
  } catch (e: any) {
    console.error('POST payments', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
