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

  // Права по разделам (используются в UI для показа кнопок)
  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId: user.roleId },
    select: { section: true, permission: true },
  });

  const buildSectionPerms = (section: string) => {
    const isOwner = user.roleCode === 'OWNER';
    const isCEO = user.roleCode === 'CEO';
    if (isOwner || isCEO) {
      return {
        view: true,
        create: true,
        edit: true,
        delete: true,
        manage: true,
        view_all: true,
      };
    }
    const perms = rolePerms.filter((p) => p.section === section).map((p) => p.permission);
    const hasAny = (list: string[]) => perms.some((p) => list.includes(p));
    return {
      view: hasAny(['view', 'manage']),
      create: hasAny(['create', 'manage']),
      edit: hasAny(['edit', 'manage']),
      delete: hasAny(['delete', 'manage']),
      manage: hasAny(['manage']),
      view_all: hasAny(['view_all', 'manage']),
    };
  };

  const permissions = {
    employees: buildSectionPerms('employees'),
    contacts: buildSectionPerms('contacts'),
    agents: buildSectionPerms('agents'),
    invoices: buildSectionPerms('invoices'),
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
