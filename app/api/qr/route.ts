import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

/** GET /api/qr?url=... — возвращает PNG QR-кода для переданного URL (для личного кабинета, счёта и т.д.) */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url') || '';
    const text = decodeURIComponent(url);
    if (!text || text.length > 2000) {
      return NextResponse.json({ error: 'Invalid or missing url' }, { status: 400 });
    }
    const buffer = await QRCode.toBuffer(text, { type: 'png', width: 256, margin: 2 });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (e) {
    console.error('QR generation error', e);
    return NextResponse.json({ error: 'Failed to generate QR' }, { status: 500 });
  }
}
