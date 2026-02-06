import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Только CEO и OWNER могут изменять порядок ниш
    const canManage = user.roleCode === 'OWNER' || user.roleCode === 'CEO';
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { nicheIds } = body;

    if (!Array.isArray(nicheIds)) {
      return NextResponse.json({ error: 'nicheIds must be an array' }, { status: 400 });
    }

    try {
      await Promise.all(
        nicheIds.map((nicheId: string, index: number) =>
          prisma.niche.update({
            where: { id: nicheId },
            data: { sortOrder: index },
          })
        )
      );

      const niches = await prisma.niche.findMany({
        orderBy: { sortOrder: 'asc' },
      });

      return NextResponse.json({ niches });
    } catch (dbError: any) {
      if (dbError.message?.includes('does not exist') || dbError.message?.includes('Niche') || dbError.code === 'P2021') {
        return NextResponse.json({ 
          error: 'Таблица Niche не создана в базе данных. Выполните: npx prisma db push' 
        }, { status: 500 });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error reordering niches:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
