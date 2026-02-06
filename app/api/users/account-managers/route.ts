import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find ACCOUNT_MANAGER role
    const accountManagerRole = await prisma.role.findUnique({ where: { code: 'ACCOUNT_MANAGER' } });
    if (!accountManagerRole) {
      return NextResponse.json({ accountManagers: [] });
    }

    const accountManagers = await prisma.user.findMany({
      where: {
        roleId: accountManagerRole.id,
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
      },
      orderBy: { fullName: 'asc' },
    });

    return NextResponse.json({ accountManagers });
  } catch (error) {
    console.error('Error fetching account managers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
