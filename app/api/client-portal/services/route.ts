import { NextResponse } from 'next/server';
import { getClientPortalSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getClientPortalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const services = await prisma.service.findMany({
    where: { site: { clientId: session.clientId } },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      billingType: true,
      price: true,
      product: { select: { name: true } },
      site: { select: { id: true, title: true } },
    },
    orderBy: { startDate: 'desc' },
  });
  return NextResponse.json({
    services: services.map((s) => ({
      id: s.id,
      status: s.status,
      startDate: s.startDate,
      endDate: s.endDate,
      billingType: s.billingType,
      price: s.price != null ? Number(s.price) : null,
      productName: s.product.name,
      siteId: s.site.id,
      siteTitle: s.site.title,
    })),
  });
}
