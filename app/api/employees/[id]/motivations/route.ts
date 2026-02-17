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

    // Only OWNER/CEO can view motivations
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

    const motivations = await prisma.userMotivation.findMany({
      where: { userId: params.id },
      orderBy: { periodFrom: 'desc' },
    });

    const out = JSON.parse(JSON.stringify(motivations, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ motivations: out });
  } catch (error) {
    console.error('Error fetching motivations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only OWNER/CEO can manage motivations
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

    const body = await request.json();
    const { periodFrom, periodTo, targetAmount, bonusAmount, description } = body;

    if (!periodFrom || !periodTo) {
      return NextResponse.json(
        { error: 'periodFrom and periodTo are required' },
        { status: 400 }
      );
    }

    const motivation = await prisma.userMotivation.create({
      data: {
        userId: params.id,
        periodFrom: new Date(periodFrom),
        periodTo: new Date(periodTo),
        targetAmount: targetAmount !== undefined && targetAmount !== null && targetAmount !== '' ? BigInt(targetAmount) : null,
        bonusAmount: bonusAmount !== undefined && bonusAmount !== null && bonusAmount !== '' ? BigInt(bonusAmount) : null,
        description: description || null,
      },
    });

    const out = JSON.parse(JSON.stringify(motivation, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ motivation: out });
  } catch (error) {
    console.error('Error creating motivation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
