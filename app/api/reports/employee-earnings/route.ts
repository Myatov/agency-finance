import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.roleCode !== 'OWNER' && user.roleCode !== 'CEO') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const periodFrom = searchParams.get('periodFrom');
    const periodTo = searchParams.get('periodTo');
    const departmentId = searchParams.get('departmentId');
    const employeeId = searchParams.get('employeeId');

    if (!periodFrom || !periodTo) {
      return NextResponse.json({ error: 'periodFrom and periodTo are required' }, { status: 400 });
    }

    const dateFrom = new Date(periodFrom + 'T00:00:00.000Z');
    const dateTo = new Date(periodTo + 'T23:59:59.999Z');

    // Fetch employees
    const employeeWhere: any = { isActive: true };
    if (departmentId) employeeWhere.departmentId = departmentId;
    if (employeeId) employeeWhere.id = employeeId;

    const employees = await prisma.user.findMany({
      where: employeeWhere,
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    // Fixed salary history for all relevant employees (effective at or before periodFrom)
    const employeeIds = employees.map((e) => e.id);
    const salaryHistories = await prisma.userFixedSalaryHistory.findMany({
      where: {
        userId: { in: employeeIds },
        effectiveFrom: { lte: dateFrom },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // For each employee, take the most recent salary record effective at period start
    const salaryByEmployee = new Map<string, bigint>();
    const seen = new Set<string>();
    for (const sh of salaryHistories) {
      if (!seen.has(sh.userId)) {
        seen.add(sh.userId);
        salaryByEmployee.set(sh.userId, sh.amount);
      }
    }

    // Active services with commissions — find services where the employee is seller or AM
    // We need: seller = Client.sellerEmployeeId, AM = Client.accountManagerId (or Site.accountManagerId)
    const services = await prisma.service.findMany({
      where: {
        status: 'ACTIVE',
        workPeriods: {
          some: {
            dateFrom: { lte: dateTo },
            dateTo: { gte: dateFrom },
          },
        },
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
        workPeriods: {
          where: {
            dateFrom: { lte: dateTo },
            dateTo: { gte: dateFrom },
          },
          select: { id: true },
        },
      },
    });

    // Aggregate expected commissions and fees per employee
    const commissionsByEmployee = new Map<string, number>();
    const feesByEmployee = new Map<string, number>();

    for (const svc of services) {
      const periodsInRange = svc.workPeriods.length;
      if (periodsInRange === 0) continue;

      const sellerId = svc.site.client.sellerEmployeeId;
      const amId = svc.site.client.accountManagerId;

      // Seller commission
      if (sellerId && svc.sellerCommissionAmount != null) {
        const total = Number(svc.sellerCommissionAmount) * periodsInRange;
        commissionsByEmployee.set(sellerId, (commissionsByEmployee.get(sellerId) || 0) + total);
      }

      // AM commission
      if (amId && svc.accountManagerCommissionAmount != null) {
        const total = Number(svc.accountManagerCommissionAmount) * periodsInRange;
        commissionsByEmployee.set(amId, (commissionsByEmployee.get(amId) || 0) + total);
      }

      // AM fees
      if (amId && svc.accountManagerFeeAmount != null) {
        const total = Number(svc.accountManagerFeeAmount) * periodsInRange;
        feesByEmployee.set(amId, (feesByEmployee.get(amId) || 0) + total);
      }
    }

    // Motivation bonuses within the date range
    const motivations = await prisma.userMotivation.findMany({
      where: {
        userId: { in: employeeIds },
        periodFrom: { lte: dateTo },
        periodTo: { gte: dateFrom },
      },
    });
    const motivationByEmployee = new Map<string, number>();
    for (const m of motivations) {
      if (m.bonusAmount != null) {
        motivationByEmployee.set(m.userId, (motivationByEmployee.get(m.userId) || 0) + Number(m.bonusAmount));
      }
    }

    // Total paid expenses per employee in the date range
    const expenseAggregates = await prisma.expense.groupBy({
      by: ['employeeId'],
      where: {
        employeeId: { in: employeeIds },
        paymentAt: { gte: dateFrom, lte: dateTo },
      },
      _sum: { amount: true },
    });
    const paidByEmployee = new Map<string, number>();
    for (const ea of expenseAggregates) {
      if (ea.employeeId) {
        paidByEmployee.set(ea.employeeId, Number(ea._sum.amount || 0));
      }
    }

    // Build results
    let totalExpectedAll = 0;
    let totalPaidAll = 0;

    const employeeResults = employees.map((emp) => {
      const fixedSalary = Number(salaryByEmployee.get(emp.id) || emp.fixedSalary || 0);
      const expectedCommissions = commissionsByEmployee.get(emp.id) || 0;
      const expectedFees = feesByEmployee.get(emp.id) || 0;
      const motivationBonus = motivationByEmployee.get(emp.id) || 0;
      const totalExpected = fixedSalary + expectedCommissions + expectedFees + motivationBonus;
      const totalPaid = paidByEmployee.get(emp.id) || 0;
      const balance = totalExpected - totalPaid;

      totalExpectedAll += totalExpected;
      totalPaidAll += totalPaid;

      return {
        id: emp.id,
        fullName: emp.fullName,
        department: emp.department?.name || null,
        fixedSalary,
        expectedCommissions,
        expectedFees,
        motivationBonus,
        totalExpected,
        totalPaid,
        balance,
      };
    });

    return NextResponse.json({
      employees: employeeResults,
      totals: {
        totalExpected: totalExpectedAll,
        totalPaid: totalPaidAll,
        balance: totalExpectedAll - totalPaidAll,
      },
    });
  } catch (e: any) {
    console.error('GET reports/employee-earnings', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
