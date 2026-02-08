import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewReports, hasViewAllPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/services-without-periods
 * Возвращает активные услуги клиентов, у которых не созданы рабочие периоды.
 */
export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canView = await canViewReports(user);
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const viewAll = await hasViewAllPermission(user, 'services');
    const where: {
      status: 'ACTIVE';
      workPeriods: { none: object };
      site?: { clientId?: string; accountManagerId?: string; creatorId?: string };
      OR?: Array<object>;
    } = {
      status: 'ACTIVE',
      workPeriods: { none: {} },
    };

    if (!viewAll) {
      where.OR = [
        { site: { accountManagerId: user.id } },
        { site: { creatorId: user.id } },
        { site: { client: { sellerEmployeeId: user.id } } },
      ];
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        site: {
          include: {
            client: { select: { id: true, name: true } },
            accountManager: { select: { id: true, fullName: true } },
          },
        },
        product: { select: { id: true, name: true } },
      },
      orderBy: { site: { title: 'asc' } },
    });

    // BigInt (price) не сериализуется в JSON — приводим к строке
    const serialized = services.map(({ price, ...rest }) => ({
      ...rest,
      price: price != null ? String(price) : null,
    }));

    return NextResponse.json({
      services: serialized,
      count: serialized.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching services without periods:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}
