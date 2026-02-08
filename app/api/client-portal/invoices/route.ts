import { NextResponse } from 'next/server';
import { getClientPortalSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getClientPortalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const invoices = await prisma.invoice.findMany({
    where: {
      workPeriod: {
        service: { site: { clientId: session.clientId } },
      },
    },
    select: {
      id: true,
      amount: true,
      coverageFrom: true,
      coverageTo: true,
      invoiceNumber: true,
      createdAt: true,
      legalEntity: { select: { name: true } },
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
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({
    invoices: invoices.map((inv) => ({
      id: inv.id,
      amount: Number(inv.amount),
      coverageFrom: inv.coverageFrom,
      coverageTo: inv.coverageTo,
      invoiceNumber: inv.invoiceNumber,
      createdAt: inv.createdAt,
      legalEntityName: inv.legalEntity.name,
      periodFrom: inv.workPeriod.dateFrom,
      periodTo: inv.workPeriod.dateTo,
      productName: inv.workPeriod.service.product.name,
      siteTitle: inv.workPeriod.service.site.title,
    })),
  });
}
