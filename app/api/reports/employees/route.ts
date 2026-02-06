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
          },
          incomeCount: incomeData.count,
          incomeTotal: incomeTotal.toString(),
          expenseCount: expenseData.count,
          expenseTotal: expenseTotal.toString(),
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
