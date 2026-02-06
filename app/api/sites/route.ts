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

    // Пытаемся получить сайты с nicheRef, если таблица не существует - без него
    let sites;
    try {
      // Получаем сайты с nicheRef (без вложенного parent для надежности)
      sites = await prisma.site.findMany({
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
          nicheRef: {
            select: {
              id: true,
              name: true,
              parentId: true,
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

      // Загружаем parent для каждой ниши отдельно, если нужно
      if (sites.some(s => s.nicheRef?.parentId)) {
        const nicheIdsWithParents = sites
          .map(s => s.nicheRef?.parentId)
          .filter((id): id is string => !!id);
        const uniqueParentIds = [...new Set(nicheIdsWithParents)];
        
        if (uniqueParentIds.length > 0) {
          try {
            const parents = await prisma.niche.findMany({
              where: { id: { in: uniqueParentIds } },
              select: { id: true, name: true, sortOrder: true },
            });
            const parentsMap = new Map(parents.map(p => [p.id, p]));
            
            // Добавляем parent к каждой nicheRef
            sites = sites.map(site => {
              if (site.nicheRef?.parentId) {
                const parent = parentsMap.get(site.nicheRef.parentId);
                return {
                  ...site,
                  nicheRef: {
                    ...site.nicheRef,
                    parent: parent || null,
                  },
                };
              }
              return site;
            });
          } catch (parentError: any) {
            console.warn('Cannot fetch parents for niches:', parentError.message);
            // Продолжаем без parent
          }
        }
      }
    } catch (dbError: any) {
      // При любой ошибке (нет колонки, нет таблицы, неверная схема и т.д.) — загружаем сайты без nicheRef
      console.warn('Fetching sites with nicheRef failed, falling back to without nicheRef:', dbError?.message || dbError);
      sites = await prisma.site.findMany({
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
      sites = sites.map(s => ({ ...s, nicheRef: null }));
    }

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

    // Если nicheId указан, получаем название ниши из БД, иначе используем переданное niche
    let finalNiche = '';
    let finalNicheId = null;
    
    // Обрабатываем nicheId и niche
    if (nicheId && typeof nicheId === 'string' && nicheId.trim()) {
      // Если указан nicheId, проверяем что ниша существует и получаем её название
      try {
        const nicheRecord = await prisma.niche.findUnique({
          where: { id: nicheId.trim() },
          select: { name: true },
        });
        if (nicheRecord) {
          finalNiche = nicheRecord.name;
          finalNicheId = nicheId.trim();
        } else {
          return NextResponse.json(
            { error: 'Указанная ниша не найдена' },
            { status: 400 }
          );
        }
      } catch (dbError: any) {
        // Если таблица Niche не существует, используем переданное niche
        if (dbError.message?.includes('does not exist') || dbError.message?.includes('Niche') || dbError.code === 'P2021') {
          console.warn('Table Niche does not exist, using provided niche name');
          finalNiche = niche || '';
          finalNicheId = null;
        } else {
          console.error('Error fetching niche:', dbError);
          return NextResponse.json(
            { error: `Ошибка при проверке ниши: ${dbError.message || 'Unknown error'}` },
            { status: 500 }
          );
        }
      }
    } else if (niche && typeof niche === 'string' && niche.trim()) {
      // Если nicheId не указан, но указана niche, используем её
      finalNiche = niche.trim();
      finalNicheId = null;
    } else {
      // Если ничего не указано
      return NextResponse.json(
        { error: 'Поле "Ниша" обязательно для заполнения' },
        { status: 400 }
      );
    }

    // Проверяем, что finalNiche не пустой
    if (!finalNiche || !finalNiche.trim()) {
      return NextResponse.json(
        { error: 'Поле "Ниша" обязательно для заполнения' },
        { status: 400 }
      );
    }

    // Check if user can assign account manager
    // ACCOUNT_MANAGER can assign themselves when creating a site
    const canAssign = await canAssignAccountManager(user);
    const isAccountManagerAssigningSelf = user.roleCode === 'ACCOUNT_MANAGER' && accountManagerId === user.id;
    
    if (accountManagerId && !canAssign && !isAccountManagerAssigningSelf) {
      return NextResponse.json(
        { error: 'You cannot assign account manager' },
        { status: 403 }
      );
    }

    const baseData = {
      title: title.trim(),
      websiteUrl: websiteUrl ? websiteUrl.trim() : null,
      description: description ? description.trim() : null,
      niche: finalNiche.trim(),
      clientId,
      accountManagerId: accountManagerId || null,
      creatorId: user.id,
      isActive: isActive ?? false,
    };

    const includeRelations = {
      client: {
        include: {
          seller: { select: { id: true, fullName: true } },
        },
      },
      accountManager: { select: { id: true, fullName: true } },
    };

    let site;
    try {
      // Сначала пробуем с nicheId
      if (finalNicheId) {
        try {
          site = await prisma.site.create({
            data: { ...baseData, nicheId: finalNicheId },
            include: includeRelations,
          });
        } catch (withNicheIdError: any) {
          console.warn('Create site with nicheId failed, retrying without:', withNicheIdError?.message);
          site = await prisma.site.create({
            data: baseData,
            include: includeRelations,
          });
        }
      } else {
        site = await prisma.site.create({
          data: baseData,
          include: includeRelations,
        });
      }
    } catch (createError: any) {
      console.error('Error creating site:', createError);
      throw createError;
    }

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
