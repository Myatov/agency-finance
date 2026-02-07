import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, hasViewAllPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const canView = await hasPermission(user, 'closeout', 'view') || await hasPermission(user, 'storage', 'view');
    if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const viewAll = await hasViewAllPermission(user, 'closeout');
    const serviceWhere: any = {};
    if (!viewAll) {
      serviceWhere.OR = [
        { site: { accountManagerId: user.id } },
        { site: { creatorId: user.id } },
        { responsibleUserId: user.id },
        { site: { client: { sellerEmployeeId: user.id } } },
      ];
    }

    const clientId = request.nextUrl.searchParams.get('clientId') || undefined;
    const whereService: any = clientId
      ? { AND: [serviceWhere, { site: { clientId } }] }
      : serviceWhere;

    const periods = await prisma.workPeriod.findMany({
      where: { service: whereService },
      include: {
        service: {
          include: {
            site: {
              include: {
                client: { select: { id: true, name: true } },
              },
            },
            product: { select: { name: true } },
          },
        },
        closeoutDocuments: {
          select: { id: true, originalName: true, docType: true, uploadedAt: true },
        },
      },
      orderBy: { dateFrom: 'desc' },
      take: 500,
    });

    const out = periods.map((p) => ({
      id: p.id,
      dateFrom: p.dateFrom.toISOString().slice(0, 10),
      dateTo: p.dateTo.toISOString().slice(0, 10),
      client: p.service.site.client,
      siteTitle: p.service.site.title,
      productName: p.service.product.name,
      serviceId: p.service.id,
      closeoutDocuments: (p.closeoutDocuments || []).map((d) => ({
        id: d.id,
        originalName: d.originalName,
        docType: d.docType,
        uploadedAt: d.uploadedAt?.toISOString?.() ?? null,
      })),
    }));

    return NextResponse.json({ periods: out });
  } catch (e: any) {
    console.error('GET closeout/periods', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
