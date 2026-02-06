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

    let where: any = {};

    // ACCOUNT_MANAGER sees only their sites
    if (user.roleCode === 'ACCOUNT_MANAGER') {
      where = {
        OR: [
          { accountManagerId: user.id },
          { creatorId: user.id },
        ],
      };
    }
    // Seller sees only sites of their clients
    // For MVP, we'll get all sites and filter on frontend if needed
    // OWNER/CEO/FINANCE see all

    const sites = await prisma.site.findMany({
      where,
      include: {
        client: {
          include: {
            seller: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        accountManager: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { title: 'asc' },
    });

    return NextResponse.json({ sites });
  } catch (error) {
    console.error('Error fetching available sites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
