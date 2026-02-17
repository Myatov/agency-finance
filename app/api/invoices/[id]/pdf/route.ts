import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import { getPdfDir, deleteInvoicePdfFile } from '@/lib/invoice-pdf';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';

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
                    client: { select: { accountManagerId: true, sellerEmployeeId: true } },
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
                        client: { select: { accountManagerId: true, sellerEmployeeId: true } },
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
        invoice.workPeriod.service.site.client.accountManagerId,
        invoice.workPeriod.service.site.client.sellerEmployeeId
      );
      if (!canAccess && invoice.lines?.length) {
        for (const l of invoice.lines) {
          canAccess = await canAccessServiceForPeriods(
            user,
            l.workPeriod.service.site.client.accountManagerId,
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

/** DELETE /api/invoices/[id]/pdf — удалить сформированный PDF (файл и флаг), после чего в просмотре счёта исчезнут QR и ссылка на PDF. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        pdfGeneratedAt: true,
        workPeriod: {
          include: {
            service: {
              include: {
                site: {
                  include: {
                    client: { select: { accountManagerId: true, sellerEmployeeId: true } },
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
                        client: { select: { accountManagerId: true, sellerEmployeeId: true } },
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

    let canAccess = await canAccessServiceForPeriods(
      user,
      invoice.workPeriod.service.site.client.accountManagerId,
      invoice.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccess && invoice.lines?.length) {
      for (const l of invoice.lines) {
        canAccess = await canAccessServiceForPeriods(
          user,
          l.workPeriod.service.site.client.accountManagerId,
          l.workPeriod.service.site.client.sellerEmployeeId
        );
        if (canAccess) break;
      }
    }
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    deleteInvoicePdfFile(id);
    await prisma.invoice.update({
      where: { id },
      data: { pdfGeneratedAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('DELETE invoices/[id]/pdf', e);
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message },
      { status: 500 }
    );
  }
}
