import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const department = await prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

    const schedule = await prisma.departmentPaymentSchedule.findUnique({
      where: { departmentId: id },
    });

    return NextResponse.json({
      departmentId: id,
      departmentName: department.name,
      payDay1: schedule?.payDay1 ?? 1,
      payDay2: schedule?.payDay2 ?? 15,
    });
  } catch (e: any) {
    console.error('GET departments/[id]/payment-schedule', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.roleCode !== 'OWNER' && user.roleCode !== 'CEO') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const department = await prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

    const body = await request.json();
    const { payDay1, payDay2 } = body;

    if (payDay1 == null || payDay2 == null) {
      return NextResponse.json({ error: 'payDay1 and payDay2 are required' }, { status: 400 });
    }

    const d1 = Number(payDay1);
    const d2 = Number(payDay2);
    if (!Number.isInteger(d1) || d1 < 1 || d1 > 28) {
      return NextResponse.json({ error: 'payDay1 must be an integer between 1 and 28' }, { status: 400 });
    }
    if (!Number.isInteger(d2) || d2 < 1 || d2 > 28) {
      return NextResponse.json({ error: 'payDay2 must be an integer between 1 and 28' }, { status: 400 });
    }

    const schedule = await prisma.departmentPaymentSchedule.upsert({
      where: { departmentId: id },
      update: { payDay1: d1, payDay2: d2 },
      create: { departmentId: id, payDay1: d1, payDay2: d2 },
    });

    return NextResponse.json({
      departmentId: id,
      departmentName: department.name,
      payDay1: schedule.payDay1,
      payDay2: schedule.payDay2,
    });
  } catch (e: any) {
    console.error('PUT departments/[id]/payment-schedule', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
