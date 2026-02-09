import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';

function getPdfDir(): string {
  const env = process.env.INVOICE_PDF_DIR;
  if (env?.trim()) return env;
  return path.join(process.cwd(), 'invoices-pdf');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        pdfGeneratedAt: true,
        invoiceNumber: true,
        publicToken: true,
        workPeriod: {
          include: {
            service: {
              include: {
                site: {
                  include: {
                    client: { select: { sellerEmployeeId: true } },
                  },
                },
              },
            },
          },
        },
        lines: {
          include: {
            workPeriod: {
              include: {
                service: {
                  include: {
                    site: {
                      include: {
                        client: { select: { sellerEmployeeId: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 });
    if (!invoice.pdfGeneratedAt) {
      return NextResponse.json({ error: 'PDF ещё не сформирован' }, { status: 404 });
    }

    const token = request.nextUrl?.searchParams?.get('token');
    const publicAccess = token && invoice.publicToken && token === invoice.publicToken;
    if (!publicAccess) {
      const user = await getSession();
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      let canAccess = await canAccessServiceForPeriods(
        user,
        invoice.workPeriod.service.site.accountManagerId,
        invoice.workPeriod.service.site.client.sellerEmployeeId
      );
      if (!canAccess && invoice.lines?.length) {
        for (const l of invoice.lines) {
          canAccess = await canAccessServiceForPeriods(
            user,
            l.workPeriod.service.site.accountManagerId,
            l.workPeriod.service.site.client.sellerEmployeeId
          );
          if (canAccess) break;
        }
      }
      if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dir = getPdfDir();
    const filePath = path.join(dir, `${id}.pdf`);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Файл PDF не найден' }, { status: 404 });
    }
    const buf = fs.readFileSync(filePath);
    const safeName = (invoice.invoiceNumber || id).replace(/[^\w\-.\s]/gi, '-').replace(/\s+/g, '_');
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(safeName + '.pdf')}"`,
        'Content-Length': String(buf.length),
      },
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('GET invoices/[id]/pdf', e);
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message },
      { status: 500 }
    );
  }
}
