import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

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

    const niches = await prisma.niche.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ niches });
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
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

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

    return NextResponse.json({ niche });
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ниша с таким названием уже существует' }, { status: 400 });
    }
    console.error('Error creating niche:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
