import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only OWNER and CEO can manage departments
    if (user.roleCode !== 'OWNER' && user.roleCode !== 'CEO') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { headId } = body;

    // If headId is provided, verify that user exists and belongs to this department
    if (headId !== null && headId !== undefined) {
      const headUser = await prisma.user.findUnique({
        where: { id: headId },
      });

      if (!headUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (headUser.departmentId !== params.id) {
        return NextResponse.json(
          { error: 'User must belong to this department' },
          { status: 400 }
        );
      }
    }

    const department = await prisma.department.update({
      where: { id: params.id },
      data: {
        headId: headId || null,
      },
      include: {
        head: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json({ department });
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
