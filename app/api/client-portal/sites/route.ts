import { NextResponse } from 'next/server';
import { getClientPortalSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getClientPortalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sites = await prisma.site.findMany({
    where: { clientId: session.clientId },
    select: {
      id: true,
      title: true,
      websiteUrl: true,
      niche: true,
      isActive: true,
    },
    orderBy: { title: 'asc' },
  });
  return NextResponse.json({ sites });
}
