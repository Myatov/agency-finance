import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
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
        expenseItems: { include: { template: true } },
      },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Convert BigInt to string for JSON serialization (service has price, sellerCommissionAmount, accountManagerCommissionAmount, accountManagerFeeAmount, expenseItems[].calculatedAmount)
    const serviceResponse = JSON.parse(JSON.stringify(service, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));

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
      isFromPartner,
      sellerCommissionPercent,
      sellerCommissionAmount,
      accountManagerCommissionPercent,
      accountManagerCommissionAmount,
      accountManagerFeeAmount,
      expenseItems: expenseItemsPayload,
    } = body;

    // Get existing service to check permissions and expense items
    const existingService = await prisma.service.findUnique({
      where: { id: params.id },
      include: {
        site: { include: { client: true } },
        expenseItems: { include: { template: true, responsible: { select: { fullName: true } } } },
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
    if (price !== undefined) {
      const priceNum = price != null && price !== '' ? parseFloat(price) : NaN;
      updateData.price = !isNaN(priceNum) ? BigInt(Math.round(priceNum * 100)) : null;
    }
    if (autoRenew !== undefined) updateData.autoRenew = Boolean(autoRenew);
    if (responsibleUserId !== undefined) updateData.responsibleUserId = responsibleUserId || null;
    if (comment !== undefined) updateData.comment = comment || null;
    if (isFromPartner !== undefined) updateData.isFromPartner = Boolean(isFromPartner);
    if (sellerCommissionPercent !== undefined) updateData.sellerCommissionPercent = sellerCommissionPercent != null ? parseFloat(sellerCommissionPercent) : null;
    if (sellerCommissionAmount !== undefined) updateData.sellerCommissionAmount = sellerCommissionAmount != null ? BigInt(Math.round(Number(sellerCommissionAmount))) : null;
    if (accountManagerCommissionPercent !== undefined) updateData.accountManagerCommissionPercent = accountManagerCommissionPercent != null ? parseFloat(accountManagerCommissionPercent) : null;
    if (accountManagerCommissionAmount !== undefined) updateData.accountManagerCommissionAmount = accountManagerCommissionAmount != null ? BigInt(Math.round(Number(accountManagerCommissionAmount))) : null;
    if (accountManagerFeeAmount !== undefined) updateData.accountManagerFeeAmount = accountManagerFeeAmount != null ? BigInt(Math.round(Number(accountManagerFeeAmount))) : null;

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

    const priceKopecks = service.price;
    if (expenseItemsPayload !== undefined && Array.isArray(expenseItemsPayload)) {
      const oldItems = existingService.expenseItems.map((ei) => ({
        name: ei.name,
        valueType: ei.valueType,
        value: ei.value,
        responsibleUserId: ei.responsibleUserId,
        responsibleName: ei.responsible?.fullName,
      }));
      await prisma.serviceExpenseItem.deleteMany({ where: { serviceId: params.id } });
      if (expenseItemsPayload.length > 0) {
        await prisma.serviceExpenseItem.createMany({
          data: expenseItemsPayload.map((item: any) => ({
            serviceId: params.id,
            expenseItemTemplateId: item.expenseItemTemplateId || null,
            responsibleUserId: item.responsibleUserId || null,
            name: item.name || 'Без названия',
            valueType: item.valueType || 'PERCENT',
            value: item.value != null ? parseFloat(item.value) : 0,
            calculatedAmount: priceKopecks && item.valueType === 'PERCENT'
              ? BigInt(Math.round(Number(priceKopecks) * parseFloat(item.value) / 100))
              : item.valueType === 'FIXED' ? BigInt(Math.round(parseFloat(item.value) * 100)) : null,
          })),
        });
      }
      const newItems = expenseItemsPayload.map((item: any) => ({
        name: item.name,
        valueType: item.valueType,
        value: item.value,
        responsibleUserId: item.responsibleUserId,
      }));
      const descParts: string[] = [];
      if (oldItems.length > 0 || newItems.length > 0) {
        descParts.push(`Статьи расходов: ${oldItems.length} → ${newItems.length}`);
      }
      if (descParts.length > 0) {
        await logAudit({
          userId: user.id,
          action: 'UPDATE',
          entityType: 'SERVICE_EXPENSE_ITEM',
          entityId: params.id,
          serviceId: params.id,
          description: `Изменение расходов проекта: ${descParts.join('; ')}`,
          oldValue: oldItems,
          newValue: newItems,
        });
      }
    }

    // Audit logging
    const changes: string[] = [];
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    if (price !== undefined && existingService.price !== null) {
      const oldPrice = Number(existingService.price) / 100;
      const newPrice = price ? parseFloat(price) : 0;
      if (oldPrice !== newPrice) {
        changes.push(`Цена: ${oldPrice} → ${newPrice}`);
        oldValues.price = oldPrice;
        newValues.price = newPrice;
      }
    } else if (price !== undefined && existingService.price === null) {
      const newPrice = price ? parseFloat(price) : null;
      if (newPrice !== null) {
        changes.push(`Цена установлена: ${newPrice}`);
        newValues.price = newPrice;
      }
    }

    if (status !== undefined && existingService.status !== status) {
      changes.push(`Статус: ${existingService.status} → ${status}`);
      oldValues.status = existingService.status;
      newValues.status = status;
    }

    if (billingType !== undefined && existingService.billingType !== billingType) {
      changes.push(`Тип оплаты: ${existingService.billingType} → ${billingType}`);
      oldValues.billingType = existingService.billingType;
      newValues.billingType = billingType;
    }

    if (sellerCommissionPercent !== undefined) {
      const oldVal = existingService.sellerCommissionPercent;
      const newVal = sellerCommissionPercent != null ? parseFloat(sellerCommissionPercent) : null;
      if (oldVal !== newVal) {
        changes.push(`Комиссия продавца %: ${oldVal ?? '—'} → ${newVal ?? '—'}`);
        oldValues.sellerCommissionPercent = oldVal;
        newValues.sellerCommissionPercent = newVal;
      }
    }

    if (sellerCommissionAmount !== undefined) {
      const oldVal = existingService.sellerCommissionAmount !== null ? Number(existingService.sellerCommissionAmount) / 100 : null;
      const newVal = sellerCommissionAmount != null ? Math.round(Number(sellerCommissionAmount)) / 100 : null;
      if (oldVal !== newVal) {
        changes.push(`Сумма комиссии продавца: ${oldVal ?? '—'} → ${newVal ?? '—'}`);
        oldValues.sellerCommissionAmount = oldVal;
        newValues.sellerCommissionAmount = newVal;
      }
    }

    if (accountManagerCommissionPercent !== undefined) {
      const oldVal = existingService.accountManagerCommissionPercent;
      const newVal = accountManagerCommissionPercent != null ? parseFloat(accountManagerCommissionPercent) : null;
      if (oldVal !== newVal) {
        changes.push(`Комиссия АМ %: ${oldVal ?? '—'} → ${newVal ?? '—'}`);
        oldValues.accountManagerCommissionPercent = oldVal;
        newValues.accountManagerCommissionPercent = newVal;
      }
    }

    if (changes.length > 0) {
      await logAudit({
        userId: user.id,
        action: 'UPDATE',
        entityType: 'SERVICE',
        entityId: params.id,
        serviceId: params.id,
        description: `Изменение услуги: ${changes.join('; ')}`,
        oldValue: oldValues,
        newValue: newValues,
      });
    }

    // Convert BigInt to string for JSON serialization
    const serviceResponse = JSON.parse(JSON.stringify(service, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));

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
