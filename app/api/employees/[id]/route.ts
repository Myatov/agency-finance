import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditEmployee, canDeleteEmployee, canChangePassword } from '@/lib/permissions';
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
        fixedSalaryHistory: {
          orderBy: { effectiveFrom: 'desc' },
        },
        motivations: {
          orderBy: { periodFrom: 'desc' },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const out = JSON.parse(JSON.stringify(employee, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ employee: out });
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

    if (!(await canEditEmployee(user, targetEmployee.departmentId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      fullName,
      departmentId,
      roleId,
      isActive,
      birthDate,
      workStartDate,
      emailWork,
      emailGoogle,
      phonePersonal,
      phoneWork,
      telegramPersonal,
      telegramWork,
      hasSpouse,
      hasChildren,
      childrenCount,
      childrenBirthDates,
      fixedSalary,
      officialSalary,
      salaryTaxPercent,
    } = body;

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
    if (roleId) updateData.roleId = roleId;
    if (birthDate !== undefined) updateData.birthDate = birthDate ? new Date(birthDate) : null;
    if (workStartDate !== undefined) updateData.workStartDate = workStartDate ? new Date(workStartDate) : null;
    if (emailWork !== undefined) updateData.emailWork = emailWork || null;
    if (emailGoogle !== undefined) updateData.emailGoogle = emailGoogle || null;
    if (phonePersonal !== undefined) updateData.phonePersonal = phonePersonal || null;
    if (phoneWork !== undefined) updateData.phoneWork = phoneWork || null;
    if (telegramPersonal !== undefined) updateData.telegramPersonal = telegramPersonal || null;
    if (telegramWork !== undefined) updateData.telegramWork = telegramWork || null;
    if (hasSpouse === true || hasSpouse === false) updateData.hasSpouse = hasSpouse;
    if (hasChildren === true || hasChildren === false) updateData.hasChildren = hasChildren;
    if (childrenCount !== undefined && childrenCount !== null && childrenCount !== '') updateData.childrenCount = Number(childrenCount);
    if (childrenBirthDates !== undefined) updateData.childrenBirthDates = childrenBirthDates || null;
    if (fixedSalary !== undefined) updateData.fixedSalary = fixedSalary !== null && fixedSalary !== '' ? BigInt(fixedSalary) : null;
    if (officialSalary !== undefined) updateData.officialSalary = officialSalary !== null && officialSalary !== '' ? BigInt(officialSalary) : null;
    if (salaryTaxPercent !== undefined) updateData.salaryTaxPercent = salaryTaxPercent !== null && salaryTaxPercent !== '' ? Number(salaryTaxPercent) : null;

    // Check if fixedSalary changed — create history record
    const newFixedSalary = fixedSalary !== undefined && fixedSalary !== null && fixedSalary !== ''
      ? BigInt(fixedSalary)
      : undefined;
    const oldFixedSalary = targetEmployee.fixedSalary;
    const fixedSalaryChanged = newFixedSalary !== undefined && newFixedSalary !== oldFixedSalary;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: params.id },
        data: updateData,
        include: {
          department: true,
          role: true,
        },
      });

      if (fixedSalaryChanged && newFixedSalary !== undefined) {
        await tx.userFixedSalaryHistory.create({
          data: {
            userId: params.id,
            amount: newFixedSalary,
            effectiveFrom: new Date(),
          },
        });
      }

      return result;
    });

    const out = JSON.parse(JSON.stringify(updated, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ employee: out });
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

    if (!(await canDeleteEmployee(user, targetEmployee.departmentId))) {
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
