import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDefaultRoute } from '@/lib/permissions';

export async function GET() {
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const defaultRoute = await getDefaultRoute(user);

  return NextResponse.json({
    user: {
      id: user.id,
      fullName: user.fullName,
      roleCode: user.roleCode,
      roleId: user.roleId,
      departmentId: user.departmentId,
    },
    defaultRoute,
  });
}
