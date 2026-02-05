import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAssignAccountManager, canDeleteSite, hasViewAllPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const isActive = searchParams.get('isActive');
    const accountManagerId = searchParams.get('accountManagerId');
    const sellerId = searchParams.get('sellerId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    let where: any = {};
    const additionalFilters: any[] = [];

    const viewAll = await hasViewAllPermission(user, 'sites');
    if (!viewAll) {
      additionalFilters.push({
        OR: [
          { accountManagerId: user.id },
          { creatorId: user.id },
        ],
      });
    }

    // Apply filters
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (accountManagerId) {
      where.accountManagerId = accountManagerId;
    }

    if (sellerId) {
      where.client = { sellerEmployeeId: sellerId };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Combine role-based filters with other filters using AND
    if (additionalFilters.length > 0) {
      if (Object.keys(where).length > 0) {
        where = {
          AND: [
            ...additionalFilters,
            where,
          ],
        };
      } else {
        where = additionalFilters[0];
      }
    }

    const sites = await prisma.site.findMany({
      where,
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
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
        services: {
          where: {
            status: 'ACTIVE',
          },
          select: {
            id: true,
            product: {
              select: {
                name: true,
              },
            },
          },
          take: 5,
        },
        expenses: {
          orderBy: { paymentAt: 'desc' },
          take: 1,
          select: {
            id: true,
            amount: true,
            paymentAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Convert BigInt to string for JSON serialization
    const serializedSites = sites.map((s) => ({
      ...s,
      expenses: s.expenses.map((e) => ({
        ...e,
        amount: e.amount.toString(),
      })),
    }));

    return NextResponse.json({ sites: serializedSites });
  } catch (error) {
    console.error('Error fetching sites:', error);
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
    const {
      title,
      websiteUrl,
      description,
      niche,
      clientId,
      accountManagerId,
      isActive,
    } = body;

    if (!title || !niche || !clientId) {
      return NextResponse.json(
        { error: 'Title, niche, and clientId are required' },
        { status: 400 }
      );
    }

    // Check if user can assign account manager
    if (accountManagerId && !canAssignAccountManager(user)) {
      return NextResponse.json(
        { error: 'You cannot assign account manager' },
        { status: 403 }
      );
    }

    const site = await prisma.site.create({
      data: {
        title,
        websiteUrl: websiteUrl || null,
        description: description || null,
        niche,
        clientId,
        accountManagerId: accountManagerId || null,
        creatorId: user.id,
        isActive: isActive ?? false,
      },
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
    });

    return NextResponse.json({ site });
  } catch (error) {
    console.error('Error creating site:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
