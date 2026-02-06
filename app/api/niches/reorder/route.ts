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
    const { nicheIds, parentId } = body;

    if (!Array.isArray(nicheIds)) {
      return NextResponse.json({ error: 'nicheIds must be an array' }, { status: 400 });
    }

    try {
      // Обновляем sortOrder только для ниш с одинаковым parentId
      // parentId может быть null для корневых ниш или строкой для дочерних
      await Promise.all(
        nicheIds.map((nicheId: string, index: number) =>
          prisma.niche.update({
            where: { id: nicheId },
            data: { sortOrder: index },
          })
        )
      );

      // Возвращаем все ниши с иерархией
      try {
        const niches = await prisma.niche.findMany({
          include: {
            parent: {
              select: {
                id: true,
                name: true,
              },
            },
            children: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [
            { parentId: 'asc' },
            { sortOrder: 'asc' },
          ],
        });
        return NextResponse.json({ niches });
      } catch (hierarchyError: any) {
        // Если поле parentId еще не добавлено, возвращаем без иерархии
        if (hierarchyError.message?.includes('parentId') || hierarchyError.message?.includes('Unknown column')) {
          console.warn('parentId field not found, returning niches without hierarchy');
          const niches = await prisma.niche.findMany({
            orderBy: { sortOrder: 'asc' },
          });
          return NextResponse.json({ niches: niches.map(n => ({ ...n, parentId: null, parent: null, children: [] })) });
        }
        throw hierarchyError;
      }
    } catch (dbError: any) {
      if (dbError.message?.includes('does not exist') || dbError.message?.includes('Niche') || dbError.code === 'P2021') {
        console.error('Table Niche does not exist:', dbError);
        return NextResponse.json({ 
          error: 'Таблица Niche не создана в базе данных. Обратитесь к администратору для выполнения миграции.' 
        }, { status: 500 });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error reordering niches:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
