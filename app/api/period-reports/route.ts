import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import { savePeriodReportFile } from '@/lib/storage';
import { PeriodReportPaymentType } from '@prisma/client';

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

    const report = await prisma.workPeriodReport.findUnique({
      where: { workPeriodId },
      include: { accountManager: { select: { id: true, fullName: true } } },
    });

    if (!report) return NextResponse.json({ periodReport: null });

    const out = JSON.parse(JSON.stringify(report, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ periodReport: out });
  } catch (e: any) {
    console.error('GET period-reports', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const workPeriodId = formData.get('workPeriodId') as string | null;
    const paymentType = formData.get('paymentType') as string | null;

    if (!workPeriodId) return NextResponse.json({ error: 'workPeriodId is required' }, { status: 400 });
    if (!file || !(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'File is required' }, { status: 400 });
    const validTypes: PeriodReportPaymentType[] = ['PREPAY', 'POSTPAY', 'FRACTIONAL'];
    if (!paymentType || !validTypes.includes(paymentType as PeriodReportPaymentType)) {
      return NextResponse.json({ error: 'paymentType must be PREPAY, POSTPAY or FRACTIONAL' }, { status: 400 });
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

    const existing = await prisma.workPeriodReport.findUnique({
      where: { workPeriodId },
    });
    if (existing) {
      return NextResponse.json({ error: 'Report for this period already exists. Delete it first to replace.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const relativePath = await savePeriodReportFile(buffer, workPeriodId, file.name);

    const report = await prisma.workPeriodReport.create({
      data: {
        workPeriodId,
        filePath: relativePath,
        originalName: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size,
        paymentType: paymentType as PeriodReportPaymentType,
        accountManagerId: user.id,
      },
      include: { accountManager: { select: { id: true, fullName: true } } },
    });

    const out = JSON.parse(JSON.stringify(report, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ periodReport: out });
  } catch (e: any) {
    console.error('POST period-reports', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
