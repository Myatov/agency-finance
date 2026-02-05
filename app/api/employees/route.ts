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
    const where = viewAll ? {} : { id: user.id };

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

    return NextResponse.json({ employees });
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

    const employee = await prisma.user.create({
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
      },
      include: {
        department: true,
        role: true,
      },
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
