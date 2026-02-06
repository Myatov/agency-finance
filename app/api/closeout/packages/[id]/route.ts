import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, hasViewAllPermission } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canView = await hasPermission(user, 'closeout', 'view') || await hasPermission(user, 'storage', 'view');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pkg = await prisma.closeoutPackage.findUnique({
      where: { id: params.id },
      include: {
        client: { select: { id: true, name: true, sellerEmployeeId: true } },
        site: { select: { id: true, title: true } },
        service: { select: { id: true } },
        documents: true,
      },
    });
    if (!pkg) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'closeout');
    if (!viewAll && pkg.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { sellerEmployeeId: _, ...clientSafe } = pkg.client;
    const docs = pkg.documents.map((d) => ({
      ...d,
      docDate: d.docDate?.toISOString?.() ?? null,
      uploadedAt: d.uploadedAt?.toISOString?.() ?? null,
      amount: d.amount?.toString?.() ?? null,
    }));
    return NextResponse.json({
      package: {
        ...pkg,
        client: clientSafe,
        documents: docs,
        amount: pkg.amount?.toString?.() ?? null,
      },
    });
  } catch (error) {
    console.error('Error fetching closeout package:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canEdit = await hasPermission(user, 'closeout', 'edit') || await hasPermission(user, 'closeout', 'create')
      || await hasPermission(user, 'storage', 'view');
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pkg = await prisma.closeoutPackage.findUnique({
      where: { id: params.id },
      include: { client: { select: { sellerEmployeeId: true } } },
    });
    if (!pkg) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'closeout');
    if (!viewAll && pkg.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const update: any = {};
    if (body.period !== undefined) update.period = String(body.period).trim();
    if (body.periodType !== undefined && ['MONTH', 'STAGE', 'ONE_TIME'].includes(body.periodType)) update.periodType = body.periodType;
    if (body.status !== undefined && ['PREPARING', 'SENT', 'SIGNED'].includes(body.status)) update.status = body.status;
    if (body.amount !== undefined) update.amount = body.amount != null ? BigInt(String(body.amount)) : null;
    if (body.siteId !== undefined) update.siteId = body.siteId || null;
    if (body.serviceId !== undefined) update.serviceId = body.serviceId || null;

    const updated = await prisma.closeoutPackage.update({
      where: { id: params.id },
      data: update,
      include: { client: { select: { id: true, name: true } } },
    });
    return NextResponse.json({
      package: { ...updated, amount: updated.amount?.toString?.() ?? null },
    });
  } catch (error) {
    console.error('Error updating closeout package:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canDelete = await hasPermission(user, 'closeout', 'delete') || await hasPermission(user, 'closeout', 'manage')
      || await hasPermission(user, 'storage', 'view');
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pkg = await prisma.closeoutPackage.findUnique({
      where: { id: params.id },
      include: { client: { select: { sellerEmployeeId: true } } },
    });
    if (!pkg) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'closeout');
    if (!viewAll && pkg.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.closeoutPackage.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting closeout package:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
