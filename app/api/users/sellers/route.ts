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

    // Продавцы — активные пользователи, у которых есть хотя бы один клиент, где они указаны как sellerEmployeeId
    const sellers = await prisma.user.findMany({
      where: {
        isActive: true,
        clientSales: {
          some: {},
        },
      },
      select: {
        id: true,
        fullName: true,
      },
      orderBy: { fullName: 'asc' },
    });

    return NextResponse.json({ sellers });
  } catch (error) {
    console.error('Error fetching sellers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

