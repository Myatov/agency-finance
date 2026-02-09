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

  const base = request.nextUrl.origin;
  const pdfUrl = `${base}/api/invoices/${invoice.id}/pdf?token=${encodeURIComponent(token)}`;
  return NextResponse.redirect(pdfUrl);
}
