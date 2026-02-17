import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const agentId = cookieStore.get('agentPortal')?.value;

    if (!agentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        clients: {
          include: {
            sites: {
              include: {
                services: {
                  where: { status: 'ACTIVE' },
                  include: {
                    product: { select: { id: true, name: true } },
                    workPeriods: {
                      orderBy: { dateFrom: 'desc' },
                      take: 1,
                      include: {
                        incomes: { select: { amount: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const serialized = JSON.parse(
      JSON.stringify(agent, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    );

    return NextResponse.json({ agent: serialized });
  } catch (e: any) {
    console.error('Agent portal me error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
