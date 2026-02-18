import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.roleCode !== 'ACCOUNT_MANAGER') {
      return NextResponse.json({ clients: [] });
    }
    const clients = await prisma.client.findMany({
      where: {
        accountManagerId: user.id,
        accountManagerAcceptedAt: null,
        isSystem: false,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ clients });
  } catch (e: any) {
    console.error('GET clients/pending-acceptance', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
