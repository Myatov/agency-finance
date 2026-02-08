import { NextRequest, NextResponse } from 'next/server';
import { getClientPortalSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { periodReportFilePath } from '@/lib/storage';
import fs from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getClientPortalSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const report = await prisma.workPeriodReport.findUnique({
      where: { id },
      include: {
        workPeriod: {
          include: { service: { include: { site: { select: { clientId: true } } } } },
        },
      },
    });
    if (!report || report.workPeriod.service.site.clientId !== session.clientId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const fullPath = periodReportFilePath(report.filePath);
    let buf: Buffer;
    try {
      buf = await fs.readFile(fullPath);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
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
  } catch (error) {
    console.error('Client portal report download:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
