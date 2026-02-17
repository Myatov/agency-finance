import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.roleCode !== 'OWNER' && user.roleCode !== 'CEO') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clients = await prisma.client.findMany({
      where: {
        accountManagerId: null,
        isSystem: false,
      },
      include: {
        seller: { select: { id: true, fullName: true } },
        agent: { select: { id: true, name: true } },
        legalEntity: { select: { id: true, name: true } },
        sites: {
          select: {
            id: true,
            title: true,
            niche: true,
            services: {
              select: {
                id: true,
                status: true,
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ clients }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    console.error('Error fetching unassigned clients:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error?.message : undefined },
      { status: 500 }
    );
  }
}
