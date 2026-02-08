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
    <p class="hint">Можно изменить № счёта и наименование услуги только для печати (в базу не сохраняется). Затем нажмите Ctrl+P для печати или сохранения в PDF.</p>
    <label>№ счета</label>
    <input type="text" id="invNum" value="${escapeHtml(uniqueNum)}" />
    <label>Услуга (для печати)</label>
    <input type="text" id="serviceName" value="${escapeHtml(productName)}" />
    <p style="margin-top: 1rem;">
      <button type="button" id="btnPdf" style="padding: 0.5rem 1rem; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">Печать отчета</button>
    </p>
    <div class="instruction-block" style="margin-top: 1rem; padding: 0.75rem; background: #fefce8; border: 1px solid #e7e5e4; border-radius: 6px; font-size: 0.8rem; color: #444; max-width: 700px;">
      <strong>Внутренняя инструкция по формированию счёта</strong> (можно править в docs/INVOICE_FORM_RULES.md):<br/>
      PDF строится по бланку <code>public/templates/schet-na-oplatu-blank-dlya-ip.pdf</code>: на него наносятся номер счёта, дата, плательщик, получатель, сайт, услуга, период, сумма (и при НДС — НДС и сумма с НДС). Координаты текста можно подстроить в <code>app/api/invoices/[id]/pdf/route.ts</code> (объект LAYOUT). Имя файла при скачивании: № счета.pdf.
    </div>
  </div>

  <div id="printArea">
    <h1 id="titleH1">Счёт № <span id="invNumDisp">${escapeHtml(uniqueNum)}</span></h1>

    <div class="block">
      <div class="block-title">Реквизиты плательщика (клиент)</div>
      <div class="block-content">${payerBlock}</div>
    </div>

    <div class="block">
      <div class="block-title">Реквизиты получателя (юрлицо)</div>
      <div class="block-content">${recipientBlock}</div>
    </div>

    <table class="invoice-main">
      <tr><th>Сайт</th><td>${escapeHtml(siteTitle)}</td></tr>
      <tr><th>Услуга</th><td id="serviceDisp">${escapeHtml(productName)}</td></tr>
      <tr><th>Период</th><td>${periodRu}</td></tr>
      <tr><th>Сумма (руб)</th><td class="total">${amountRub}</td></tr>
      ${showVat ? `<tr><th>НДС (руб)</th><td>${vatRub}</td></tr><tr><th>Сумма с НДС (руб)</th><td class="total">${totalWithVatRub}</td></tr>` : ''}
    </table>
  </div>

  <div id="printAreaBlank" class="invoice-blank" style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #ddd;">
    <p class="blank-hint" style="font-size: 0.85rem; color: #666; margin-bottom: 0.5rem;">Вариант для печати — бланк счёта от ИП (по правилам: реквизиты получателя, счёт № и дата, поставщик/покупатель, таблица работ/услуг, итого, НДС, подпись).</p>
    <table class="blank-table" style="width: 100%; max-width: 684px; border-collapse: collapse; border: 1.5px solid #000; font-size: 10pt; font-family: Calibri, sans-serif;">
      <tr>
        <td style="border: 1px solid #000; padding: 4px 6px; width: 40%;" colspan="2"></td>
        <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">БИК</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">${escapeHtml(legal.bik ?? '')}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 4px 6px;" colspan="2" rowspan="2"></td>
        <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">Сч. №</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">${escapeHtml(legal.rs ?? '')}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 4px 6px; text-align: center;">Банк получателя</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">${escapeHtml(legal.bankName ?? '')}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 4px 6px;">ИНН</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">КПП</td>
        <td style="border: 1px solid #000; padding: 4px 6px;" colspan="2" rowspan="3"></td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 4px 6px;">${escapeHtml(legal.inn ?? '')}</td>
        <td style="border: 1px solid #000; padding: 4px 6px;">${escapeHtml(legal.kpp ?? '')}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 4px 6px;" colspan="2">Получатель</td>
      </tr>
      <tr>
        <td style="border: 1px solid #000; padding: 4px 6px;" colspan="4">${escapeHtml(legal.name ?? '')}</td>
      </tr>
    </table>

    <p style="margin: 1rem 0 0.5rem; font-size: 16px; font-weight: bold;">Счет № <span id="invNumTitleBlank">${escapeHtml(uniqueNum)}</span> от ${invoiceDateRu} г.</p>

    <table style="width: 100%; max-width: 681px; border-collapse: collapse; font-size: 12pt; margin: 0.5rem 0 1rem;">
      <tr><td style="padding: 4px 0; width: 85px;">Поставщик:</td><td style="padding: 4px 0;"><b>${escapeHtml(legal.name ?? '')}</b></td></tr>
      <tr><td style="padding: 4px 0;">Покупатель:</td><td style="padding: 4px 0;"><b>${escapeHtml((client.name || client.legalEntityName) ?? '')}</b></td></tr>
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
        <td style="border: 1px solid #000; padding: 6px;" id="serviceDispBlank">${escapeHtml(productName)}</td>
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
      <tr><td style="padding: 16px 0 0;" colspan="2">___________________________________________________</td></tr>
    </table>

    <table style="width: 100%; max-width: 520px; margin-top: 1rem; font-size: 12pt; border-collapse: collapse;">
      <tr>
        <td style="padding: 4px 0; width: 150px;">Руководитель</td>
        <td style="padding: 4px 0; border-bottom: 1px solid #000; width: 160px;"></td>
        <td style="padding: 4px 0;">__________________</td>
      </tr>
      <tr>
        <td style="padding: 4px 0;">Бухгалтер</td>
        <td style="padding: 4px 0; border-bottom: 1px solid #000;"></td>
        <td style="padding: 4px 0;">__________________</td>
      </tr>
    </table>
  </div>

  <script>
    function updatePrintView() {
      var num = document.getElementById('invNum').value.trim() || '—';
      var svc = document.getElementById('serviceName').value.trim() || '—';
      document.getElementById('invNumDisp').textContent = num;
      document.getElementById('serviceDisp').textContent = svc;
      var blankTitle = document.getElementById('invNumTitleBlank');
      var blankSvc = document.getElementById('serviceDispBlank');
      if (blankTitle) blankTitle.textContent = num;
      if (blankSvc) blankSvc.textContent = svc;
    }
    document.getElementById('invNum').addEventListener('input', updatePrintView);
    document.getElementById('invNum').addEventListener('change', updatePrintView);
    document.getElementById('serviceName').addEventListener('input', updatePrintView);
    document.getElementById('serviceName').addEventListener('change', updatePrintView);

    document.getElementById('btnPdf').addEventListener('click', function() {
      var id = document.body.getAttribute('data-invoice-id');
      if (!id) return;
      var num = document.getElementById('invNum').value.trim();
      var svc = document.getElementById('serviceName').value.trim();
      var url = '/api/invoices/' + encodeURIComponent(id) + '/pdf?invoiceNumber=' + encodeURIComponent(num) + '&serviceName=' + encodeURIComponent(svc);
      var btn = this;
      btn.disabled = true;
      fetch(url, { credentials: 'same-origin' })
        .then(function(r) {
          if (!r.ok) {
            return r.text().then(function(t) {
              var msg = 'Ошибка загрузки (' + r.status + ')';
              try {
                var d = JSON.parse(t);
                if (d.error) msg = d.details ? d.error + ': ' + d.details : d.error;
                else if (d.details) msg = d.details;
              } catch (_) {}
              throw new Error(msg);
            });
          }
          return r.blob();
        })
        .then(function(blob) {
          if (blob.type && blob.type.indexOf('pdf') === -1 && blob.type.indexOf('octet') === -1) {
            return blob.text().then(function(t) {
              try {
                var d = JSON.parse(t);
                throw new Error(d.error || d.details || 'Ответ не PDF');
              } catch (e) {
                if (e instanceof Error) throw e;
                throw new Error('Ответ не PDF');
              }
            });
          }
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = (num || 'schet') + '.pdf';
          a.click();
          URL.revokeObjectURL(a.href);
        })
        .catch(function(e) { alert(e.message || 'Ошибка'); })
        .finally(function() { btn.disabled = false; });
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
