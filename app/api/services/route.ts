import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasViewAllPermission } from '@/lib/permissions';
import { getExpectedPeriods } from '@/lib/periods';
import { ServiceStatus, BillingType } from '@prisma/client';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const status = searchParams.get('status') as ServiceStatus | null;

    const where: any = {};
    if (siteId) {
      where.siteId = siteId;
    }
    if (status) {
      where.status = status;
    }

    const viewAll = await hasViewAllPermission(user, 'services');
    if (!viewAll) {
      where.OR = [
        { site: { client: { accountManagerId: user.id } } },
        { site: { creatorId: user.id } },
        { responsibleUserId: user.id },
        { site: { client: { sellerEmployeeId: user.id } } },
      ];
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        site: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                sellerEmployeeId: true,
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
      orderBy: [
        { status: 'asc' },
        { startDate: 'desc' },
      ],
    });

    // Convert BigInt to string for JSON serialization
    const servicesResponse = services.map(service => ({
      ...service,
      price: service.price !== null ? service.price.toString() : null,
    }));

    return NextResponse.json({ services: servicesResponse });
  } catch (error: any) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      siteId,
      productId,
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
      accountManagerCommissionPercent,
      accountManagerFeeAmount,
      expenseItems: expenseItemsPayload,
    } = body;

    if (!siteId || !productId || !startDate || !billingType) {
      return NextResponse.json(
        { error: 'siteId, productId, startDate, and billingType are required' },
        { status: 400 }
      );
    }

    // Validate enums
    const validStatuses = ['ACTIVE', 'PAUSED', 'FINISHED'];
    const validBillingTypes = ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY'];

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (!validBillingTypes.includes(billingType)) {
      return NextResponse.json({ error: 'Invalid billingType' }, { status: 400 });
    }

    // Check if user has access to this site
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: {
        client: true,
      },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Permission check: OWNER, CEO can create services for any site
    // ACCOUNT_MANAGER can create services only for sites where they are account manager
    // SELLER can create services only for sites of their clients
    if (user.roleCode !== 'OWNER' && user.roleCode !== 'CEO') {
      if (user.roleCode === 'ACCOUNT_MANAGER') {
        if (site.client.accountManagerId !== user.id) {
          return NextResponse.json({ error: 'Forbidden: You can only create services for clients you manage' }, { status: 403 });
        }
      } else if (user.roleCode === 'SELLER') {
        if (site.client.sellerEmployeeId !== user.id) {
          return NextResponse.json({ error: 'Forbidden: You can only create services for your clients' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const validPrepayment = ['FULL_PREPAY', 'PARTIAL_PREPAY', 'POSTPAY'];
    const prepay = prepaymentType && validPrepayment.includes(prepaymentType) ? prepaymentType : 'POSTPAY';

    const priceKopecks = price ? BigInt(Math.round(parseFloat(price) * 100)) : null;

    const service = await prisma.service.create({
      data: {
        siteId,
        productId,
        status: (status as ServiceStatus) || ServiceStatus.ACTIVE,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        billingType: billingType as BillingType,
        prepaymentType: prepay as import('@prisma/client').PrepaymentType,
        price: priceKopecks,
        autoRenew: autoRenew !== undefined ? Boolean(autoRenew) : false,
        responsibleUserId: responsibleUserId || null,
        comment: comment || null,
        isFromPartner: isFromPartner !== undefined ? Boolean(isFromPartner) : false,
        sellerCommissionPercent: sellerCommissionPercent != null ? parseFloat(sellerCommissionPercent) : null,
        accountManagerCommissionPercent: accountManagerCommissionPercent != null ? parseFloat(accountManagerCommissionPercent) : null,
        accountManagerFeeAmount: accountManagerFeeAmount != null ? BigInt(accountManagerFeeAmount) : null,
      },
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

    // Create expense items if provided
    if (expenseItemsPayload && Array.isArray(expenseItemsPayload) && expenseItemsPayload.length > 0) {
      try {
        await prisma.serviceExpenseItem.createMany({
          data: expenseItemsPayload.map((item: any) => ({
            serviceId: service.id,
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
        await logAudit({
          userId: user.id,
          action: 'CREATE',
          entityType: 'SERVICE_EXPENSE_ITEM',
          entityId: service.id,
          serviceId: service.id,
          description: `Добавлены статьи расходов проекта (${expenseItemsPayload.length})`,
          newValue: expenseItemsPayload.map((item: any) => ({
            name: item.name,
            valueType: item.valueType,
            value: item.value,
            responsibleUserId: item.responsibleUserId,
          })),
        });
      } catch (e) {
        console.error('Error creating service expense items:', e);
      }
    }

    const expectedPeriods = getExpectedPeriods(
      new Date(startDate),
      billingType as BillingType,
      endDate ? new Date(endDate) : undefined
    );
    if (expectedPeriods.length > 0) {
      const first = expectedPeriods[0];
      try {
        await prisma.workPeriod.create({
          data: {
            serviceId: service.id,
            dateFrom: new Date(first.dateFrom),
            dateTo: new Date(first.dateTo),
            periodType: 'STANDARD',
            invoiceNotRequired: false,
          },
        });
      } catch (e) {
        console.error('Create first work period for service', service.id, e);
      }
    }

    await logAudit({
      userId: user.id,
      action: 'CREATE',
      entityType: 'SERVICE',
      entityId: service.id,
      serviceId: service.id,
      description: `Создана услуга «${service.product?.name || productId}» для сайта «${service.site?.title || siteId}»`,
      newValue: { productId, price: price || null, status: status || 'ACTIVE', isFromPartner },
    });

    // Convert BigInt to string for JSON serialization
    const serviceResponse = {
      ...service,
      price: service.price !== null ? service.price.toString() : null,
    };

    return NextResponse.json({ service: serviceResponse });
  } catch (error: any) {
    console.error('Error creating service:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
