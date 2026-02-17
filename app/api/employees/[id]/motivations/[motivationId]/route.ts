import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; motivationId: string } }
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

    const existing = await prisma.userMotivation.findFirst({
      where: { id: params.motivationId, userId: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Motivation not found' }, { status: 404 });
    }

    const body = await request.json();
    const { periodFrom, periodTo, targetAmount, bonusAmount, description } = body;

    const updateData: any = {};
    if (periodFrom !== undefined) updateData.periodFrom = new Date(periodFrom);
    if (periodTo !== undefined) updateData.periodTo = new Date(periodTo);
    if (targetAmount !== undefined) updateData.targetAmount = targetAmount !== null && targetAmount !== '' ? BigInt(targetAmount) : null;
    if (bonusAmount !== undefined) updateData.bonusAmount = bonusAmount !== null && bonusAmount !== '' ? BigInt(bonusAmount) : null;
    if (description !== undefined) updateData.description = description || null;

    const updated = await prisma.userMotivation.update({
      where: { id: params.motivationId },
      data: updateData,
    });

    const out = JSON.parse(JSON.stringify(updated, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ motivation: out });
  } catch (error) {
    console.error('Error updating motivation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; motivationId: string } }
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

    const existing = await prisma.userMotivation.findFirst({
      where: { id: params.motivationId, userId: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Motivation not found' }, { status: 404 });
    }

    await prisma.userMotivation.delete({
      where: { id: params.motivationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting motivation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
