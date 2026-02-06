import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, hasViewAllPermission } from '@/lib/permissions';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const contract = await prisma.contractDocument.findUnique({
      where: { id: params.id },
      include: { client: { select: { sellerEmployeeId: true } } },
    });
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'contracts');
    if (!viewAll && contract.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const title = (body.title as string)?.trim();
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const section = await prisma.contractSection.create({
      data: {
        contractId: params.id,
        title,
        comment: (body.comment as string) || undefined,
        siteId: body.siteId || undefined,
        serviceId: body.serviceId || undefined,
      },
      include: {
        site: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ section });
  } catch (error) {
    console.error('Error creating contract section:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
