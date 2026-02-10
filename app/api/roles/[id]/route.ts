import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canViewRoles = await hasPermission(user, 'roles', 'view');
    if (!canViewRoles) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        permissions: true,
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    return NextResponse.json({ role });
  } catch (error) {
    console.error('Error fetching role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Обновлять роли может тот, у кого есть полный доступ к разделу «Роли»
    const canManageRoles = await hasPermission(user, 'roles', 'manage');
    if (!canManageRoles) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, permissions } = body;

    const role = await prisma.role.findUnique({ where: { id: params.id } });
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Системные роли изменять нельзя
    if (role.isSystem) {
      return NextResponse.json({ error: 'Cannot modify system role' }, { status: 403 });
    }

    // Update role name if provided
    const updateData: any = {};
    if (name !== undefined) {
      updateData.name = name;
    }

    // Use transaction to update role and permissions
    const updated = await prisma.$transaction(async (tx) => {
      // Update role name
      if (Object.keys(updateData).length > 0) {
        await tx.role.update({
          where: { id: params.id },
          data: updateData,
        });
      }

      // Update permissions if provided
      if (permissions !== undefined) {
        // Delete all existing permissions
        await tx.rolePermission.deleteMany({
          where: { roleId: params.id },
        });

        // Create new permissions
        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((p: { section: string; permission: string }) => ({
              roleId: params.id,
              section: p.section,
              permission: p.permission,
            })),
          });
        }
      }

      // Return updated role with permissions
      return await tx.role.findUnique({
        where: { id: params.id },
        include: {
          permissions: true,
          _count: {
            select: { users: true },
          },
        },
      });
    });

    return NextResponse.json({ role: updated });
  } catch (error) {
    console.error('Error updating role:', error);
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

    // Удалять роли может тот, у кого есть полный доступ к разделу «Роли»
    const canManageRoles = await hasPermission(user, 'roles', 'manage');
    if (!canManageRoles) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Cannot delete system roles
    if (role.isSystem) {
      return NextResponse.json({ error: 'Cannot delete system role' }, { status: 400 });
    }

    // Cannot delete role if it has users
    if (role._count.users > 0) {
      return NextResponse.json(
        { error: `Cannot delete role: ${role._count.users} user(s) assigned` },
        { status: 400 }
      );
    }

    await prisma.role.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
