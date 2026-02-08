import { NextResponse } from 'next/server';
import { getClientPortalSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getClientPortalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const client = await prisma.client.findUnique({
    where: { id: session.clientId },
    select: { id: true, name: true },
  });
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  return NextResponse.json({ client: { id: client.id, name: client.name } });
}
