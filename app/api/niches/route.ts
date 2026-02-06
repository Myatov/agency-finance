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
      // Пытаемся получить с иерархией
      try {
        const niches = await prisma.niche.findMany({
          include: {
            parent: {
              select: {
                id: true,
                name: true,
                sortOrder: true,
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
        // Если поле parentId еще не добавлено, получаем без иерархии
        if (hierarchyError.message?.includes('parentId') || hierarchyError.message?.includes('Unknown column') || hierarchyError.code === 'P2001') {
          console.warn('parentId field not found, returning niches without hierarchy');
          const niches = await prisma.niche.findMany({
            orderBy: { sortOrder: 'asc' },
          });
          return NextResponse.json({ niches: niches.map(n => ({ ...n, parentId: null, parent: null, children: [] })) });
        }
        throw hierarchyError;
      }
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
      try {
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
      } catch (parentError: any) {
        // Если поле parentId еще не существует, игнорируем проверку
        if (parentError.message?.includes('parentId') || parentError.message?.includes('Unknown column')) {
          console.warn('parentId field not found, skipping parent validation');
        } else {
          throw parentError;
        }
      }
    }

    // Проверяем существование таблицы
    try {
      // Пытаемся создать с parentId
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
      } catch (createError: any) {
        // Если поле parentId еще не существует, создаем без него
        if (createError.message?.includes('parentId') || createError.message?.includes('Unknown column')) {
          console.warn('parentId field not found, creating niche without parentId');
          const maxOrder = await prisma.niche.findFirst({
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
          });

          const niche = await prisma.niche.create({
            data: {
              name: name.trim(),
              sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
            },
          });

          return NextResponse.json({ niche: { ...niche, parentId: null, parent: null } });
        }
        throw createError;
      }
    } catch (dbError: any) {
      if (dbError.message?.includes('does not exist') || dbError.message?.includes('Niche') || dbError.code === 'P2021') {
        console.error('Table Niche does not exist:', dbError);
        // Пытаемся создать таблицу через SQL
        try {
          // Это не будет работать напрямую, но хотя бы логируем
          console.warn('Attempting to create Niche table...');
        } catch (createError) {
          console.error('Failed to create table:', createError);
        }
        return NextResponse.json({ 
          error: 'Таблица Niche не создана в базе данных. Обратитесь к администратору для выполнения миграции.' 
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
