import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';

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
                site: { include: { client: { select: { name: true, sellerEmployeeId: true } } } },
                product: { select: { name: true } },
              },
            },
          },
        },
        legalEntity: { select: { name: true } },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      invoice.workPeriod.service.site.accountManagerId,
      invoice.workPeriod.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const amountRub = (Number(invoice.amount) / 100).toFixed(2);
    const dateFrom = invoice.workPeriod.dateFrom.toISOString().slice(0, 10);
    const dateTo = invoice.workPeriod.dateTo.toISOString().slice(0, 10);
    const clientName = invoice.workPeriod.service.site.client.name;
    const siteTitle = invoice.workPeriod.service.site.title;
    const productName = invoice.workPeriod.service.product.name;
    const legalName = invoice.legalEntity.name;
    const invoiceNumber = invoice.invoiceNumber || id.slice(0, 8);

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Счёт ${invoiceNumber}</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 2rem auto; padding: 1rem; }
    h1 { font-size: 1.25rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.5rem 0; border-bottom: 1px solid #eee; }
    th { color: #666; font-weight: normal; width: 40%; }
    .total { font-size: 1.25rem; font-weight: bold; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>Счёт ${invoiceNumber}</h1>
  <table>
    <tr><th>Клиент</th><td>${escapeHtml(clientName)}</td></tr>
    <tr><th>Сайт / Услуга</th><td>${escapeHtml(siteTitle)} — ${escapeHtml(productName)}</td></tr>
    <tr><th>Период</th><td>${dateFrom} — ${dateTo}</td></tr>
    <tr><th>Плательщик (юрлицо)</th><td>${escapeHtml(legalName)}</td></tr>
    <tr><th>Сумма (руб)</th><td class="total">${amountRub}</td></tr>
  </table>
  <p style="margin-top: 2rem; color: #666; font-size: 0.875rem;">Счёт создан в системе. Для печати используйте Ctrl+P.</p>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="invoice-${invoiceNumber}.html"`,
      },
    });
  } catch (e: any) {
    console.error('GET invoices/[id]/download', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
