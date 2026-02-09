import { NextResponse } from 'next/server';
import { getClientPortalSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getClientPortalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Счета клиента: по главному периоду или по любой строке (1 счёт = несколько услуг)
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { workPeriod: { service: { site: { clientId: session.clientId } } } },
        { lines: { some: { workPeriod: { service: { site: { clientId: session.clientId } } } } } },
      ],
    },
    select: {
      id: true,
      amount: true,
      coverageFrom: true,
      coverageTo: true,
      invoiceNumber: true,
      publicToken: true,
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
      lines: {
        include: {
          workPeriod: {
            select: {
              dateFrom: true,
              dateTo: true,
              service: {
                select: {
                  product: { select: { name: true } },
                  site: { select: { title: true, clientId: true } },
                },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({
    invoices: invoices.map((inv) => {
      const clientLine = inv.lines?.find(
        (l) => l.workPeriod?.service?.site?.clientId === session.clientId
      );
      const wp = clientLine?.workPeriod ?? inv.workPeriod;
      return {
        id: inv.id,
        amount: Number(inv.amount),
        coverageFrom: inv.coverageFrom,
        coverageTo: inv.coverageTo,
        invoiceNumber: inv.invoiceNumber,
        publicToken: inv.publicToken,
        createdAt: inv.createdAt,
        legalEntityName: inv.legalEntity.name,
        periodFrom: wp?.dateFrom ?? null,
        periodTo: wp?.dateTo ?? null,
        productName: wp?.service?.product?.name ?? '—',
        siteTitle: wp?.service?.site?.title ?? '—',
        lineCount: inv.lines?.length ?? 0,
      };
    }),
  });
}
