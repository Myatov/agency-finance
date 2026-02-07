import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workPeriodId = request.nextUrl.searchParams.get('workPeriodId');
    if (!workPeriodId) {
      return NextResponse.json({ error: 'workPeriodId is required' }, { status: 400 });
    }

    const period = await prisma.workPeriod.findUnique({
      where: { id: workPeriodId },
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

    const invoices = await prisma.invoice.findMany({
      where: { workPeriodId },
      include: {
        payments: true,
        legalEntity: { select: { id: true, name: true } },
      },
    });

    const out = JSON.parse(JSON.stringify(invoices, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ invoices: out });
  } catch (e: any) {
    console.error('GET invoices', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      workPeriodId,
      amount,
      coverageFrom,
      coverageTo,
      invoiceNumber,
      legalEntityId,
      invoiceNotRequired,
    } = body;

    if (!workPeriodId || amount === undefined || !legalEntityId) {
      return NextResponse.json({ error: 'workPeriodId, amount, legalEntityId are required' }, { status: 400 });
    }

    const period = await prisma.workPeriod.findUnique({
      where: { id: workPeriodId },
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

    const legalEntity = await prisma.legalEntity.findUnique({
      where: { id: legalEntityId },
    });
    if (!legalEntity) return NextResponse.json({ error: 'Legal entity not found' }, { status: 404 });

    const amountBigInt = BigInt(Math.round(parseFloat(String(amount)) * 100));

    const invoice = await prisma.invoice.create({
      data: {
        workPeriodId,
        amount: amountBigInt,
        coverageFrom: coverageFrom ? new Date(coverageFrom) : null,
        coverageTo: coverageTo ? new Date(coverageTo) : null,
        invoiceNumber: invoiceNumber && String(invoiceNumber).trim() ? String(invoiceNumber).trim() : null,
        legalEntityId,
        generateClosingDocsAtInvoice: legalEntity.generateClosingDocs,
        closingDocPerInvoiceAtInvoice: legalEntity.closingDocPerInvoice,
        invoiceNotRequired: Boolean(invoiceNotRequired),
        createdByUserId: user.id,
      },
      include: {
        payments: true,
        legalEntity: { select: { id: true, name: true } },
      },
    });

    const out = JSON.parse(JSON.stringify(invoice, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ invoice: out });
  } catch (e: any) {
    console.error('POST invoices', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
