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

    const doc = await prisma.closeoutDocument.findUnique({
      where: { id: params.id },
      include: { client: { select: { sellerEmployeeId: true } } },
    });
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'closeout');
    if (!viewAll && doc.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      document: {
        ...doc,
        docDate: doc.docDate?.toISOString?.() ?? null,
        uploadedAt: doc.uploadedAt?.toISOString?.() ?? null,
        amount: doc.amount?.toString?.() ?? null,
      },
    });
  } catch (error) {
    console.error('Error fetching closeout document:', error);
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

    const doc = await prisma.closeoutDocument.findUnique({
      where: { id: params.id },
      include: { client: { select: { sellerEmployeeId: true } } },
    });
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'closeout');
    if (!viewAll && doc.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { deleteCloseoutFile } = await import('@/lib/storage');
    await deleteCloseoutFile(doc.filePath);
    await prisma.closeoutDocument.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting closeout document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
