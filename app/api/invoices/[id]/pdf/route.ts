import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';

/** Пути к public/fonts/DejaVuSans.ttf */
function getFontCandidates(): string[] {
  const cwd = process.cwd();
  const out: string[] = [
    path.join(cwd, 'public', 'fonts', 'DejaVuSans.ttf'),
    path.join(cwd, '..', 'public', 'fonts', 'DejaVuSans.ttf'),
    path.join(cwd, '..', '..', 'public', 'fonts', 'DejaVuSans.ttf'),
  ];
  if (typeof __dirname !== 'undefined') {
    const dir = __dirname;
    out.push(path.join(dir, '..', '..', '..', '..', '..', '..', '..', 'public', 'fonts', 'DejaVuSans.ttf'));
    out.push(path.join(dir, '..', '..', '..', '..', '..', '..', '..', '..', 'public', 'fonts', 'DejaVuSans.ttf'));
  }
  return out;
}

/** Пути к public/templates/schet-na-oplatu-blank-dlya-ip.pdf */
function getTemplateCandidates(): string[] {
  const cwd = process.cwd();
  const name = 'schet-na-oplatu-blank-dlya-ip.pdf';
  const out: string[] = [
    path.join(cwd, 'public', 'templates', name),
    path.join(cwd, '..', 'public', 'templates', name),
    path.join(cwd, '..', '..', 'public', 'templates', name),
  ];
  if (typeof __dirname !== 'undefined') {
    const dir = __dirname;
    out.push(path.join(dir, '..', '..', '..', '..', '..', '..', '..', 'public', 'templates', name));
    out.push(path.join(dir, '..', '..', '..', '..', '..', '..', '..', '..', 'public', 'templates', name));
  }
  return out;
}

function toRuDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function line(s: string | null | undefined): string {
  return s != null && s !== '' ? String(s) : '—';
}

/** Координаты для наложения текста на шаблон 612×792. Y — от нижнего края страницы (в pdf-lib ось Y вверх). При необходимости подстройте под ваш бланк. */
const LAYOUT = {
  fontSize: { title: 11, body: 9 },
  lineHeight: 13,
  left: 50,
  rightNum: 420,
  y: {
    number: 755,
    date: 740,
    payerTitle: 705,
    payerLines: 690,
    recipientTitle: 560,
    recipientLines: 545,
    site: 380,
    service: 365,
    period: 350,
    amount: 335,
    vat: 320,
    totalWithVat: 305,
  },
};

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
    const invoiceMeta = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, pdfGeneratedAt: true, invoiceNumber: true },
    });
    if (invoiceMeta?.pdfGeneratedAt) {
      const dir = getPdfDir();
      const filePath = path.join(dir, `${id}.pdf`);
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        const safeName = invoiceMeta.invoiceNumber || id;
        return new NextResponse(buf, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${encodeURIComponent(safeName + '.pdf')}"`,
            'Content-Length': String(buf.length),
          },
        });
      }
    }
    const token = request.nextUrl.searchParams.get('token');
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
        lines: {
          include: {
            workPeriod: {
              include: {
                service: {
                  include: {
                    product: { select: { name: true } },
                    site: { include: { client: { select: { sellerEmployeeId: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 });

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

    const searchParams = request.nextUrl.searchParams;
    const overrideNumber = searchParams.get('invoiceNumber')?.trim();

    const amountBase = Number(invoice.amount) / 100;
    const amountRub = amountBase.toFixed(2);
    const legal = invoice.legalEntity;
    const vatPercent = legal.vatPercent != null ? Number(legal.vatPercent) : 0;
    const showVat = vatPercent > 0;
    const vatAmount = showVat ? amountBase * (vatPercent / 100) : 0;
    const totalWithVat = showVat ? amountBase + vatAmount : 0;
    const vatRub = vatAmount.toFixed(2);
    const totalWithVatRub = totalWithVat.toFixed(2);

    const sortedLines = (invoice.lines ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const hasMultipleLines = sortedLines.length > 1;
    const firstPeriod = invoice.workPeriod;
    const dateFrom = firstPeriod.dateFrom;
    const dateTo = firstPeriod.dateTo;
    const client = firstPeriod.service.site.client;
    const uniqueNum =
      overrideNumber ||
      invoice.invoiceNumber?.trim() ||
      `INV-${dateFrom.toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(-6)}`;
    const dateStr = toRuDate(invoice.invoiceDate ?? new Date());

    type Position = { serviceName: string; siteName: string; periodRu: string; amountRub: string };
    const positions: Position[] = hasMultipleLines
      ? sortedLines.map((l) => ({
          serviceName: l.serviceNameOverride ?? l.workPeriod.service.product.name,
          siteName: l.siteNameOverride ?? l.workPeriod.service.site.title,
          periodRu: `${toRuDate(l.workPeriod.dateFrom)} — ${toRuDate(l.workPeriod.dateTo)}`,
          amountRub: (Number(l.amount) / 100).toFixed(2),
        }))
      : [
          {
            serviceName: firstPeriod.service.product.name,
            siteName: firstPeriod.service.site.title,
            periodRu: `${toRuDate(dateFrom)} — ${toRuDate(dateTo)}`,
            amountRub,
          },
        ];

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

    let fontPath: string | null = null;
    for (const p of getFontCandidates()) {
      try {
        if (fs.existsSync(p)) {
          fontPath = p;
          break;
        }
      } catch {
        // ignore
      }
    }
    if (!fontPath) {
      const tried = getFontCandidates().join(', ');
      return NextResponse.json(
        { error: 'Шрифт не найден', details: `DejaVuSans.ttf не найден. Пути: ${tried}. CWD: ${process.cwd()}` },
        { status: 500 }
      );
    }

    let templatePath: string | null = null;
    for (const p of getTemplateCandidates()) {
      try {
        if (fs.existsSync(p)) {
          templatePath = p;
          break;
        }
      } catch {
        // ignore
      }
    }
    if (!templatePath) {
      const tried = getTemplateCandidates().join(', ');
      return NextResponse.json(
        { error: 'Шаблон счёта не найден', details: `Файл schet-na-oplatu-blank-dlya-ip.pdf не найден. Пути: ${tried}. CWD: ${process.cwd()}` },
        { status: 500 }
      );
    }

    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    pdfDoc.registerFontkit(fontkit);
    const fontBytes = new Uint8Array(fs.readFileSync(fontPath));
    const font = await pdfDoc.embedFont(fontBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];
    const black = rgb(0, 0, 0);
    const fsBody = LAYOUT.fontSize.body;
    const fsTitle = LAYOUT.fontSize.title;
    const lh = LAYOUT.lineHeight;
    const left = LAYOUT.left;
    const rightNum = LAYOUT.rightNum;

    const draw = (text: string, x: number, y: number, size: number = fsBody) => {
      page.drawText(text, { x, y, size, font, color: black });
    };

    // Номер и дата (справа вверху). Y в pdf-lib — от нижнего края.
    draw(`Счёт № ${uniqueNum}`, rightNum, LAYOUT.y.number, fsTitle);
    draw(`от ${dateStr}`, rightNum, LAYOUT.y.date);

    // Плательщик
    draw('Плательщик:', left, LAYOUT.y.payerTitle, fsTitle);
    let y = LAYOUT.y.payerLines;
    for (const s of payerLines) {
      draw(s, left, y);
      y -= lh;
    }

    // Получатель
    draw('Получатель:', left, LAYOUT.y.recipientTitle, fsTitle);
    y = LAYOUT.y.recipientLines;
    for (const s of recipientLines) {
      draw(s, left, y);
      y -= lh;
    }

    // Позиции (одна или несколько)
    const yPosStart = LAYOUT.y.site;
    const lhPos = 11;
    let yPos = yPosStart;
    if (positions.length === 1) {
      draw(`Сайт: ${positions[0].siteName}`, left, yPos);
      yPos -= lh;
      draw(`Услуга: ${positions[0].serviceName}`, left, yPos);
      yPos -= lh;
      draw(`Период: ${positions[0].periodRu}`, left, yPos);
      yPos -= lh;
      draw(`Сумма (руб): ${positions[0].amountRub}`, left, yPos);
    } else {
      const fsSmall = 8;
      for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        draw(`${i + 1}. ${p.serviceName}, ${p.siteName}`, left, yPos, fsSmall);
        yPos -= lhPos;
        draw(`   Период: ${p.periodRu} — ${p.amountRub} руб`, left, yPos, fsSmall);
        yPos -= lhPos;
      }
      yPos -= 2;
      draw(`Итого (руб): ${amountRub}`, left, yPos, LAYOUT.fontSize.body);
    }
    yPos -= lh;
    if (showVat) {
      draw(`НДС (руб): ${vatRub}`, left, yPos);
      yPos -= lh;
      draw(`Сумма с НДС (руб): ${totalWithVatRub}`, left, yPos);
    }

    const pdfBuffer = await pdfDoc.save();

    const safeName = uniqueNum.replace(/[^\w\-.\s]/gi, '-').replace(/\s+/g, '_');
    const filename = `${safeName}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (e: unknown) {
    const err = e as Error;
    const errMsg = err?.message ?? String(e);
    const errStack = err?.stack ? String(err.stack).split('\n').slice(0, 3).join(' ') : '';
    console.error('GET invoices/[id]/pdf', e);
    return NextResponse.json(
      { error: 'Internal server error', details: errMsg + (errStack ? ' | ' + errStack : '') },
      { status: 500 }
    );
  }
}
