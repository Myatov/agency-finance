import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageUsers, canChangePassword } from '@/lib/permissions';
import bcrypt from 'bcryptjs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employee = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        department: true,
        role: true,
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Error fetching employee:', error);
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

    const targetEmployee = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        department: true,
        role: true,
      },
    });

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!(await canManageUsers(user, params.id, targetEmployee.departmentId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { fullName, departmentId, roleId, isActive } = body;

    // Verify role exists if provided
    if (roleId) {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role) {
        return NextResponse.json({ error: 'Role not found' }, { status: 400 });
      }
    }

    const updateData: any = {
      fullName,
      departmentId: departmentId || null,
      isActive,
    };

    if (roleId) {
      updateData.roleId = roleId;
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      include: {
        department: true,
        role: true,
      },
    });

    return NextResponse.json({ employee: updated });
  } catch (error) {
    console.error('Error updating employee:', error);
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

    const targetEmployee = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        department: true,
      },
    });

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!(await canManageUsers(user, params.id, targetEmployee.departmentId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if employee has critical relationships
    const [clientsAsSeller, projectsAsCreator, projectsAsManager] = await Promise.all([
      prisma.client.count({ where: { sellerEmployeeId: params.id } }),
      prisma.site.count({ where: { creatorId: params.id } }),
      prisma.site.count({ where: { accountManagerId: params.id } }),
    ]);

    // Find OWNER user for reassignment if needed
    const ownerRole = await prisma.role.findUnique({ where: { code: 'OWNER' } });
    if (!ownerRole) {
      return NextResponse.json(
        { error: 'Роль OWNER не найдена в системе' },
        { status: 500 }
      );
    }
    const owner = await prisma.user.findFirst({
      where: { roleId: ownerRole.id, isActive: true },
    });

    if (!owner) {
      return NextResponse.json(
        { error: 'Не найден активный владелец для переназначения связей' },
        { status: 500 }
      );
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Reassign clients to OWNER if employee is their seller
      if (clientsAsSeller > 0) {
        await tx.client.updateMany({
          where: { sellerEmployeeId: params.id },
          data: { sellerEmployeeId: owner.id },
        });
      }

      // Reassign sites creator to OWNER if employee created them
      if (projectsAsCreator > 0) {
        await tx.site.updateMany({
          where: { creatorId: params.id },
          data: { creatorId: owner.id },
        });
      }

      // Clear account manager from sites (nullable field)
      if (projectsAsManager > 0) {
        await tx.site.updateMany({
          where: { accountManagerId: params.id },
          data: { accountManagerId: null },
        });
      }

      // Delete the employee completely
      await tx.user.delete({
        where: { id: params.id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    
    // Handle Prisma foreign key constraint errors
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Невозможно удалить сотрудника: есть связанные данные, которые не могут быть переназначены' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
