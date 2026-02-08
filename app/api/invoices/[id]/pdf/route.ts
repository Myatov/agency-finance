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
    const dateStr = toRuDate(new Date());

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

    // Услуга, период, сумма
    draw(`Сайт: ${siteTitle}`, left, LAYOUT.y.site);
    draw(`Услуга: ${productName}`, left, LAYOUT.y.service);
    draw(`Период: ${periodRu}`, left, LAYOUT.y.period);
    draw(`Сумма (руб): ${amountRub}`, left, LAYOUT.y.amount);
    if (showVat) {
      draw(`НДС (руб): ${vatRub}`, left, LAYOUT.y.vat);
      draw(`Сумма с НДС (руб): ${totalWithVatRub}`, left, LAYOUT.y.totalWithVat);
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
