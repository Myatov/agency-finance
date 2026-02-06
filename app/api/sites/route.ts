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
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            product: { select: { name: true } },
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
  } catch (error: any) {
    console.error('Error fetching sites:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: 500 });
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
      nicheId,
      clientId,
      accountManagerId,
      isActive,
    } = body;

    if (!title || !clientId) {
      return NextResponse.json(
        { error: 'Title and clientId are required' },
        { status: 400 }
      );
    }

    // Ниша хранится только как строка (поле niche). Если передан nicheId — берём название из справочника.
    let nicheName = typeof niche === 'string' && niche.trim() ? niche.trim() : '';
    if (nicheId && typeof nicheId === 'string' && nicheId.trim()) {
      try {
        const rec = await prisma.niche.findUnique({
          where: { id: nicheId.trim() },
          select: { name: true },
        });
        if (rec) nicheName = rec.name;
      } catch {
        // Таблица Niche недоступна — используем переданное название
      }
    }
    if (!nicheName) {
      return NextResponse.json(
        { error: 'Поле "Ниша" обязательно для заполнения' },
        { status: 400 }
      );
    }

    const canAssign = await canAssignAccountManager(user);
    const isAccountManagerAssigningSelf = user.roleCode === 'ACCOUNT_MANAGER' && accountManagerId === user.id;
    if (accountManagerId && !canAssign && !isAccountManagerAssigningSelf) {
      return NextResponse.json(
        { error: 'You cannot assign account manager' },
        { status: 403 }
      );
    }

    const site = await prisma.site.create({
      data: {
        title: title.trim(),
        websiteUrl: websiteUrl ? websiteUrl.trim() : null,
        description: description ? description.trim() : null,
        niche: nicheName,
        clientId,
        accountManagerId: accountManagerId || null,
        creatorId: user.id,
        isActive: isActive ?? false,
      },
      include: {
        client: {
          include: {
            seller: { select: { id: true, fullName: true } },
          },
        },
        accountManager: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json({ site });
  } catch (error: any) {
    console.error('Error creating site:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: 500 });
  }
}
