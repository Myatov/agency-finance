import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canDeleteService } from '@/lib/permissions';
import { ServiceStatus, BillingType } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = await prisma.service.findUnique({
      where: { id: params.id },
      include: {
        site: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        responsible: {
          select: {
            id: true,
            fullName: true,
          },
        },
        incomes: {
          select: {
            id: true,
            amount: true,
            incomeDate: true,
          },
          orderBy: {
            incomeDate: 'desc',
          },
          take: 10,
        },
        expenses: {
          select: {
            id: true,
            amount: true,
            paymentAt: true,
          },
          orderBy: {
            paymentAt: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Convert BigInt to string for JSON serialization
    const serviceResponse = {
      ...service,
      price: service.price !== null ? service.price.toString() : null,
      incomes: service.incomes.map(income => ({
        ...income,
        amount: income.amount.toString(),
      })),
      expenses: service.expenses.map(expense => ({
        ...expense,
        amount: expense.amount.toString(),
      })),
    };

    return NextResponse.json({ service: serviceResponse });
  } catch (error: any) {
    console.error('Error fetching service:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
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

    const body = await request.json();
    const {
      status,
      startDate,
      endDate,
      billingType,
      prepaymentType,
      price,
      autoRenew,
      responsibleUserId,
      comment,
    } = body;

    // Get existing service to check permissions
    const existingService = await prisma.service.findUnique({
      where: { id: params.id },
      include: {
        site: { include: { client: true } },
      },
    });

    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Permission check: OWNER, CEO can edit any service
    // ACCOUNT_MANAGER can edit services only for sites where they are account manager
    // SELLER can edit services only for sites of their clients
    if (user.roleCode !== 'OWNER' && user.roleCode !== 'CEO') {
      if (user.roleCode === 'ACCOUNT_MANAGER') {
        if (existingService.site.client.accountManagerId !== user.id) {
          return NextResponse.json({ error: 'Forbidden: You can only edit services for sites you manage' }, { status: 403 });
        }
      } else if (user.roleCode === 'SELLER') {
        // Need to fetch client to check seller
        const siteWithClient = await prisma.site.findUnique({
          where: { id: existingService.site.id },
          include: { client: true },
        });
        if (!siteWithClient || siteWithClient.client.sellerEmployeeId !== user.id) {
          return NextResponse.json({ error: 'Forbidden: You can only edit services for your clients' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const updateData: any = {};
    if (status !== undefined) {
      const validStatuses = ['ACTIVE', 'PAUSED', 'FINISHED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = status as ServiceStatus;
    }
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (billingType !== undefined) {
      const validBillingTypes = ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
      if (!validBillingTypes.includes(billingType)) {
        return NextResponse.json({ error: 'Invalid billingType' }, { status: 400 });
      }
      updateData.billingType = billingType as BillingType;
    }
    if (prepaymentType !== undefined) {
      const validPrepayment = ['FULL_PREPAY', 'PARTIAL_PREPAY', 'POSTPAY'];
      if (validPrepayment.includes(prepaymentType)) {
        updateData.prepaymentType = prepaymentType;
      }
    }
    if (price !== undefined) updateData.price = price ? BigInt(Math.round(parseFloat(price) * 100)) : null;
    if (autoRenew !== undefined) updateData.autoRenew = Boolean(autoRenew);
    if (responsibleUserId !== undefined) updateData.responsibleUserId = responsibleUserId || null;
    if (comment !== undefined) updateData.comment = comment || null;

    const service = await prisma.service.update({
      where: { id: params.id },
      data: updateData,
      include: {
        site: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        responsible: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Convert BigInt to string for JSON serialization
    const serviceResponse = {
      ...service,
      price: service.price !== null ? service.price.toString() : null,
    };

    return NextResponse.json({ service: serviceResponse });
  } catch (error: any) {
    console.error('Error updating service:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
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

    const allowedByPermission = await canDeleteService(user);
    if (!allowedByPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get existing service to check permissions
    const existingService = await prisma.service.findUnique({
      where: { id: params.id },
      include: {
        site: { include: { client: true } },
        incomes: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Permission check по роли и привязкам:
    // - OWNER, CEO: могут удалять любые услуги (уже прошли проверку по праву)
    // - ACCOUNT_MANAGER: только для сайтов, где они аккаунт-менеджеры
    // - SELLER: только для сайтов клиентов, за которыми они закреплены
    // - Другие роли: если есть право на удаление услуги, ограничений по сайту нет
    if (user.roleCode === 'ACCOUNT_MANAGER') {
      if (existingService.site.client.accountManagerId !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only delete services for sites you manage' },
          { status: 403 }
        );
      }
    } else if (user.roleCode === 'SELLER') {
      if (existingService.site.client.sellerEmployeeId !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only delete services for your clients' },
          { status: 403 }
        );
      }
    }

    // Check if service has incomes
    if (existingService.incomes.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete service with existing incomes' },
        { status: 400 }
      );
    }

    await prisma.service.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting service:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
