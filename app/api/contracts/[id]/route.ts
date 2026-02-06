import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, hasViewAllPermission } from '@/lib/permissions';
import { saveContractFile, deleteContractFile } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canView = await hasPermission(user, 'contracts', 'view') || await hasPermission(user, 'storage', 'view');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const doc = await prisma.contractDocument.findUnique({
      where: { id: params.id },
      include: {
        client: { select: { id: true, name: true, sellerEmployeeId: true } },
        uploader: { select: { id: true, fullName: true } },
        site: { select: { id: true, title: true } },
        sections: true,
        children: {
          include: {
            uploader: { select: { id: true, fullName: true } },
            site: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const viewAll = await hasViewAllPermission(user, 'contracts');
    if (!viewAll && doc.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serialize = (d: any) => ({
      ...d,
      docDate: d.docDate?.toISOString?.() ?? null,
      endDate: d.endDate?.toISOString?.() ?? null,
      uploadedAt: d.uploadedAt?.toISOString?.() ?? null,
    });

    const { sellerEmployeeId: _, ...clientSafe } = doc.client;
    return NextResponse.json({
      contract: serialize({
        ...doc,
        client: clientSafe,
        children: doc.children.map((c) => serialize({ ...c, uploader: c.uploader, site: c.site })),
      }),
    });
  } catch (error) {
    console.error('Error fetching contract:', error);
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
    const canEdit = await hasPermission(user, 'contracts', 'edit') || await hasPermission(user, 'contracts', 'create')
      || await hasPermission(user, 'storage', 'view');
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const doc = await prisma.contractDocument.findUnique({
      where: { id: params.id },
      include: { client: { select: { sellerEmployeeId: true } } },
    });
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'contracts');
    if (!viewAll && doc.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const update: any = {};
    if (body.docNumber !== undefined) update.docNumber = body.docNumber || null;
    if (body.docDate !== undefined) update.docDate = body.docDate ? new Date(body.docDate) : null;
    if (body.endDate !== undefined) update.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.comment !== undefined) update.comment = body.comment || null;
    if (body.tags !== undefined) update.tags = body.tags || null;
    if (body.status !== undefined && ['ACTIVE', 'CLOSED'].includes(body.status)) update.status = body.status;
    if (body.siteId !== undefined) update.siteId = body.siteId || null;

    const updated = await prisma.contractDocument.update({
      where: { id: params.id },
      data: update,
      include: {
        client: { select: { id: true, name: true } },
        uploader: { select: { id: true, fullName: true } },
        site: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({
      contract: {
        ...updated,
        docDate: updated.docDate?.toISOString?.() ?? null,
        endDate: updated.endDate?.toISOString?.() ?? null,
        uploadedAt: updated.uploadedAt?.toISOString?.() ?? null,
      },
    });
  } catch (error) {
    console.error('Error updating contract:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
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
      return NextResponse.json({ 
        error: 'Недостаточно прав для замены файла. Обратитесь к администратору.' 
      }, { status: 403 });
    }

    const doc = await prisma.contractDocument.findUnique({
      where: { id: params.id },
      include: { client: { select: { sellerEmployeeId: true } } },
    });
    if (!doc) {
      return NextResponse.json({ error: 'Договор не найден' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'contracts');
    if (!viewAll && doc.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ 
        error: 'Недостаточно прав для замены файла этого договора. Вы можете заменять файлы только для своих клиентов.' 
      }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Удаляем старый файл
    await deleteContractFile(doc.filePath);

    // Сохраняем новый файл
    const buffer = Buffer.from(await file.arrayBuffer());
    const relativePath = await saveContractFile(buffer, doc.clientId, file.name);
    const mimeType = file.type || null;

    // Обновляем запись в БД
    const updated = await prisma.contractDocument.update({
      where: { id: params.id },
      data: {
        filePath: relativePath,
        originalName: file.name,
        mimeType,
        sizeBytes: file.size,
        uploadedById: user.id,
        uploadedAt: new Date(),
      },
      include: {
        client: { select: { id: true, name: true } },
        uploader: { select: { id: true, fullName: true } },
        site: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({
      contract: {
        ...updated,
        docDate: updated.docDate?.toISOString?.() ?? null,
        endDate: updated.endDate?.toISOString?.() ?? null,
        uploadedAt: updated.uploadedAt?.toISOString?.() ?? null,
      },
    });
  } catch (error) {
    console.error('Error replacing contract file:', error);
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
    const canDelete = await hasPermission(user, 'contracts', 'delete') || await hasPermission(user, 'contracts', 'manage')
      || await hasPermission(user, 'storage', 'view');
    if (!canDelete) {
      return NextResponse.json({ 
        error: 'Недостаточно прав для удаления договора. Обратитесь к администратору.' 
      }, { status: 403 });
    }

    const doc = await prisma.contractDocument.findUnique({
      where: { id: params.id },
      include: { client: { select: { sellerEmployeeId: true } }, children: true },
    });
    if (!doc) {
      return NextResponse.json({ error: 'Договор не найден' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'contracts');
    if (!viewAll && doc.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ 
        error: 'Недостаточно прав для удаления этого договора. Вы можете удалять только договоры своих клиентов.' 
      }, { status: 403 });
    }

    for (const child of doc.children) {
      await deleteContractFile(child.filePath);
      await prisma.contractDocument.delete({ where: { id: child.id } });
    }
    await deleteContractFile(doc.filePath);
    await prisma.contractDocument.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contract:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
