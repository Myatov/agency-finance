import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.roleCode !== 'ACCOUNT_MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
      select: { id: true, name: true, accountManagerId: true, accountManagerAcceptedAt: true },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (client.accountManagerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: not your client' }, { status: 403 });
    }
    await prisma.client.update({
      where: { id },
      data: { accountManagerAcceptedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('POST clients/[id]/accept-by-am', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
