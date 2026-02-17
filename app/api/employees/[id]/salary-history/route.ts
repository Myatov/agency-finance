import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only OWNER/CEO can view salary history
    if (user.roleCode !== 'OWNER' && user.roleCode !== 'CEO') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const employee = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const history = await prisma.userFixedSalaryHistory.findMany({
      where: { userId: params.id },
      orderBy: { effectiveFrom: 'desc' },
    });

    const out = JSON.parse(JSON.stringify(history, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ history: out });
  } catch (error) {
    console.error('Error fetching salary history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
