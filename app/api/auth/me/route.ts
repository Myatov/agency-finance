import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDefaultRoute } from '@/lib/permissions';
import { prisma } from '@/lib/db';

export async function GET() {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const defaultRoute = await getDefaultRoute(user);

  // Права по разделу «Команда» для отображения кнопок Редактировать/Удалить
  const employeePerms = await prisma.rolePermission.findMany({
    where: { roleId: user.roleId, section: 'employees' },
    select: { permission: true },
  });
  const permissions = {
    employees: {
      view: user.roleCode === 'OWNER' || user.roleCode === 'CEO' || employeePerms.some((p) => ['view', 'manage'].includes(p.permission)),
      create: user.roleCode === 'OWNER' || user.roleCode === 'CEO' || employeePerms.some((p) => ['create', 'manage'].includes(p.permission)),
      edit: user.roleCode === 'OWNER' || user.roleCode === 'CEO' || employeePerms.some((p) => ['edit', 'manage'].includes(p.permission)),
      delete: user.roleCode === 'OWNER' || user.roleCode === 'CEO' || employeePerms.some((p) => ['delete', 'manage'].includes(p.permission)),
      manage: user.roleCode === 'OWNER' || user.roleCode === 'CEO' || employeePerms.some((p) => p.permission === 'manage'),
      view_all: user.roleCode === 'OWNER' || user.roleCode === 'CEO' || employeePerms.some((p) => ['view_all', 'manage'].includes(p.permission)),
    },
  };

  return NextResponse.json({
    user: {
      id: user.id,
      fullName: user.fullName,
      roleCode: user.roleCode,
      roleId: user.roleId,
      departmentId: user.departmentId,
      permissions,
    },
    defaultRoute,
  });
}
