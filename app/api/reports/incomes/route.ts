import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewReports, hasViewAllPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canView = await canViewReports(user);
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const accountManagerId = searchParams.get('accountManagerId');
    const sellerId = searchParams.get('sellerId');
    const siteId = searchParams.get('siteId');
    const serviceId = searchParams.get('serviceId');
    const productId = searchParams.get('productId');
    const clientId = searchParams.get('clientId');
    const legalEntityId = searchParams.get('legalEntityId');

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

    if (dateFrom || dateTo) {
      where.incomeDate = {};
      if (dateFrom) {
        where.incomeDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.incomeDate.lte = new Date(dateTo + 'T23:59:59');
      }
    }

    if (accountManagerId) {
      where.service = {
        ...where.service,
        site: {
          ...where.service?.site,
          client: {
            ...where.service?.site?.client,
            accountManagerId,
          },
        },
      };
    }

    if (sellerId) {
      where.service = {
        ...where.service,
        site: {
          ...where.service?.site,
          client: {
            ...where.service?.site?.client,
            sellerEmployeeId: sellerId,
          },
        },
      };
    }

    if (siteId) {
      where.service = {
        ...where.service,
        siteId,
      };
    }

    if (serviceId) {
      where.serviceId = serviceId;
    }

    if (productId) {
      where.service = {
        ...where.service,
        productId,
      };
    }

    if (clientId) {
      where.service = {
        ...where.service,
        site: {
          ...where.service?.site,
          clientId,
        },
      };
    }

    if (legalEntityId) {
      where.legalEntityId = legalEntityId;
    }

    // Get total aggregate in parallel with data fetch
    const [incomes, totalAggregate] = await Promise.all([
      prisma.income.findMany({
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
                      accountManager: {
                        select: {
                          id: true,
                          fullName: true,
                        },
                      },
                      seller: {
                        select: {
                          id: true,
                          fullName: true,
                        },
                      },
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
            },
          },
          creator: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: { incomeDate: 'desc' },
        take: 1000, // Limit for performance
      }),
      prisma.income.aggregate({
        where,
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    const total = Number(totalAggregate._sum.amount || 0);

    // Serialize BigInt - use JSON.parse/stringify to handle nested BigInt values
    const serialized = incomes.map((i) => 
      JSON.parse(JSON.stringify(i, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ))
    );

    return NextResponse.json({
      incomes: serialized,
      total: total.toString(),
      count: totalAggregate._count.id,
    });
  } catch (error) {
    console.error('Error fetching income report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
