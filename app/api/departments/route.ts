import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const departments = await prisma.department.findMany({
      include: {
        head: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ departments });
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
