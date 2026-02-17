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
    const report = await prisma.workPeriodReport.findUnique({
      where: { id },
      include: {
        workPeriod: {
          include: {
            service: { include: { site: { include: { client: true } } } },
          },
        },
        accountManager: { select: { id: true, fullName: true } },
      },
    });

    if (!report) return NextResponse.json({ error: 'Period report not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      report.workPeriod.service.site.client.accountManagerId,
      report.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const out = JSON.parse(JSON.stringify(report, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ periodReport: out });
  } catch (e: any) {
    console.error('GET period-reports/[id]', e);
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
    const report = await prisma.workPeriodReport.findUnique({
      where: { id },
      include: {
        workPeriod: {
          include: {
            service: { include: { site: { include: { client: true } } } },
          },
        },
      },
    });

    if (!report) return NextResponse.json({ error: 'Period report not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      report.workPeriod.service.site.client.accountManagerId,
      report.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { deletePeriodReportFile } = await import('@/lib/storage');
    await deletePeriodReportFile(report.filePath).catch(() => {});
    await prisma.workPeriodReport.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE period-reports/[id]', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
