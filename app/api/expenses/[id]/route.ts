import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditExpense } from '@/lib/permissions';
import { parseAmount } from '@/lib/utils';
import { notifyExpense } from '@/lib/telegram';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        costItem: {
          include: { costCategory: true },
        },
        employee: {
          include: {
            department: true,
          },
        },
        site: {
          include: {
            client: true,
          },
        },
        service: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        legalEntity: {
          select: { id: true, name: true },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
        updater: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json({
      expense: {
        ...expense,
        amount: expense.amount.toString(),
      },
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const canEdit = await canEditExpense(user, expense.createdByUserId);
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { amount, costItemId, employeeId, siteId, serviceId, legalEntityId, isWithdrawal, paymentAt, comment } = body;

    const updateData: any = {
      updatedAt: new Date(),
      updatedByUserId: user.id,
    };

    if (amount) {
      updateData.amount = parseAmount(amount);
    }
    if (costItemId) {
      const costItem = await prisma.costItem.findUnique({
        where: { id: costItemId },
      });
      if (costItem) {
        updateData.costItemId = costItemId;
        updateData.title = costItem.title;
      }
    }
    if (employeeId !== undefined) {
      updateData.employeeId = employeeId || null;
    }
    if (siteId !== undefined) {
      updateData.siteId = siteId || null;
    }
    if (serviceId !== undefined) {
      // Verify service exists and belongs to site if siteId is provided
      if (serviceId) {
        const service = await prisma.service.findUnique({
          where: { id: serviceId },
        });
        if (!service) {
          return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }
        if (siteId && service.siteId !== siteId) {
          return NextResponse.json(
            { error: 'Service does not belong to the specified site' },
            { status: 400 }
          );
        }
      }
      updateData.serviceId = serviceId || null;
    }
    if (legalEntityId !== undefined) {
      updateData.legalEntityId = (legalEntityId && typeof legalEntityId === 'string' && legalEntityId.trim()) ? legalEntityId : null;
    }
    if (isWithdrawal !== undefined) {
      updateData.isWithdrawal = isWithdrawal === true;
    }
    // Only OWNER and CEO can change paymentAt date
    if (paymentAt && (user.roleCode === 'OWNER' || user.roleCode === 'CEO')) {
      updateData.paymentAt = new Date(paymentAt);
    }
    if (comment !== undefined) {
      updateData.comment = comment || null;
    }

    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: updateData,
      include: {
        costItem: {
          include: { costCategory: true },
        },
        employee: {
          include: {
            department: true,
          },
        },
        site: {
          include: {
            client: true,
          },
        },
        service: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        legalEntity: {
          select: { id: true, name: true },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
        updater: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    const expenseForJson = {
      ...updated,
      amount: updated.amount.toString(),
      ...(updated.service && {
        service: {
          ...updated.service,
          price: updated.service.price != null ? updated.service.price.toString() : null,
        },
      }),
    };

    notifyExpense(
      {
        amount: updated.amount,
        paymentAt: updated.paymentAt,
        comment: updated.comment,
        creator: updated.creator,
        updater: updated.updater,
        costItem: updated.costItem,
        employee: updated.employee,
        site: updated.site,
        service: updated.service,
        legalEntity: updated.legalEntity,
      },
      true
    ).catch((err) => console.error('[Telegram] notifyExpense error:', err));

    return NextResponse.json({
      expense: expenseForJson,
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Only OWNER and CEO can delete expenses
    if (user.roleCode !== 'OWNER' && user.roleCode !== 'CEO') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.expense.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
