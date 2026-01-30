import { NextRequest, NextResponse } from 'next/server';
import { login, setSession } from '@/lib/auth';
import { getDefaultRoute } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const user = await login(password);

    if (!user) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    await setSession(user.id);
    const defaultRoute = await getDefaultRoute(user);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        roleCode: user.roleCode,
        roleId: user.roleId,
        departmentId: user.departmentId,
      },
      defaultRoute,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
