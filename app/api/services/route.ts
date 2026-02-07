import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasViewAllPermission } from '@/lib/permissions';
import { ServiceStatus, BillingType } from '@prisma/client';

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
        { site: { accountManagerId: user.id } },
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
        if (site.accountManagerId !== user.id) {
          return NextResponse.json({ error: 'Forbidden: You can only create services for sites you manage' }, { status: 403 });
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

    const service = await prisma.service.create({
      data: {
        siteId,
        productId,
        status: (status as ServiceStatus) || ServiceStatus.ACTIVE,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        billingType: billingType as BillingType,
        prepaymentType: prepay as import('@prisma/client').PrepaymentType,
        price: price ? BigInt(Math.round(parseFloat(price) * 100)) : null,
        autoRenew: autoRenew !== undefined ? Boolean(autoRenew) : false,
        responsibleUserId: responsibleUserId || null,
        comment: comment || null,
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
