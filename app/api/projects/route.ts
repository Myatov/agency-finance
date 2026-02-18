import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, hasViewAllPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canViewProjects = await hasPermission(user, 'projects', 'view');
    const canViewServices = await hasPermission(user, 'services', 'view');
    if (!canViewProjects && !canViewServices) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const sellerId = searchParams.get('sellerId');
    const accountManagerId = searchParams.get('accountManagerId');
    const productId = searchParams.get('productId');
    const unassigned = searchParams.get('unassigned');
    const activeOnly = searchParams.get('activeOnly');

    const whereClause: any = {};

    if (status && ['ACTIVE', 'PAUSED', 'FINISHED'].includes(status)) {
      whereClause.status = status;
    }

    if (clientId) {
      whereClause.site = { ...whereClause.site, clientId };
    }

    if (sellerId) {
      whereClause.site = {
        ...whereClause.site,
        client: { ...whereClause.site?.client, sellerEmployeeId: sellerId },
      };
    }

    if (accountManagerId) {
      whereClause.site = {
        ...whereClause.site,
        client: { ...whereClause.site?.client, accountManagerId },
      };
    }

    if (unassigned === 'true') {
      whereClause.site = {
        ...whereClause.site,
        client: { ...whereClause.site?.client, accountManagerId: null },
      };
    }

    if (productId) {
      whereClause.productId = productId;
    }

    if (activeOnly === 'true') {
      whereClause.site = {
        ...whereClause.site,
        client: { ...whereClause.site?.client, isArchived: false },
      };
    }

    // Permission-based filtering — проверяем ТОЛЬКО projects view_all
    const viewAllProjects = await hasViewAllPermission(user, 'projects');

    if (!viewAllProjects) {
      whereClause.OR = [
        { site: { client: { sellerEmployeeId: user.id } } },
        { site: { client: { accountManagerId: user.id } } },
        { responsibleUserId: user.id },
      ];
    }

    const services = await prisma.service.findMany({
      where: whereClause,
      include: {
        product: true,
        site: {
          include: {
            client: {
              include: {
                seller: { select: { id: true, fullName: true } },
                accountManager: { select: { id: true, fullName: true } },
                agent: { select: { id: true, name: true } },
                legalEntity: { select: { id: true, name: true } },
              },
            },
          },
        },
        responsible: { select: { id: true, fullName: true } },
        workPeriods: {
          orderBy: { dateFrom: 'desc' },
          take: 1,
          include: {
            incomes: { select: { amount: true } },
          },
        },
        expenseItems: {
          include: { template: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Convert BigInt to string for JSON serialization
    const projects = services.map((service) => ({
      ...service,
      price: service.price !== null ? service.price.toString() : null,
      sellerCommissionAmount: service.sellerCommissionAmount !== null ? service.sellerCommissionAmount.toString() : null,
      accountManagerCommissionAmount: service.accountManagerCommissionAmount !== null ? service.accountManagerCommissionAmount.toString() : null,
      accountManagerFeeAmount: service.accountManagerFeeAmount !== null ? service.accountManagerFeeAmount.toString() : null,
      workPeriods: service.workPeriods.map((wp) => ({
        ...wp,
        expectedAmount: wp.expectedAmount !== null ? wp.expectedAmount.toString() : null,
        incomes: wp.incomes.map((inc) => ({
          ...inc,
          amount: inc.amount.toString(),
        })),
      })),
      expenseItems: service.expenseItems.map((ei) => ({
        ...ei,
        calculatedAmount: ei.calculatedAmount !== null ? ei.calculatedAmount.toString() : null,
      })),
    }));

    return NextResponse.json({ projects }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error?.message : undefined },
      { status: 500 }
    );
  }
}
