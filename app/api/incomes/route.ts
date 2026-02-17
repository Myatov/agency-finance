import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAddIncome, hasViewAllPermission } from '@/lib/permissions';
import { parseAmount } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const serviceId = searchParams.get('serviceId');
    const siteId = searchParams.get('siteId');
    const sellerId = searchParams.get('sellerId');
    const accountManagerId = searchParams.get('accountManagerId');
    const workPeriodId = searchParams.get('workPeriodId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    let where: any = {};

    const viewAll = await hasViewAllPermission(user, 'incomes');
    if (!viewAll) {
      where.OR = [
        { createdByUserId: user.id },
        { service: { site: { client: { accountManagerId: user.id } } } },
        { service: { site: { creatorId: user.id } } },
        { service: { site: { client: { sellerEmployeeId: user.id } } } },
      ];
    }

    if (serviceId) {
      where.serviceId = serviceId;
    }

    if (workPeriodId) {
      where.workPeriodId = workPeriodId;
    }

    if (siteId) {
      where.service = {
        ...where.service,
        siteId,
      };
    }

    if (sellerId) {
      where.service = {
        ...where.service,
        site: {
          ...where.service?.site,
          client: { sellerEmployeeId: sellerId },
        },
      };
    }

    if (accountManagerId) {
      where.service = {
        ...where.service,
        site: {
          ...where.service?.site,
          client: { accountManagerId },
        },
      };
    }

    if (dateFrom || dateTo) {
      where.incomeDate = {};
      if (dateFrom) {
        where.incomeDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.incomeDate.lte = new Date(dateTo);
      }
    }

    const incomes = await prisma.income.findMany({
      where,
      include: {
        service: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            site: {
              include: {
                client: {
                  include: {
                    seller: {
                      select: {
                        id: true,
                        fullName: true,
                      },
                    },
                  },
                },
                accountManager: {
                  select: {
                    id: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        legalEntity: {
          select: {
            id: true,
            name: true,
          },
        },
        workPeriod: {
          select: {
            id: true,
            dateFrom: true,
            dateTo: true,
            periodType: true,
          },
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
      orderBy: { incomeDate: 'desc' },
      take: 100,
    });

    // Serialize BigInt - use JSON.parse/stringify to handle nested BigInt values
    const serialized = incomes.map((i) => 
      JSON.parse(JSON.stringify(i, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ))
    );

    return NextResponse.json({ incomes: serialized });
  } catch (error) {
    console.error('Error fetching incomes:', error);
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
    const { amount, serviceId, workPeriodId, legalEntityId, comment, incomeDate } = body;

    if (!amount || !serviceId) {
      return NextResponse.json(
        { error: 'Amount and serviceId are required' },
        { status: 400 }
      );
    }

    // Get service with site and client
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        site: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Check permissions
    const canAdd = await canAddIncome(
      user,
      service.site.client.accountManagerId || undefined,
      service.site.client.sellerEmployeeId
    );

    if (!canAdd) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const amountBigInt = parseAmount(amount);

    const income = await prisma.income.create({
      data: {
        amount: amountBigInt,
        serviceId,
        workPeriodId: workPeriodId || null,
        legalEntityId: legalEntityId || null,
        comment: comment || null,
        incomeDate: incomeDate ? new Date(incomeDate) : new Date(),
        createdByUserId: user.id,
      },
      include: {
        service: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            site: {
              include: {
                client: {
                  include: {
                    seller: {
                      select: {
                        id: true,
                        fullName: true,
                      },
                    },
                  },
                },
                accountManager: {
                  select: {
                    id: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        legalEntity: {
          select: {
            id: true,
            name: true,
          },
        },
        workPeriod: {
          select: {
            id: true,
            dateFrom: true,
            dateTo: true,
            periodType: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Convert BigInt to string for JSON serialization
    // Need to manually serialize to avoid BigInt serialization errors
    const incomeResponse = JSON.parse(JSON.stringify(income, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return NextResponse.json({ income: incomeResponse });
  } catch (error) {
    console.error('Error creating income:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
