import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewReports } from '@/lib/permissions';

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
    const clientId = searchParams.get('clientId');
    const category = searchParams.get('category');

    let where: any = {};

    if (dateFrom || dateTo) {
      where.paymentAt = {};
      if (dateFrom) {
        where.paymentAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.paymentAt.lte = new Date(dateTo + 'T23:59:59');
      }
    }

    if (category) {
      where.costItem = { costCategoryId: category };
    }

    if (accountManagerId) {
      where.site = {
        accountManagerId,
      };
    }

    if (sellerId) {
      where.site = {
        ...where.site,
        client: { sellerEmployeeId: sellerId },
      };
    }

    if (siteId) {
      where.siteId = siteId;
    }

    if (serviceId) {
      where.serviceId = serviceId;
    }

    if (clientId) {
      where.site = {
        ...where.site,
        clientId,
      };
    }

    // Get total aggregate in parallel with data fetch
    const [expenses, totalAggregate] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          costItem: {
            select: {
              id: true,
              title: true,
              costCategory: { select: { id: true, name: true } },
            },
          },
          employee: {
            include: {
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
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
          creator: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: { paymentAt: 'desc' },
        take: 1000, // Limit for performance
      }),
      prisma.expense.aggregate({
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
    const serialized = expenses.map((e) => 
      JSON.parse(JSON.stringify(e, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ))
    );

    return NextResponse.json({
      expenses: serialized,
      total: total.toString(),
      count: totalAggregate._count.id,
    });
  } catch (error) {
    console.error('Error generating expense report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
