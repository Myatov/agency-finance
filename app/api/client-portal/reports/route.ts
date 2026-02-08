import { NextResponse } from 'next/server';
import { getClientPortalSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getClientPortalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const reports = await prisma.workPeriodReport.findMany({
    where: {
      workPeriod: {
        service: { site: { clientId: session.clientId } },
      },
    },
    select: {
      id: true,
      originalName: true,
      completedAt: true,
      workPeriod: {
        select: {
          dateFrom: true,
          dateTo: true,
          service: {
            select: {
              product: { select: { name: true } },
              site: { select: { title: true } },
            },
          },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
  });
  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      originalName: r.originalName,
      completedAt: r.completedAt,
      periodFrom: r.workPeriod.dateFrom,
      periodTo: r.workPeriod.dateTo,
      productName: r.workPeriod.service.product.name,
      siteTitle: r.workPeriod.service.site.title,
    })),
  });
}
