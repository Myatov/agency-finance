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
    const legal = invoice.legalEntity;
    const uniqueNum = invoice.invoiceNumber?.trim() || `INV-${dateFrom.toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(-6)}`;

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
<body>
  <div class="no-print">
    <p class="hint">Можно изменить № счёта и наименование услуги только для печати (в базу не сохраняется). Затем нажмите Ctrl+P для печати или сохранения в PDF.</p>
    <label>№ счета</label>
    <input type="text" id="invNum" value="${escapeHtml(uniqueNum)}" />
    <label>Услуга (для печати)</label>
    <input type="text" id="serviceName" value="${escapeHtml(productName)}" />
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

  <script>
    function updatePrintView() {
      var num = document.getElementById('invNum').value.trim() || '—';
      var svc = document.getElementById('serviceName').value.trim() || '—';
      document.getElementById('invNumDisp').textContent = num;
      document.getElementById('serviceDisp').textContent = svc;
    }
    document.getElementById('invNum').addEventListener('input', updatePrintView);
    document.getElementById('invNum').addEventListener('change', updatePrintView);
    document.getElementById('serviceName').addEventListener('input', updatePrintView);
    document.getElementById('serviceName').addEventListener('change', updatePrintView);
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
