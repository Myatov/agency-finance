import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Только CEO и OWNER могут редактировать ниши
    const canManage = user.roleCode === 'OWNER' || user.roleCode === 'CEO';
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, parentId } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    try {
      // Пытаемся получить текущую нишу с иерархией
      let currentNiche;
      try {
        currentNiche = await prisma.niche.findUnique({
          where: { id: params.id },
          include: { children: true },
        });
      } catch (findError: any) {
        // Если поле children не существует, получаем без него
        if (findError.message?.includes('children') || findError.message?.includes('Unknown column')) {
          currentNiche = await prisma.niche.findUnique({
            where: { id: params.id },
          });
          if (currentNiche) {
            (currentNiche as any).children = [];
          }
        } else {
          throw findError;
        }
      }

      if (!currentNiche) {
        return NextResponse.json({ error: 'Ниша не найдена' }, { status: 404 });
      }

      // Нельзя сделать нишу дочерней самой себе
      if (parentId === params.id) {
        return NextResponse.json({ error: 'Нельзя сделать нишу дочерней самой себе' }, { status: 400 });
      }

      // Если указан parentId, проверяем что родитель существует и не является дочерним элементом
      if (parentId) {
        try {
          const parent = await prisma.niche.findUnique({
            where: { id: parentId },
            include: { parent: true },
          });
          if (!parent) {
            return NextResponse.json({ error: 'Родительская ниша не найдена' }, { status: 400 });
          }
          if ((parent as any).parentId) {
            return NextResponse.json({ error: 'Нельзя создавать вложенность глубже 2 уровней' }, { status: 400 });
          }
          // Нельзя сделать родителем дочерний элемент текущей ниши
          if ((currentNiche as any).children?.some((child: any) => child.id === parentId)) {
            return NextResponse.json({ error: 'Нельзя сделать дочерний элемент родителем' }, { status: 400 });
          }
        } catch (parentError: any) {
          // Если поле parentId еще не существует, игнорируем проверку
          if (parentError.message?.includes('parentId') || parentError.message?.includes('Unknown column')) {
            console.warn('parentId field not found, skipping parent validation');
          } else {
            throw parentError;
          }
        }
      }

      const updateData: any = { name: name.trim() };
      if (parentId !== undefined) {
        try {
          updateData.parentId = parentId || null;
          const niche = await prisma.niche.update({
            where: { id: params.id },
            data: updateData,
            include: {
              parent: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });
          return NextResponse.json({ niche });
        } catch (updateError: any) {
          // Если поле parentId еще не существует, обновляем без него
          if (updateError.message?.includes('parentId') || updateError.message?.includes('Unknown column')) {
            console.warn('parentId field not found, updating without parentId');
            const niche = await prisma.niche.update({
              where: { id: params.id },
              data: { name: name.trim() },
            });
            return NextResponse.json({ niche: { ...niche, parentId: null, parent: null } });
          }
          throw updateError;
        }
      } else {
        const niche = await prisma.niche.update({
          where: { id: params.id },
          data: updateData,
        });
        return NextResponse.json({ niche: { ...niche, parentId: (niche as any).parentId || null, parent: null } });
      }
    } catch (dbError: any) {
      if (dbError.message?.includes('does not exist') || dbError.message?.includes('Niche') || dbError.code === 'P2021') {
        return NextResponse.json({ 
          error: 'Таблица Niche не создана в базе данных. Выполните: npx prisma db push' 
        }, { status: 500 });
      }
      throw dbError;
    }
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ниша с таким названием уже существует' }, { status: 400 });
    }
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Ниша не найдена' }, { status: 404 });
    }
    console.error('Error updating niche:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Только CEO и OWNER могут удалять ниши
    const canManage = user.roleCode === 'OWNER' || user.roleCode === 'CEO';
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
      // Проверяем текущую нишу
      let niche;
      try {
        niche = await prisma.niche.findUnique({
          where: { id: params.id },
          include: { children: true },
        });
      } catch (findError: any) {
        // Если поле children не существует, получаем без него
        if (findError.message?.includes('children') || findError.message?.includes('Unknown column')) {
          niche = await prisma.niche.findUnique({
            where: { id: params.id },
          });
          if (niche) {
            (niche as any).children = [];
          }
        } else {
          throw findError;
        }
      }

      if (!niche) {
        return NextResponse.json({ error: 'Ниша не найдена' }, { status: 404 });
      }

      // Проверяем, используется ли ниша в сайтах
      const sitesCount = await prisma.site.count({
        where: { nicheId: params.id },
      });

      if (sitesCount > 0) {
        return NextResponse.json(
          { error: `Невозможно удалить нишу: она используется в ${sitesCount} сайте(ах)` },
          { status: 400 }
        );
      }

      // Проверяем, есть ли дочерние ниши (если поле parentId существует)
      try {
        if ((niche as any).children?.length > 0) {
          return NextResponse.json(
            { error: `Невозможно удалить нишу: у неё есть ${(niche as any).children.length} дочерних ниш` },
            { status: 400 }
          );
        }
      } catch (childrenError: any) {
        // Игнорируем ошибку если поле children не существует
        if (!childrenError.message?.includes('children') && !childrenError.message?.includes('Unknown column')) {
          throw childrenError;
        }
      }

      await prisma.niche.delete({
        where: { id: params.id },
      });

      return NextResponse.json({ success: true });
    } catch (dbError: any) {
      if (dbError.message?.includes('does not exist') || dbError.message?.includes('Niche') || dbError.code === 'P2021') {
        return NextResponse.json({ 
          error: 'Таблица Niche не создана в базе данных. Выполните: npx prisma db push' 
        }, { status: 500 });
      }
      throw dbError;
    }
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Ниша не найдена' }, { status: 404 });
    }
    console.error('Error deleting niche:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
