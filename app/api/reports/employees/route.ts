import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewReports } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canViewReports(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const dateFilter: any = {};
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom);
    }
    if (dateTo) {
      dateFilter.lte = new Date(dateTo + 'T23:59:59');
    }

    // Get all employees with departments
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const employeeIds = employees.map((e) => e.id);

    // Get active services with commission data for seller/AM roles
    const servicesWithCommissions = await prisma.service.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { site: { client: { sellerEmployeeId: { in: employeeIds } } } },
          { site: { client: { accountManagerId: { in: employeeIds } } } },
        ],
      },
      include: {
        site: {
          include: {
            client: {
              select: {
                sellerEmployeeId: true,
                accountManagerId: true,
              },
            },
          },
        },
      },
    });

    // Aggregate commissions per employee
    const sellerCommissionMap = new Map<string, bigint>();
    const amCommissionMap = new Map<string, bigint>();
    for (const svc of servicesWithCommissions) {
      const sellerId = svc.site.client.sellerEmployeeId;
      const amId = svc.site.client.accountManagerId;
      if (sellerId && svc.sellerCommissionAmount != null) {
        sellerCommissionMap.set(
          sellerId,
          (sellerCommissionMap.get(sellerId) || BigInt(0)) + svc.sellerCommissionAmount
        );
      }
      if (amId && svc.accountManagerCommissionAmount != null) {
        amCommissionMap.set(
          amId,
          (amCommissionMap.get(amId) || BigInt(0)) + svc.accountManagerCommissionAmount
        );
      }
    }

    // Get income aggregates per employee in one query
    // Use incomeDate for filtering, not createdAt
    const incomeAggregates = await prisma.income.groupBy({
      by: ['createdByUserId'],
      where: Object.keys(dateFilter).length > 0 ? { incomeDate: dateFilter } : undefined,
      _count: { id: true },
      _sum: { amount: true },
    });

    // Get expense aggregates per employee in one query
    // Count expenses by employeeId (the employee the expense is for), not createdByUserId
    const expenseWhere: any = {
      employeeId: { not: null }, // Only count expenses with assigned employee
    };
    if (Object.keys(dateFilter).length > 0) {
      expenseWhere.paymentAt = dateFilter;
    }
    const expenseAggregates = await prisma.expense.groupBy({
      by: ['employeeId'],
      where: expenseWhere,
      _count: { id: true },
      _sum: { amount: true },
    });

    // Create maps for quick lookup
    const incomeMap = new Map(
      incomeAggregates.map((agg) => [
        agg.createdByUserId,
        {
          count: agg._count.id,
          total: agg._sum.amount || BigInt(0),
        },
      ])
    );

    const expenseMap = new Map(
      expenseAggregates.map((agg) => [
        agg.employeeId, // Use employeeId instead of createdByUserId
        {
          count: agg._count.id,
          total: agg._sum.amount || BigInt(0),
        },
      ])
    );

    // Build report
    const report = employees
      .map((emp) => {
        const incomeData = incomeMap.get(emp.id) || { count: 0, total: BigInt(0) };
        const expenseData = expenseMap.get(emp.id) || { count: 0, total: BigInt(0) };

        const incomeTotal = Number(incomeData.total);
        const expenseTotal = Number(expenseData.total);

        return {
          employee: {
            id: emp.id,
            fullName: emp.fullName,
            department: emp.department
              ? {
                  id: emp.department.id,
                  name: emp.department.name,
                }
              : null,
            fixedSalary: emp.fixedSalary != null ? emp.fixedSalary.toString() : null,
            officialSalary: emp.officialSalary != null ? emp.officialSalary.toString() : null,
            salaryTaxPercent: emp.salaryTaxPercent,
          },
          incomeCount: incomeData.count,
          incomeTotal: incomeTotal.toString(),
          expenseCount: expenseData.count,
          expenseTotal: expenseTotal.toString(),
          sellerCommissionAmount: (Number(sellerCommissionMap.get(emp.id) || BigInt(0))).toString(),
          accountManagerCommissionAmount: (Number(amCommissionMap.get(emp.id) || BigInt(0))).toString(),
          difference: (incomeTotal - expenseTotal).toString(),
        };
      })
      .filter((r) => r.incomeCount > 0 || r.expenseCount > 0);

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Error generating employee report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
