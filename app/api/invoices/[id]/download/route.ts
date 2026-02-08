import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';

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
    const productName = invoice.workPeriod.service.product.name;
    const uniqueNum = invoice.invoiceNumber?.trim() || `INV-${dateFrom.toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(-6)}`;
    const invoiceDateRu = toRuDate(invoice.createdAt);
    const totalForWords = showVat ? totalWithVatRub : amountRub;
    const amountWords = rublesInWords(totalForWords);

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

    const payerBlock = payerLines.length ? payerLines.map((s) => `<div>${s}</div>`).join('') : '<div>—</div>';
    const recipientBlock = recipientLines.length ? recipientLines.map((s) => `<div>${s}</div>`).join('') : '<div>—</div>';

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Счёт</title>
  <style>
    body { font-family: sans-serif; max-width: 700px; margin: 1rem auto; padding: 1rem; }
    .no-print { margin-bottom: 1rem; padding: 1rem; background: #f5f5f5; border-radius: 8px; }
    .no-print label { display: block; margin-top: 0.5rem; font-size: 0.875rem; color: #555; }
    .no-print input { width: 100%; max-width: 400px; padding: 0.35rem 0.5rem; margin-top: 0.25rem; }
    @media print {
      .no-print { display: none !important; }
      .invoice-blank .blank-hint { display: none !important; }
    }
    h1 { font-size: 1.25rem; margin-bottom: 1rem; }
    .block { margin-bottom: 1.25rem; }
    .block-title { font-weight: bold; margin-bottom: 0.35rem; font-size: 0.9rem; }
    .block-content { font-size: 0.9rem; line-height: 1.4; }
    table.invoice-main { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    table.invoice-main th, table.invoice-main td { text-align: left; padding: 0.4rem 0; vertical-align: top; }
    table.invoice-main th { color: #444; font-weight: normal; width: 140px; }
    .total { font-size: 1.2rem; font-weight: bold; margin-top: 0.5rem; }
    .hint { color: #666; font-size: 0.8rem; margin-top: 1.5rem; }
  </style>
</head>
<body data-invoice-id="${escapeHtml(id)}">
  <div class="no-print">
    <p class="hint">Можно изменить поля только для печати (в базу не сохраняется). Затем нажмите Ctrl+P для печати или сохранения в PDF.</p>
    <label>№ счета</label>
    <input type="text" id="invNum" value="${escapeHtml(uniqueNum)}" />
    <label>Дата выставления счета</label>
    <input type="text" id="invDate" value="${escapeHtml(invoiceDateRu)}" placeholder="ДД.ММ.ГГГГ" />
    <label>Сайт</label>
    <input type="text" id="siteName" value="${escapeHtml(siteTitle)}" />
    <label>Услуга</label>
    <input type="text" id="serviceName" value="${escapeHtml(productName)}" />
    <p style="margin-top: 1rem;">
      <button type="button" id="btnPdf" style="padding: 0.5rem 1rem; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">Печать счета</button>
    </p>
    <div class="instruction-block debug-block" style="margin-top: 1rem; padding: 0.75rem; background: #f0f0f0; border: 1px solid #ccc; border-radius: 6px; font-size: 0.8rem; color: #444; max-width: 700px;">
      <strong>Для отладки</strong><br/>
      Счёт № <span id="debugInvNum">${escapeHtml(uniqueNum)}</span><br/>
      Реквизиты плательщика (клиент):<br/>
      <div class="block-content">${payerBlock}</div>
      Реквизиты получателя (юрлицо):<br/>
      <div class="block-content">${recipientBlock}</div>
      Сайт: <span id="debugSite">${escapeHtml(siteTitle)}</span><br/>
      Услуга: <span id="debugService">${escapeHtml(productName)}</span><br/>
      Период: ${periodRu}<br/>
      Сумма (руб): ${amountRub}<br/>
      ${showVat ? `НДС (руб): ${vatRub}<br/>Сумма с НДС (руб): ${totalWithVatRub}<br/>` : ''}
    </div>
    <div class="instruction-block" style="margin-top: 1rem; padding: 0.75rem; background: #fefce8; border: 1px solid #e7e5e4; border-radius: 6px; font-size: 0.8rem; color: #444; max-width: 700px;">
      <strong>Внутренняя инструкция по формированию счёта</strong> (можно править в docs/INVOICE_FORM_RULES.md):<br/>
      Кнопка «Печать счета» открывает диалог печати браузера — в печать попадает заполненный шаблон с этой страницы. Для сохранения в PDF выберите в диалоге «Сохранить как PDF».
    </div>
  </div>

  <div id="printAreaBlank" class="invoice-blank">
    <table class="blank-table" style="width: 100%; max-width: 684px; border-collapse: collapse; border: 1.5px solid #000; font-size: 10pt; font-family: Calibri, sans-serif;">
      <tr>
        <td style="border: 1px solid #000; padding: 4px 6px; width: 40%;" colspan="2">${escapeHtml((legal.fullName ?? legal.name) ?? '')}</td>
        <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">БИК</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">${escapeHtml(legal.bik ?? '')}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 4px 6px;" colspan="2">Контактные данные получателя: ${escapeHtml(legal.contactInfo ?? '')}</td>
        <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">Сч. №</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">${escapeHtml(legal.rs ?? '')}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 4px 6px;" colspan="2">ИНН ${escapeHtml(legal.inn ?? '')}</td>
        <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">Банк получателя</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">${escapeHtml(legal.bankName ?? '')}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 4px 6px;" colspan="2">КПП ${escapeHtml(legal.kpp ?? '')}</td>
        <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">К/с №</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">${escapeHtml(legal.ks ?? '')}</td>
      </tr>
    </table>

    <p style="margin: 1rem 0 0.5rem; font-size: 16px; font-weight: bold;">Счет № <span id="invNumTitleBlank">${escapeHtml(uniqueNum)}</span> от <span id="invDateDisp">${escapeHtml(invoiceDateRu)}</span> г.</p>

    <table style="width: 100%; max-width: 681px; border-collapse: collapse; font-size: 12pt; margin: 0.5rem 0 1rem;">
      <tr><td style="padding: 4px 0; width: 85px;">Поставщик:</td><td style="padding: 4px 0;"><b>${escapeHtml(legal.name ?? '')}</b></td></tr>
      <tr><td style="padding: 4px 0;">Покупатель:</td><td style="padding: 4px 0;"><b>${escapeHtml(client.legalEntityName ?? '')}</b></td></tr>
    </table>

    <table class="blank-table" style="width: 100%; max-width: 684px; border-collapse: collapse; border: 1.5px solid #000; font-size: 10pt;">
      <tr style="background: #f5f5f5;">
        <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 30px;">№</th>
        <th style="border: 1px solid #000; padding: 6px; text-align: center;">Наименование работ, услуг</th>
        <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 50px;">Кол-во</th>
        <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 45px;">Ед</th>
        <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 70px;">Цена</th>
        <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 75px;">Сумма</th>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">1</td>
        <td style="border: 1px solid #000; padding: 6px;" id="serviceDispBlank">${escapeHtml(productName + ' ' + siteTitle)}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right;">1</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">усл.</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right;">${amountRub}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right;">${amountRub}</td>
      </tr>
    </table>

    <table style="width: 100%; max-width: 684px; border-collapse: collapse; font-size: 12pt; margin-top: 0;">
      <tr><td style="padding: 4px 0; text-align: right;"><b>Итого:</b></td><td style="padding: 4px 0; text-align: right; width: 120px;">${amountRub}</td></tr>
      ${showVat ? `<tr><td style="padding: 4px 0; text-align: right;"><b>В том числе НДС:</b></td><td style="padding: 4px 0; text-align: right;">${vatRub}</td></tr>` : '<tr><td style="padding: 4px 0; text-align: right;"><b>В том числе НДС:</b></td><td style="padding: 4px 0; text-align: right;">Без НДС</td></tr>'}
      <tr><td style="padding: 4px 0; text-align: right;"><b>Всего к оплате:</b></td><td style="padding: 4px 0; text-align: right;">${showVat ? totalWithVatRub : amountRub}</td></tr>
      <tr><td style="padding: 8px 0 0;" colspan="2">Всего наименований 1, на сумму ${showVat ? totalWithVatRub : amountRub} руб.</td></tr>
      <tr><td style="padding: 4px 0 0;" colspan="2"><span id="amountWordsDisp">${escapeHtml(amountWords)}</span></td></tr>
    </table>

    <table style="width: 100%; max-width: 520px; margin-top: 1rem; font-size: 12pt; border-collapse: collapse;">
      <tr>
        <td style="padding: 4px 0; width: 150px;">Руководитель</td>
        <td style="padding: 4px 0;">__________________</td>
      </tr>
      <tr>
        <td style="padding: 4px 0;">Бухгалтер</td>
        <td style="padding: 4px 0;">__________________</td>
      </tr>
    </table>
  </div>

  <script>
    function updatePrintView() {
      var num = document.getElementById('invNum').value.trim() || '—';
      var dateVal = document.getElementById('invDate').value.trim() || '';
      var siteVal = document.getElementById('siteName').value.trim() || '';
      var svc = document.getElementById('serviceName').value.trim() || '';
      var blankTitle = document.getElementById('invNumTitleBlank');
      var invDateDisp = document.getElementById('invDateDisp');
      var serviceDispBlank = document.getElementById('serviceDispBlank');
      var debugInvNum = document.getElementById('debugInvNum');
      var debugSite = document.getElementById('debugSite');
      var debugService = document.getElementById('debugService');
      if (blankTitle) blankTitle.textContent = num;
      if (invDateDisp) invDateDisp.textContent = dateVal;
      if (serviceDispBlank) serviceDispBlank.textContent = (svc + ' ' + siteVal).trim() || '—';
      if (debugInvNum) debugInvNum.textContent = num;
      if (debugSite) debugSite.textContent = siteVal || '—';
      if (debugService) debugService.textContent = svc || '—';
    }
    document.getElementById('invNum').addEventListener('input', updatePrintView);
    document.getElementById('invNum').addEventListener('change', updatePrintView);
    document.getElementById('invDate').addEventListener('input', updatePrintView);
    document.getElementById('invDate').addEventListener('change', updatePrintView);
    document.getElementById('siteName').addEventListener('input', updatePrintView);
    document.getElementById('siteName').addEventListener('change', updatePrintView);
    document.getElementById('serviceName').addEventListener('input', updatePrintView);
    document.getElementById('serviceName').addEventListener('change', updatePrintView);

    document.getElementById('btnPdf').addEventListener('click', function() {
      // Печать текущего заполненного шаблона счёта (тот же вид, что на странице); пользователь может сохранить в PDF через диалог печати
      window.print();
    });
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
