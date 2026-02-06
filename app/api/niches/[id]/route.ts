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
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    try {
      const niche = await prisma.niche.update({
        where: { id: params.id },
        data: { name: name.trim() },
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
