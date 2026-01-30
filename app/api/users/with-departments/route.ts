import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { department: { name: 'asc' } },
        { fullName: 'asc' },
      ],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users with departments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
