// Utility functions

/** Публичный origin для ссылок (портал клиента). Учитывает прокси (X-Forwarded-*). */
export function getPublicOrigin(request: Request & { nextUrl?: URL }): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env && env.trim()) return env.replace(/\/$/, '');
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
  if (proto && host) return `${proto}://${host}`;
  if (request.nextUrl) return request.nextUrl.origin;
  return '';
}

export function formatAmount(amount: bigint | number | string): string {
  const num = typeof amount === 'bigint' ? Number(amount) : typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(num / 100);
}

export function parseAmount(amount: string): bigint {
  // Remove spaces and convert to number (in rubles), then to kopecks
  const clean = amount.replace(/\s/g, '').replace(',', '.');
  const rubles = parseFloat(clean);
  return BigInt(Math.round(rubles * 100));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('ru-RU');
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('ru-RU');
}
