import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, hasViewAllPermission } from '@/lib/permissions';
import { contractFilePath } from '@/lib/storage';
import fs from 'fs/promises';

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
      include: { client: { select: { sellerEmployeeId: true } } },
    });
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const viewAll = await hasViewAllPermission(user, 'contracts');
    if (!viewAll && doc.client.sellerEmployeeId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const fullPath = contractFilePath(doc.filePath);
    let buf: Buffer;
    try {
      buf = await fs.readFile(fullPath);
    } catch (e: any) {
      if (e?.code === 'ENOENT') {
        return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
      }
      throw e;
    }
    const mime = doc.mimeType || 'application/octet-stream';
    const name = doc.originalName || 'document';

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
        'Content-Length': String(buf.length),
      },
    });
  } catch (error) {
    console.error('Error downloading contract:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
