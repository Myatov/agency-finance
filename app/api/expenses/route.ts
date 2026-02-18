import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasViewAllPermission } from '@/lib/permissions';
import { parseAmount } from '@/lib/utils';
import { notifyExpense } from '@/lib/telegram';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const category = searchParams.get('category');
    const costItemId = searchParams.get('costItemId');
    const departmentId = searchParams.get('departmentId');
    const employeeId = searchParams.get('employeeId');
    const siteId = searchParams.get('siteId');
    const serviceId = searchParams.get('serviceId');
    const clientId = searchParams.get('clientId');
    const legalEntityId = searchParams.get('legalEntityId');

    let where: any = {};
    if (dateFrom || dateTo) {
      where.paymentAt = {};
      if (dateFrom) where.paymentAt.gte = new Date(dateFrom);
      if (dateTo) where.paymentAt.lte = new Date(dateTo + 'T23:59:59');
    }

    const viewAll = await hasViewAllPermission(user, 'expenses');
    if (!viewAll) {
      where.OR = [
        { createdByUserId: user.id },
        { employeeId: user.id },
        { site: { client: { accountManagerId: user.id } } },
        { site: { creatorId: user.id } },
      ];
    }

    if (category) {
      where.costItem = { costCategoryId: category };
    }

    if (costItemId) {
      where.costItemId = costItemId;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    } else if (employeeId === 'null') {
      where.employeeId = null;
    }

    if (departmentId) {
      where.employee = { departmentId };
    }

    if (siteId) {
      where.siteId = siteId;
    } else if (siteId === 'null') {
      where.siteId = null;
    }

    if (serviceId) {
      where.serviceId = serviceId;
    } else if (serviceId === 'null') {
      where.serviceId = null;
    }

    if (clientId) {
      where.site = { clientId };
    }

    if (legalEntityId) {
      where.legalEntityId = legalEntityId;
    }

    const sortBy = searchParams.get('sortBy') || 'paymentAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const allowedSortFields = [
      'paymentAt', 'amount', 'createdAt', 'updatedAt', 'title',
    ];
    const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'paymentAt';

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        costItem: {
          include: {
            costCategory: true,
          },
        },
        employee: {
          select: {
            id: true,
            fullName: true,
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
      orderBy: { [orderByField]: sortOrder },
    });

    const serialized = expenses.map((e) => ({
      ...e,
      amount: e.amount.toString(),
      isWithdrawal: e.isWithdrawal,
      ...(e.service && {
        service: {
          id: e.service.id,
          product: e.service.product,
          price: e.service.price != null ? e.service.price.toString() : null,
        },
      }),
    }));

    return NextResponse.json({ expenses: serialized });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, costItemId, employeeId, siteId, serviceId, legalEntityId, isWithdrawal, paymentAt, comment } = body;
    
    // Normalize comment: empty string or undefined becomes null
    const normalizedComment = comment && comment.trim() ? comment.trim() : null;
    // Normalize legalEntityId: empty string becomes null
    const normalizedLegalEntityId = legalEntityId && legalEntityId.trim() ? legalEntityId : null;

    if (!amount || !costItemId) {
      return NextResponse.json(
        { error: 'Amount and costItemId are required' },
        { status: 400 }
      );
    }

    const costItem = await prisma.costItem.findUnique({
      where: { id: costItemId },
    });

    if (!costItem) {
      return NextResponse.json({ error: 'Cost item not found' }, { status: 404 });
    }

    // If serviceId is provided, verify it exists and belongs to the site
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

    const amountBigInt = parseAmount(amount);

    const expense = await prisma.expense.create({
      data: {
        amount: amountBigInt,
        costItemId,
        title: costItem.title,
        employeeId: employeeId || null,
        siteId: siteId || null,
        serviceId: serviceId || null,
        legalEntityId: normalizedLegalEntityId,
        isWithdrawal: isWithdrawal === true,
        comment: normalizedComment,
        createdByUserId: user.id,
        paymentAt: paymentAt ? new Date(paymentAt) : new Date(),
      },
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
      },
    });

    const expenseForJson = {
      ...expense,
      amount: expense.amount.toString(),
      ...(expense.service && {
        service: {
          ...expense.service,
          price: expense.service.price != null ? expense.service.price.toString() : null,
        },
      }),
    };

    notifyExpense(
      {
        amount: expense.amount,
        paymentAt: expense.paymentAt,
        comment: expense.comment,
        creator: expense.creator,
        costItem: expense.costItem,
        employee: expense.employee,
        site: expense.site,
        service: expense.service,
        legalEntity: expense.legalEntity,
      },
      false
    ).catch((err) => console.error('[Telegram] notifyExpense error:', err));

    return NextResponse.json({
      expense: expenseForJson,
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack, error });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}
