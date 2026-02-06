import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, hasViewAllPermission } from '@/lib/permissions';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canEdit = await hasPermission(user, 'contracts', 'edit') || await hasPermission(user, 'contracts', 'create')
      || await hasPermission(user, 'storage', 'view');
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const section = await prisma.contractSection.findFirst({
      where: { id: params.sectionId, contractId: params.id },
      include: { contract: { include: { client: { select: { sellerEmployeeId: true } } } } },
    });
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'contracts');
    if (!viewAll && section.contract.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const update: any = {};
    if (body.title !== undefined) update.title = String(body.title).trim();
    if (body.comment !== undefined) update.comment = body.comment || null;
    if (body.siteId !== undefined) update.siteId = body.siteId || null;
    if (body.serviceId !== undefined) update.serviceId = body.serviceId || null;

    const updated = await prisma.contractSection.update({
      where: { id: params.sectionId },
      data: update,
      include: { site: { select: { id: true, title: true } } },
    });

    return NextResponse.json({ section: updated });
  } catch (error) {
    console.error('Error updating section:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canEdit = await hasPermission(user, 'contracts', 'edit') || await hasPermission(user, 'contracts', 'delete')
      || await hasPermission(user, 'storage', 'view');
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const section = await prisma.contractSection.findFirst({
      where: { id: params.sectionId, contractId: params.id },
      include: { contract: { include: { client: { select: { sellerEmployeeId: true } } } } },
    });
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'contracts');
    if (!viewAll && section.contract.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.contractSection.delete({ where: { id: params.sectionId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting section:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
