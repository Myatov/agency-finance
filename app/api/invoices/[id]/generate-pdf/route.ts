import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import { getPdfDir } from '@/lib/invoice-pdf';

export const runtime = 'nodejs';

function getOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env?.trim()) return env.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  if (host) return `${proto}://${host}`;
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
}

export async function POST(
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
                    client: { select: { sellerEmployeeId: true } },
                  },
                },
              },
            },
          },
        },
        lines: {
          include: {
            workPeriod: {
              include: {
                service: {
                  include: {
                    site: {
                      include: {
                        client: { select: { sellerEmployeeId: true } },
                      },
                    },
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

    const origin = getOrigin(request);
    const downloadUrl = `${origin}/api/invoices/${id}/download?forPdf=1`;
    const htmlRes = await fetch(downloadUrl, {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });
    if (!htmlRes.ok) {
      const err = await htmlRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.error || 'Не удалось получить HTML счёта', details: err?.details },
        { status: htmlRes.status }
      );
    }
    const html = await htmlRes.text();

    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: 20000,
      });
      const pdfBuffer = await page.pdf({
        printBackground: true,
        format: 'A4',
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });
      await browser.close();
      browser = null;

      const dir = getPdfDir();
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        console.error('mkdir invoices-pdf', e);
        return NextResponse.json({ error: 'Не удалось создать каталог для PDF' }, { status: 500 });
      }
      const filePath = path.join(dir, `${id}.pdf`);
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));
    } finally {
      if (browser) await browser.close();
    }

    await prisma.invoice.update({
      where: { id },
      data: { pdfGeneratedAt: new Date() },
    });

    const pdfUrl = `${origin}/api/invoices/${id}/pdf`;
    return NextResponse.json({ pdfUrl });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('POST invoices/[id]/generate-pdf', err);
    const message = err?.message ?? String(e);
    const details = process.env.NODE_ENV === 'development' && err?.stack
      ? `${message}\n${err.stack}`
      : message;
    return NextResponse.json(
      { error: 'Ошибка формирования PDF', details },
      { status: 500 }
    );
  }
}
