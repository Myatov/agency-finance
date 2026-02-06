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

    // Apply filters (only when explicitly "true" or "false"; empty = show all)
    if (isActive === 'true') where.isActive = true;
    else if (isActive === 'false') where.isActive = false;

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
    const msg = error?.message ?? '';
    if (msg.includes('niche') && (msg.includes('does not exist') || msg.includes('Unknown column') || msg.includes('column'))) {
      return NextResponse.json({
        error: 'В базе отсутствует колонка niche в таблице Site. Выполните миграцию: prisma/ensure-site-has-niche-column.sql',
      }, { status: 503 });
    }
    console.error('Error fetching sites:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? msg : undefined,
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

    // Ниша обязательна, хранится как строка (поле niche). Может быть передана как niche или nicheId.
    let nicheName = typeof niche === 'string' ? niche.trim() : '';
    if (!nicheName && nicheId && typeof nicheId === 'string' && nicheId.trim()) {
      try {
        const rec = await prisma.niche.findUnique({
          where: { id: nicheId.trim() },
          select: { name: true },
        });
        if (rec?.name) nicheName = rec.name;
      } catch {
        // Справочник недоступен
      }
    }
    if (!nicheName || !nicheName.trim()) {
      return NextResponse.json(
        { error: 'Поле «Ниша» обязательно для заполнения' },
        { status: 400 }
      );
    }
    nicheName = nicheName.trim();

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
        websiteUrl: websiteUrl ? String(websiteUrl).trim() || null : null,
        description: description ? String(description).trim() || null : null,
        niche: nicheName,
        clientId: String(clientId).trim(),
        accountManagerId: accountManagerId ? String(accountManagerId).trim() || null : null,
        creatorId: user.id,
        isActive: Boolean(isActive),
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
    const message = error?.message ?? String(error);
    if (message.includes('niche') && (message.includes('does not exist') || message.includes('Unknown column') || message.includes('column'))) {
      return NextResponse.json({
        error: 'В базе отсутствует колонка niche в таблице Site. Выполните миграцию: prisma/ensure-site-has-niche-column.sql',
      }, { status: 503 });
    }
    console.error('Error creating site:', message, { code: error?.code, meta: error?.meta });
    return NextResponse.json(
      { error: 'Не удалось создать сайт', details: message },
      { status: 500 }
    );
  }
}
