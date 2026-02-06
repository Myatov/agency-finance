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

    // Владелец, CEO или кто может создавать/редактировать сотрудников (нужен список ролей для формы)
    const canViewRoles =
      user.roleCode === 'OWNER' ||
      user.roleCode === 'CEO' ||
      (await hasPermission(user, 'employees', 'create')) ||
      (await hasPermission(user, 'employees', 'edit')) ||
      (await hasPermission(user, 'employees', 'manage'));
    if (!canViewRoles) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const roles = await prisma.role.findMany({
      include: {
        permissions: true,
        _count: {
          select: { users: true },
        },
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ roles });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only OWNER can create roles
    if (user.roleCode !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, permissions } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    // Check if code already exists
    const existing = await prisma.role.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: 'Role with this code already exists' }, { status: 400 });
    }

    const role = await prisma.role.create({
      data: {
        name,
        code,
        isSystem: false,
        permissions: {
          create: (permissions || []).map((p: { section: string; permission: string }) => ({
            section: p.section,
            permission: p.permission,
          })),
        },
      },
      include: {
        permissions: true,
        _count: {
          select: { users: true },
        },
      },
    });

    return NextResponse.json({ role });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
