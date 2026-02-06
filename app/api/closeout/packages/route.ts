import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, hasViewAllPermission } from '@/lib/permissions';


export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canView = await hasPermission(user, 'closeout', 'view') || await hasPermission(user, 'storage', 'view');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const viewAll = await hasViewAllPermission(user, 'closeout');
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId') || undefined;
    const period = searchParams.get('period') || undefined;
    const status = searchParams.get('status') || undefined;
    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (period) where.period = period;
    if (status && ['PREPARING', 'SENT', 'SIGNED'].includes(status)) where.status = status;
    const clientWhere: any = {};
    if (!viewAll) clientWhere.sellerEmployeeId = user.id;
    if (Object.keys(clientWhere).length) where.client = clientWhere;

    const packages = await prisma.closeoutPackage.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
      },
      orderBy: [{ period: 'desc' }],
    });

    return NextResponse.json({
      packages: packages.map((p) => ({
        ...p,
        amount: p.amount?.toString?.() ?? null,
      })),
    });
  } catch (error) {
    console.error('Error fetching closeout packages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canCreate = await hasPermission(user, 'closeout', 'create') || await hasPermission(user, 'closeout', 'edit')
      || await hasPermission(user, 'storage', 'view');
    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const clientId = body.clientId as string;
    const period = (body.period as string)?.trim();
    if (!clientId || !period) {
      return NextResponse.json({ error: 'clientId and period are required' }, { status: 400 });
    }

    const viewAll = await hasViewAllPermission(user, 'closeout');
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    if (!viewAll && client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const periodType = ['MONTH', 'STAGE', 'ONE_TIME'].includes(body.periodType) ? body.periodType : 'MONTH';
    const amount = body.amount != null ? BigInt(String(body.amount)) : null;
    const status = ['PREPARING', 'SENT', 'SIGNED'].includes(body.status) ? body.status : 'PREPARING';

    const pkg = await prisma.closeoutPackage.create({
      data: {
        clientId,
        siteId: body.siteId || undefined,
        serviceId: body.serviceId || undefined,
        period,
        periodType,
        amount,
        status,
      },
      include: { client: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      package: { ...pkg, amount: pkg.amount?.toString?.() ?? null },
    });
  } catch (error) {
    console.error('Error creating closeout package:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
