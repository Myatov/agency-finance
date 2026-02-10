import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Публичная ссылка на скачивание счёта в PDF (без авторизации).
 * GET /api/invoices/public/[token]/pdf — редирект на /api/invoices/[id]/pdf?token=...
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const invoice = await prisma.invoice.findFirst({
    where: { publicToken: token },
    select: { id: true },
  });
  if (!invoice) return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 });

  let base = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, '') || request.nextUrl.origin;
  if (/localhost|127\.0\.0\.1/i.test(base)) base = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, '') || '';
  const pdfPath = `/api/invoices/${invoice.id}/pdf?token=${encodeURIComponent(token)}`;
  const pdfUrl = base ? `${base}${pdfPath}` : pdfPath;
  return NextResponse.redirect(pdfUrl);
}
