import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CEO и OWNER имеют полный доступ, остальные могут просматривать если могут просматривать сайты
    // (для использования в форме добавления/редактирования сайтов)
    const canView = user.roleCode === 'OWNER' || user.roleCode === 'CEO' || await hasPermission(user, 'sites', 'view');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Проверяем существование таблицы Niche
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
    } catch (dbError: any) {
      // Если таблица не существует, возвращаем пустой массив
      if (dbError.message?.includes('does not exist') || dbError.message?.includes('Niche') || dbError.code === 'P2021') {
        console.warn('Table Niche does not exist yet, returning empty array');
        return NextResponse.json({ niches: [] });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error fetching niches:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Только CEO и OWNER могут создавать/редактировать/удалять ниши
    const canManage = user.roleCode === 'OWNER' || user.roleCode === 'CEO';
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, parentId } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Если указан parentId, проверяем что родитель существует и не является дочерним элементом
    if (parentId) {
      const parent = await prisma.niche.findUnique({
        where: { id: parentId },
        include: { parent: true },
      });
      if (!parent) {
        return NextResponse.json({ error: 'Родительская ниша не найдена' }, { status: 400 });
      }
      if (parent.parentId) {
        return NextResponse.json({ error: 'Нельзя создавать вложенность глубже 2 уровней' }, { status: 400 });
      }
    }

    // Проверяем существование таблицы
    try {
      // Для корневых элементов берем максимальный sortOrder среди корневых
      // Для дочерних - среди дочерних того же родителя
      const where = parentId ? { parentId } : { parentId: null };
      const maxOrder = await prisma.niche.findFirst({
        where,
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });

      const niche = await prisma.niche.create({
        data: {
          name: name.trim(),
          parentId: parentId || null,
          sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
        },
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
    } catch (dbError: any) {
      if (dbError.message?.includes('does not exist') || dbError.message?.includes('Niche') || dbError.code === 'P2021') {
        return NextResponse.json({ 
          error: 'Таблица Niche не создана в базе данных. Выполните: npx prisma db push' 
        }, { status: 500 });
      }
      throw dbError;
    }
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    console.error('Error creating niche:', error);
    
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ниша с таким названием уже существует' }, { status: 400 });
    }
    
    // Проверка на отсутствие таблицы
    if (e.message?.includes('does not exist') || e.message?.includes('Niche') || e.code === 'P2021') {
      return NextResponse.json({ 
        error: 'Таблица Niche не найдена в базе данных. Необходимо выполнить: npx prisma db push' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}
