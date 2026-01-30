import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { section, permission } = body;

    if (!section || !permission) {
      return NextResponse.json({ error: 'Section and permission are required' }, { status: 400 });
    }

    const hasAccess = await hasPermission(user, section, permission as any);

    return NextResponse.json({ hasPermission: hasAccess });
  } catch (error) {
    console.error('Error checking permission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
