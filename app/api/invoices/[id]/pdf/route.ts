import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

function toRuDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function line(s: string | null | undefined): string {
  return s != null && s !== '' ? String(s) : '—';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        workPeriod: {
          include: {
            service: {
              include: {
                site: {
                  include: {
                    client: {
                      select: {
                        name: true,
                        sellerEmployeeId: true,
                        legalEntityName: true,
                        legalAddress: true,
                        inn: true,
                        kpp: true,
                        ogrn: true,
                        rs: true,
                        bankName: true,
                        bik: true,
                        ks: true,
                        paymentRequisites: true,
                        contacts: true,
                      },
                    },
                  },
                },
                product: { select: { name: true } },
              },
            },
          },
        },
        legalEntity: true,
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      invoice.workPeriod.service.site.accountManagerId,
      invoice.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const overrideNumber = searchParams.get('invoiceNumber')?.trim();
    const overrideServiceName = searchParams.get('serviceName')?.trim();

    const amountBase = Number(invoice.amount) / 100;
    const amountRub = amountBase.toFixed(2);
    const legal = invoice.legalEntity;
    const vatPercent = legal.vatPercent != null ? Number(legal.vatPercent) : 0;
    const showVat = vatPercent > 0;
    const vatAmount = showVat ? amountBase * (vatPercent / 100) : 0;
    const totalWithVat = showVat ? amountBase + vatAmount : 0;
    const vatRub = vatAmount.toFixed(2);
    const totalWithVatRub = totalWithVat.toFixed(2);
    const dateFrom = invoice.workPeriod.dateFrom;
    const dateTo = invoice.workPeriod.dateTo;
    const periodRu = `${toRuDate(dateFrom)} — ${toRuDate(dateTo)}`;
    const client = invoice.workPeriod.service.site.client;
    const siteTitle = invoice.workPeriod.service.site.title;
    const productName = overrideServiceName ?? invoice.workPeriod.service.product.name;
    const uniqueNum =
      overrideNumber ||
      invoice.invoiceNumber?.trim() ||
      `INV-${dateFrom.toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(-6)}`;

    const payerLines = [
      line(client.name || client.legalEntityName),
      line(client.legalAddress),
      [client.inn, client.kpp].filter(Boolean).join(', ') || '—',
      client.ogrn ? `ОГРН ${client.ogrn}` : '—',
      client.rs ? `Р/с ${client.rs}` : '—',
      line(client.bankName),
      [client.bik, client.ks].filter(Boolean).join(', ') || '—',
      line(client.paymentRequisites),
      line(client.contacts),
    ].filter((s) => s !== '—');

    const recipientLines = [
      line(legal.name),
      line(legal.legalAddress),
      [legal.inn, legal.kpp].filter(Boolean).join(', ') || '—',
      legal.ogrn ? `ОГРН ${legal.ogrn}` : '—',
      legal.rs ? `Р/с ${legal.rs}` : '—',
      line(legal.bankName),
      [legal.bik, legal.ks].filter(Boolean).join(', ') || '—',
      line(legal.paymentInfo),
      line(legal.generalDirector),
      line(legal.activityBasis),
    ].filter((s) => s !== '—');

    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf');
    const useUnicode = fs.existsSync(fontPath);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    if (useUnicode) {
      doc.registerFont('Main', fontPath);
      doc.font('Main');
    }

    doc.fontSize(16).text(`Счёт № ${uniqueNum}`, { continued: false });
    doc.moveDown(0.5);

    doc.fontSize(10).text('Реквизиты плательщика (клиент)', { underline: true });
    doc.moveDown(0.3);
    payerLines.forEach((s) => doc.fontSize(9).text(s, { lineBreak: true }));
    doc.moveDown(0.5);

    doc.fontSize(10).text('Реквизиты получателя (юрлицо)', { underline: true });
    doc.moveDown(0.3);
    recipientLines.forEach((s) => doc.fontSize(9).text(s, { lineBreak: true }));
    doc.moveDown(0.5);

    doc.fontSize(10).text('Сайт:', { continued: true });
    doc.text(` ${siteTitle}`);
    doc.text('Услуга:', { continued: true });
    doc.text(` ${productName}`);
    doc.text('Период:', { continued: true });
    doc.text(` ${periodRu}`);
    doc.text('Сумма (руб):', { continued: true });
    doc.text(` ${amountRub}`);
    if (showVat) {
      doc.text('НДС (руб):', { continued: true });
      doc.text(` ${vatRub}`);
      doc.text('Сумма с НДС (руб):', { continued: true });
      doc.text(` ${totalWithVatRub}`);
    }

    doc.end();
    const pdfBuffer = await done;

    const safeName = uniqueNum.replace(/[^\w\-.\s]/gi, '-').replace(/\s+/g, '_');
    const filename = `${safeName}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (e: any) {
    console.error('GET invoices/[id]/pdf', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
