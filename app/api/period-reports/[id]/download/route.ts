import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import { periodReportFilePath } from '@/lib/storage';
import fs from 'fs/promises';

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
      },
    });

    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      report.workPeriod.service.site.client.accountManagerId,
      report.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const fullPath = periodReportFilePath(report.filePath);
    let buf: Buffer;
    try {
      buf = await fs.readFile(fullPath);
    } catch (e: any) {
      if (e?.code === 'ENOENT') return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
      throw e;
    }
    const mime = report.mimeType || 'application/octet-stream';
    const name = report.originalName || 'report';

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
        'Content-Length': String(buf.length),
      },
    });
  } catch (e: any) {
    console.error('Download period report', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
