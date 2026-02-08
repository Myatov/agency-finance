import { NextResponse } from 'next/server';
import { getClientPortalSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getClientPortalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const client = await prisma.client.findUnique({
    where: { id: session.clientId },
    select: { legalEntityId: true, legalEntity: { select: { generateClosingDocs: true } } },
  });
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  const showClosingDocs = client.legalEntity?.generateClosingDocs === true;
  const documents = showClosingDocs
    ? await prisma.closeoutDocument.findMany({
        where: { clientId: session.clientId },
        select: {
          id: true,
          originalName: true,
          docType: true,
          docDate: true,
          amount: true,
          uploadedAt: true,
          period: true,
        },
        orderBy: { uploadedAt: 'desc' },
      })
    : [];
  return NextResponse.json({
    documents: documents.map((d) => ({
      id: d.id,
      originalName: d.originalName,
      docType: d.docType,
      docDate: d.docDate,
      amount: d.amount != null ? Number(d.amount) : null,
      uploadedAt: d.uploadedAt,
      period: d.period,
    })),
    showClosingDocs,
  });
}
