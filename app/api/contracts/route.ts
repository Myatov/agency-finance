import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, hasViewAllPermission } from '@/lib/permissions';
import { saveContractFile } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canView = await hasPermission(user, 'contracts', 'view') || await hasPermission(user, 'storage', 'view');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId') || undefined;
    const siteId = searchParams.get('siteId') || undefined;
    const status = searchParams.get('status') as 'ACTIVE' | 'CLOSED' | undefined;
    const legalEntityId = searchParams.get('legalEntityId') || undefined;

    const viewAll = await hasViewAllPermission(user, 'contracts');
    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (siteId) where.siteId = siteId;
    if (status) where.status = status;
    const clientWhere: any = {};
    if (!viewAll) clientWhere.sellerEmployeeId = user.id;
    if (legalEntityId) clientWhere.legalEntityId = legalEntityId;
    if (Object.keys(clientWhere).length) where.client = clientWhere;

    const contracts = await prisma.contractDocument.findMany({
      where: { ...where, parentId: null },
      include: {
        client: { select: { id: true, name: true } },
        uploader: { select: { id: true, fullName: true } },
        site: { select: { id: true, title: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return NextResponse.json({
      contracts: contracts.map((c) => ({
        ...c,
        docDate: c.docDate?.toISOString?.() ?? null,
        endDate: c.endDate?.toISOString?.() ?? null,
        uploadedAt: c.uploadedAt?.toISOString?.() ?? null,
      })),
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const canCreate = await hasPermission(user, 'contracts', 'create') || await hasPermission(user, 'contracts', 'edit')
      || await hasPermission(user, 'storage', 'view');
    if (!canCreate) {
      return NextResponse.json({ 
        error: 'Недостаточно прав для загрузки документов. Обратитесь к администратору для получения прав на создание договоров или просмотр хранилища.' 
      }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const clientId = formData.get('clientId') as string | null;
    const siteId = (formData.get('siteId') as string) || null;
    const type = (formData.get('type') as string) || 'CONTRACT';
    const parentId = (formData.get('parentId') as string) || null;
    const docNumber = (formData.get('docNumber') as string) || null;
    const docDateStr = (formData.get('docDate') as string) || null;
    const endDateStr = (formData.get('endDate') as string) || null;
    const comment = (formData.get('comment') as string) || null;
    const tags = (formData.get('tags') as string) || null;
    const status = (formData.get('status') as string) || 'ACTIVE';

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const viewAll = await hasViewAllPermission(user, 'contracts');
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 });
    }
    if (!viewAll && client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ 
        error: 'Недостаточно прав для загрузки документа для этого клиента. Вы можете загружать документы только для клиентов, назначенных вам.' 
      }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const relativePath = await saveContractFile(buffer, clientId, file.name);
    const mimeType = file.type || null;
    const docDate = docDateStr ? new Date(docDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    const validTypes = ['CONTRACT', 'ADDENDUM', 'NDA', 'OTHER'] as const;
    const validStatuses = ['ACTIVE', 'CLOSED'] as const;
    const docType = validTypes.includes(type as any) ? (type as (typeof validTypes)[number]) : 'CONTRACT';
    const docStatus = validStatuses.includes(status as any) ? (status as (typeof validStatuses)[number]) : 'ACTIVE';

    const doc = await prisma.contractDocument.create({
      data: {
        clientId,
        siteId: siteId || undefined,
        type: docType,
        parentId: parentId || undefined,
        filePath: relativePath,
        originalName: file.name,
        mimeType,
        sizeBytes: file.size,
        docNumber: docNumber || undefined,
        docDate,
        endDate,
        comment: comment || undefined,
        tags: tags || undefined,
        status: docStatus,
        uploadedById: user.id,
      },
      include: {
        client: { select: { id: true, name: true } },
        uploader: { select: { id: true, fullName: true } },
        site: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({
      contract: {
        ...doc,
        docDate: doc.docDate?.toISOString?.() ?? null,
        endDate: doc.endDate?.toISOString?.() ?? null,
        uploadedAt: doc.uploadedAt?.toISOString?.() ?? null,
      },
    });
  } catch (error) {
    console.error('Error uploading contract:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
