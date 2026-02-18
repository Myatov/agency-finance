import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageUsers, hasViewAllPermission } from '@/lib/permissions';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const viewAll = await hasViewAllPermission(user, 'employees');
    let where: { id?: string; departmentId?: string } = viewAll ? {} : { id: user.id };
    // HEAD видит только сотрудников своего отдела (как в блоке Команда)
    if (viewAll && user.roleCode === 'HEAD' && user.departmentId) {
      where = { departmentId: user.departmentId };
    }

    const employees = await prisma.user.findMany({
      where,
      include: {
        department: true,
        role: true,
      },
      orderBy: [
        { department: { name: 'asc' } },
        { fullName: 'asc' },
      ],
    });

    const out = JSON.parse(JSON.stringify(employees, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ employees: out });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      fullName,
      departmentId,
      roleId,
      password,
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

    if (!fullName || !roleId || !password) {
      return NextResponse.json(
        { error: 'FullName, roleId, and password are required' },
        { status: 400 }
      );
    }

    // Check permissions
    const targetDepartment = departmentId
      ? await prisma.department.findUnique({ where: { id: departmentId } })
      : null;

    // HEAD can only add employees to their own department
    if (user.roleCode === 'HEAD' && targetDepartment?.id !== user.departmentId) {
      return NextResponse.json(
        { error: 'Forbidden: Руководитель может добавлять сотрудников только в свой отдел' },
        { status: 403 }
      );
    }

    if (!(await canManageUsers(user, undefined, targetDepartment?.id || null))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify role exists
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const fixedSalaryBigInt = fixedSalary !== undefined && fixedSalary !== null && fixedSalary !== '' ? BigInt(fixedSalary) : undefined;
    const officialSalaryBigInt = officialSalary !== undefined && officialSalary !== null && officialSalary !== '' ? BigInt(officialSalary) : undefined;
    const salaryTaxPercentNum = salaryTaxPercent !== undefined && salaryTaxPercent !== null && salaryTaxPercent !== '' ? Number(salaryTaxPercent) : undefined;

    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName,
          departmentId: departmentId || null,
          roleId,
          passwordHash,
          isActive: true,
          birthDate: birthDate ? new Date(birthDate) : undefined,
          workStartDate: workStartDate ? new Date(workStartDate) : undefined,
          emailWork: emailWork || undefined,
          emailGoogle: emailGoogle || undefined,
          phonePersonal: phonePersonal || undefined,
          phoneWork: phoneWork || undefined,
          telegramPersonal: telegramPersonal || undefined,
          telegramWork: telegramWork || undefined,
          hasSpouse: hasSpouse === true || hasSpouse === false ? hasSpouse : undefined,
          hasChildren: hasChildren === true || hasChildren === false ? hasChildren : undefined,
          childrenCount: childrenCount !== undefined && childrenCount !== null && childrenCount !== '' ? Number(childrenCount) : undefined,
          childrenBirthDates: childrenBirthDates || undefined,
          fixedSalary: fixedSalaryBigInt,
          officialSalary: officialSalaryBigInt,
          salaryTaxPercent: salaryTaxPercentNum,
        },
        include: {
          department: true,
          role: true,
        },
      });

      if (fixedSalaryBigInt !== undefined) {
        await tx.userFixedSalaryHistory.create({
          data: {
            userId: created.id,
            amount: fixedSalaryBigInt,
            effectiveFrom: new Date(),
          },
        });
      }

      return created;
    });

    const out = JSON.parse(JSON.stringify(employee, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ employee: out });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
