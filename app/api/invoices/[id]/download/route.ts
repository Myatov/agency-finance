import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import { getPublicOrigin } from '@/lib/utils';

function toRuDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function line(s: string | null | undefined): string {
  return s != null && s !== '' ? escapeHtml(s) : '—';
}

/** Сумма прописью: "X рублей YY копеек" */
function rublesInWords(amountRub: string): string {
  const num = parseFloat(amountRub.replace(',', '.'));
  if (!Number.isFinite(num) || num < 0) return 'Ноль рублей 00 копеек';
  const intPart = Math.floor(num);
  const kopecks = Math.round((num - intPart) * 100) % 100;
  const kStr = String(kopecks).padStart(2, '0');
  const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  const plural = (n: number, one: string, few: string, many: string) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  };
  const toWords = (n: number, female = false): string => {
    if (n === 0) return 'ноль';
    const o = female ? ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'] : ones;
    let s = '';
    const h = Math.floor(n / 100) % 10;
    const t = Math.floor(n / 10) % 10;
    const d = n % 10;
    if (h > 0) s += hundreds[h] + ' ';
    if (t === 1) return (s + teens[d]).trim();
    if (t > 0) s += tens[t] + ' ';
    s += (female && (d === 1 || d === 2) ? o[d] : ones[d]);
    return s.trim();
  };
  let rubPart = '';
  if (intPart >= 1000000) {
    const m = Math.floor(intPart / 1000000);
    rubPart += toWords(m) + ' ' + plural(m, 'миллион', 'миллиона', 'миллионов') + ' ';
  }
  const rest = intPart % 1000000;
  if (rest >= 1000) {
    const th = Math.floor(rest / 1000);
    const thWords = th % 100 >= 10 && th % 100 < 20 ? toWords(th) : toWords(th, true);
    rubPart += thWords + ' ' + plural(th, 'тысяча', 'тысячи', 'тысяч') + ' ';
  }
  const low = intPart % 1000;
  if (low > 0 || rubPart === '') rubPart += toWords(low);
  rubPart = rubPart.trim();
  const rubWord = plural(intPart, 'рубль', 'рубля', 'рублей');
  return (rubPart ? rubPart.charAt(0).toUpperCase() + rubPart.slice(1) : 'Ноль') + ' ' + rubWord + ' ' + kStr + ' копеек';
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
                      include: {
                        legalEntity: true,
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
          orderBy: { sortOrder: 'asc' },
          include: {
            workPeriod: {
              include: {
                service: {
                  include: {
                    site: {
                      include: {
                        client: {
                          include: {
                            legalEntity: true,
                          },
                        },
                      },
                    },
                    product: { select: { name: true } },
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
      invoice.workPeriod.service.site.accountManagerId,
      invoice.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccess && invoice.lines.length > 0) {
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

    const legal = invoice.legalEntity;
    const vatPercent = legal.vatPercent != null ? Number(legal.vatPercent) : 0;
    const showVat = vatPercent > 0;

    const rows: { name: string; amountRub: string }[] = [];
    if (invoice.lines.length > 0) {
      for (const l of invoice.lines) {
        const productName = l.serviceNameOverride ?? l.workPeriod.service.product.name;
        const siteTitle = l.siteNameOverride ?? l.workPeriod.service.site.title;
        const name = [productName, siteTitle].filter(Boolean).join(' ') || '—';
        const amountRub = (Number(l.amount) / 100).toFixed(2);
        rows.push({ name, amountRub });
      }
    } else {
      const wp = invoice.workPeriod;
      const productName = wp.service.product.name;
      const siteTitle = wp.service.site.title;
      rows.push({
        name: [productName, siteTitle].filter(Boolean).join(' ') || '—',
        amountRub: (Number(invoice.amount) / 100).toFixed(2),
      });
    }

    const amountBase = Number(invoice.amount) / 100;
    const amountRub = amountBase.toFixed(2);
    const vatAmount = showVat ? amountBase * (vatPercent / 100) : 0;
    const totalWithVat = showVat ? amountBase + vatAmount : 0;
    const vatRub = vatAmount.toFixed(2);
    const totalWithVatRub = totalWithVat.toFixed(2);
    const client = invoice.lines.length > 0
      ? invoice.lines[0].workPeriod.service.site.client
      : invoice.workPeriod.service.site.client;
    const payerEntity = client.legalEntity;
    const payerLines = payerEntity
      ? [
          line(payerEntity.fullName ?? payerEntity.name),
          line(payerEntity.legalAddress),
          [payerEntity.inn, payerEntity.kpp].filter(Boolean).join(', ') || '—',
          payerEntity.ogrn ? `ОГРН ${payerEntity.ogrn}` : '—',
          payerEntity.rs ? `Р/с ${payerEntity.rs}` : '—',
          line(payerEntity.bankName),
          [payerEntity.bik, payerEntity.ks].filter(Boolean).join(', ') || '—',
          line(payerEntity.paymentInfo),
          line(payerEntity.contactInfo ?? (client as { contacts?: string }).contacts),
        ].filter((s) => s !== '—')
      : [
          line(client.name || (client as { legalEntityName?: string }).legalEntityName),
          line((client as { legalAddress?: string }).legalAddress),
          [client.inn, client.kpp].filter(Boolean).join(', ') || '—',
          client.ogrn ? `ОГРН ${client.ogrn}` : '—',
          client.rs ? `Р/с ${client.rs}` : '—',
          line(client.bankName),
          [client.bik, client.ks].filter(Boolean).join(', ') || '—',
          line((client as { paymentRequisites?: string }).paymentRequisites),
          line((client as { contacts?: string }).contacts),
        ].filter((s) => s !== '—');
    const payerName = payerEntity
      ? (payerEntity.fullName ?? payerEntity.name)
      : ((client as { legalEntityName?: string }).legalEntityName ?? client.name ?? '');
    const uniqueNum = invoice.invoiceNumber?.trim() || `INV-${invoice.workPeriod.dateFrom.toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(-6)}`;
    const invoiceDateRu = invoice.invoiceDate ? toRuDate(invoice.invoiceDate) : toRuDate(invoice.createdAt);
    const totalForWords = showVat ? totalWithVatRub : amountRub;
    const amountWords = rublesInWords(totalForWords);
    const totalItemsText = `Всего наименований ${rows.length}, на сумму ${showVat ? totalWithVatRub : amountRub} руб.`;
    const hasPdf = !!invoice.pdfGeneratedAt;
    const baseUrl = getPublicOrigin(request as Request & { nextUrl?: URL }) || process.env.NEXT_PUBLIC_APP_URL || '';
    const pdfUrl = baseUrl ? `${baseUrl}/api/invoices/${id}/pdf` : '';
    const qrDownloadUrl = invoice.publicToken && baseUrl ? `${baseUrl}/api/invoices/public/${invoice.publicToken}/pdf` : '';
    const qrImageUrl = qrDownloadUrl ? `${baseUrl}/api/qr?url=${encodeURIComponent(qrDownloadUrl)}` : '';

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

    const payerBlock = payerLines.length ? payerLines.map((s) => `<div>${s}</div>`).join('') : '<div>—</div>';
    const recipientBlock = recipientLines.length ? recipientLines.map((s) => `<div>${s}</div>`).join('') : '<div>—</div>';

    const tableRows = rows
      .map(
        (r, i) =>
          `<tr>
        <td style="border:1px solid #000;padding:6px;text-align:center;">${i + 1}</td>
        <td style="border:1px solid #000;padding:6px;">${escapeHtml(r.name)}</td>
        <td style="border:1px solid #000;padding:6px;text-align:right;">1</td>
        <td style="border:1px solid #000;padding:6px;text-align:center;">усл.</td>
        <td style="border:1px solid #000;padding:6px;text-align:right;">${r.amountRub}</td>
        <td style="border:1px solid #000;padding:6px;text-align:right;">${r.amountRub}</td>
      </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Счёт ${escapeHtml(uniqueNum)}</title>
  <style>
    body { font-family: sans-serif; max-width: 700px; margin: 1rem auto; padding: 1rem; }
    .no-print { margin-bottom: 1rem; padding: 1rem; background: #f5f5f5; border-radius: 8px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body data-invoice-id="${escapeHtml(id)}" data-has-pdf="${hasPdf}" data-pdf-url="${escapeHtml(pdfUrl)}">
  <div class="no-print">
    <p style="color:#555;font-size:0.875rem;">HTML-форма счёта с подставленными полями из базы.</p>
    <button type="button" id="btnGeneratePdf" style="padding:0.5rem 1rem;background:#0d9488;color:white;border:none;border-radius:6px;cursor:pointer;margin-right:0.5rem;">Сформировать PDF</button>
    <span id="pdfLinkSpan" style="display:${hasPdf ? 'inline' : 'none'};">
      <a id="pdfLink" href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener" style="padding:0.5rem 1rem;background:#2563eb;color:white;border-radius:6px;text-decoration:none;">Счет в PDF</a>
    </span>
  </div>

  <div id="printArea">
    <p style="margin:1rem 0 0.5rem;font-size:16px;font-weight:bold;">Счет № ${escapeHtml(uniqueNum)} от ${escapeHtml(invoiceDateRu)} г.</p>
    <table style="width:100%;max-width:681px;border-collapse:collapse;font-size:12pt;margin:0.5rem 0 1rem;">
      <tr><td style="padding:4px 0;width:85px;vertical-align:top;">Поставщик:</td><td><b>${escapeHtml((legal.fullName ?? legal.name) ?? '')}</b></td></tr>
      <tr><td style="padding:4px 0;vertical-align:top;">Плательщик:</td><td>${payerBlock}</td></tr>
      <tr><td style="padding:4px 0;vertical-align:top;">Покупатель:</td><td><b>${escapeHtml(payerName)}</b></td></tr>
    </table>
    ${qrImageUrl ? `<p style="margin:0.5rem 0;"><img src="${escapeHtml(qrImageUrl)}" alt="QR код счёта" width="80" height="80" /> <span style="font-size:0.875rem;color:#555;">Скачать счёт по QR-коду</span></p>` : ''}
    <table style="width:100%;max-width:684px;border-collapse:collapse;border:1.5px solid #000;font-size:10pt;">
      <tr style="background:#f5f5f5;">
        <th style="border:1px solid #000;padding:6px;text-align:center;width:30px;">№</th>
        <th style="border:1px solid #000;padding:6px;">Наименование работ, услуг</th>
        <th style="border:1px solid #000;padding:6px;text-align:center;width:50px;">Кол-во</th>
        <th style="border:1px solid #000;padding:6px;text-align:center;width:45px;">Ед</th>
        <th style="border:1px solid #000;padding:6px;text-align:center;width:70px;">Цена</th>
        <th style="border:1px solid #000;padding:6px;text-align:center;width:75px;">Сумма</th>
      </tr>
      ${tableRows}
    </table>
    <table style="width:100%;max-width:684px;border-collapse:collapse;font-size:12pt;margin-top:0;">
      <tr><td style="padding:4px 0;text-align:right;"><b>Итого:</b></td><td style="padding:4px 0;text-align:right;width:120px;">${amountRub}</td></tr>
      ${showVat ? `<tr><td style="padding:4px 0;text-align:right;"><b>В т.ч. НДС:</b></td><td style="padding:4px 0;text-align:right;">${vatRub}</td></tr>` : ''}
      <tr><td style="padding:4px 0;text-align:right;"><b>Всего к оплате:</b></td><td style="padding:4px 0;text-align:right;">${showVat ? totalWithVatRub : amountRub}</td></tr>
      <tr><td style="padding:4px 0 0;" colspan="2">${escapeHtml(totalItemsText)}</td></tr>
      <tr><td style="padding:8px 0 0;" colspan="2">${escapeHtml(amountWords)}</td></tr>
    </table>
    <table style="width:100%;max-width:520px;margin-top:1rem;font-size:12pt;border-collapse:collapse;">
      <tr><td style="padding:4px 0;width:150px;">Руководитель</td><td style="padding:4px 0;">__________________</td></tr>
      <tr><td style="padding:4px 0;">Бухгалтер</td><td style="padding:4px 0;">__________________</td></tr>
    </table>
  </div>
  <script>
    (function(){
      var btn = document.getElementById('btnGeneratePdf');
      var span = document.getElementById('pdfLinkSpan');
      var link = document.getElementById('pdfLink');
      var body = document.body;
      if (btn) btn.onclick = function(){
        btn.disabled = true;
        btn.textContent = 'Формирование…';
        fetch('/api/invoices/${escapeHtml(id)}/generate-pdf', { method: 'POST' })
          .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
          .then(function(res){
            if (res.ok && res.data && res.data.pdfUrl) {
              if (link) { link.href = res.data.pdfUrl; }
              if (span) span.style.display = 'inline';
              body.setAttribute('data-has-pdf', 'true');
              btn.style.display = 'none';
            } else { alert(res.data && res.data.error ? res.data.error : 'Ошибка формирования PDF'); }
          })
          .catch(function(){ alert('Ошибка сети'); })
          .finally(function(){ btn.disabled = false; btn.textContent = 'Сформировать PDF'; });
      };
      if (body.getAttribute('data-has-pdf') === 'true' && span) span.style.display = 'inline';
    })();
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="invoice-${uniqueNum}.html"`,
      },
    });
  } catch (e: any) {
    console.error('GET invoices/[id]/download', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
