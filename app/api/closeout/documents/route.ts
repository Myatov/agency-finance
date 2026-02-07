import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, hasViewAllPermission, canAccessServiceForPeriods } from '@/lib/permissions';
import { saveCloseoutFile } from '@/lib/storage';

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

    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId') || undefined;
    const packageId = searchParams.get('packageId') || undefined;
    const workPeriodId = searchParams.get('workPeriodId') || undefined;
    const period = searchParams.get('period') || undefined;
    const docType = searchParams.get('docType') || undefined;
    const status = searchParams.get('status') as 'DRAFT' | 'SIGNED' | undefined;

    const viewAll = await hasViewAllPermission(user, 'closeout');
    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (packageId) where.packageId = packageId;
    if (workPeriodId) where.workPeriodId = workPeriodId;
    if (period) where.period = period;
    if (docType && ['ACT', 'INVOICE', 'SF', 'UPD', 'RECONCILIATION', 'REPORT', 'OTHER'].includes(docType)) where.docType = docType;
    if (status) where.status = status;
    const clientWhere: any = {};
    if (!viewAll) clientWhere.sellerEmployeeId = user.id;
    if (Object.keys(clientWhere).length) where.client = clientWhere;

    const docs = await prisma.closeoutDocument.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        uploader: { select: { id: true, fullName: true } },
        package: { select: { id: true, period: true, status: true } },
      },
      orderBy: [{ period: 'desc' }, { uploadedAt: 'desc' }],
    });

    return NextResponse.json({
      documents: docs.map((d) => ({
        ...d,
        docDate: d.docDate?.toISOString?.() ?? null,
        uploadedAt: d.uploadedAt?.toISOString?.() ?? null,
        amount: d.amount?.toString?.() ?? null,
      })),
    });
  } catch (error) {
    console.error('Error fetching closeout documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const clientId = formData.get('clientId') as string | null;
    const packageId = (formData.get('packageId') as string) || null;
    const workPeriodId = (formData.get('workPeriodId') as string) || null;
    const period = (formData.get('period') as string) || null;
    const docType = (formData.get('docType') as string) || 'ACT';
    const docDateStr = (formData.get('docDate') as string) || null;
    const amountStr = (formData.get('amount') as string) || null;
    const status = (formData.get('status') as string) || 'DRAFT';
    const comment = (formData.get('comment') as string) || null;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    let canUpload = false;
    if (workPeriodId) {
      const workPeriod = await prisma.workPeriod.findUnique({
        where: { id: workPeriodId },
        include: { service: { include: { site: { include: { client: true } } } } },
      });
      if (workPeriod && workPeriod.service.site.client.id === clientId) {
        const access = await canAccessServiceForPeriods(
          user,
          workPeriod.service.site.accountManagerId,
          workPeriod.service.site.client.sellerEmployeeId
        );
        if (access) canUpload = true;
      }
    }
    if (!canUpload) {
      const canCreate = await hasPermission(user, 'closeout', 'create') || await hasPermission(user, 'closeout', 'edit')
        || await hasPermission(user, 'storage', 'view');
      if (!canCreate) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const viewAll = await hasViewAllPermission(user, 'closeout');
      if (!viewAll && client.sellerEmployeeId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const periodResolved = period || (packageId ? (await prisma.closeoutPackage.findUnique({ where: { id: packageId }, select: { period: true } }))?.period : null) || '';
    const buffer = Buffer.from(await file.arrayBuffer());
    const relativePath = await saveCloseoutFile(buffer, clientId, file.name);
    type DocType = 'ACT' | 'INVOICE' | 'SF' | 'UPD' | 'RECONCILIATION' | 'REPORT' | 'OTHER';
    const validDocTypes: DocType[] = ['ACT', 'INVOICE', 'SF', 'UPD', 'RECONCILIATION', 'REPORT', 'OTHER'];
    const resolvedDocType: DocType = validDocTypes.includes(docType as DocType) ? (docType as DocType) : 'ACT';
    const validStatuses = ['DRAFT', 'SIGNED'] as const;
    const resolvedStatus = validStatuses.includes(status as any) ? (status as (typeof validStatuses)[number]) : 'DRAFT';
    const doc = await prisma.closeoutDocument.create({
      data: {
        packageId: packageId || undefined,
        workPeriodId: workPeriodId || undefined,
        clientId,
        period: periodResolved,
        docType: resolvedDocType,
        filePath: relativePath,
        originalName: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size,
        docDate: docDateStr ? new Date(docDateStr) : null,
        amount: amountStr ? BigInt(amountStr) : null,
        status: resolvedStatus,
        comment: comment || undefined,
        uploadedById: user.id,
      },
      include: {
        client: { select: { id: true, name: true } },
        uploader: { select: { id: true, fullName: true } },
        package: { select: { id: true, period: true } },
      },
    });

    return NextResponse.json({
      document: {
        ...doc,
        docDate: doc.docDate?.toISOString?.() ?? null,
        uploadedAt: doc.uploadedAt?.toISOString?.() ?? null,
        amount: doc.amount?.toString?.() ?? null,
      },
    });
  } catch (error) {
    console.error('Error uploading closeout document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
