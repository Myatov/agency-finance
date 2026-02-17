import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canView = await hasPermission(user, 'agents', 'view');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const periodFrom = searchParams.get('periodFrom');
    const periodTo = searchParams.get('periodTo');

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        clients: {
          select: {
            id: true,
            name: true,
            sites: {
              select: {
                id: true,
                title: true,
                services: {
                  where: { isFromPartner: true },
                  select: {
                    id: true,
                    price: true,
                    status: true,
                    startDate: true,
                    endDate: true,
                    product: { select: { id: true, name: true } },
                    expenses: {
                      select: {
                        id: true,
                        amount: true,
                        paymentAt: true,
                      },
                      ...(periodFrom || periodTo
                        ? {
                            where: {
                              paymentAt: {
                                ...(periodFrom ? { gte: new Date(periodFrom) } : {}),
                                ...(periodTo ? { lte: new Date(periodTo) } : {}),
                              },
                            },
                          }
                        : {}),
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const commissionPercent = agent.desiredCommissionPercent ?? 0;
    let totalExpected = BigInt(0);
    let totalActualPaid = BigInt(0);

    const clientEarnings = agent.clients.map((client) => {
      let clientExpected = BigInt(0);
      let clientActualPaid = BigInt(0);
      const services: Array<{
        serviceId: string;
        siteName: string;
        productName: string;
        price: string;
        expectedEarning: string;
        actualPaid: string;
      }> = [];

      for (const site of client.sites) {
        for (const service of site.services) {
          const servicePrice = service.price ?? BigInt(0);
          let expected: bigint;
          if (agent.commissionOnTop) {
            expected = BigInt(Math.round(Number(servicePrice) * commissionPercent / 100));
          } else if (agent.commissionInOurAmount) {
            expected = BigInt(Math.round(Number(servicePrice) * commissionPercent / 100));
          } else {
            expected = BigInt(Math.round(Number(servicePrice) * commissionPercent / 100));
          }

          const actualPaid = service.expenses.reduce(
            (sum, e) => sum + (e.amount ?? BigInt(0)),
            BigInt(0)
          );

          clientExpected += expected;
          clientActualPaid += actualPaid;

          services.push({
            serviceId: service.id,
            siteName: site.title,
            productName: service.product.name,
            price: servicePrice.toString(),
            expectedEarning: expected.toString(),
            actualPaid: actualPaid.toString(),
          });
        }
      }

      totalExpected += clientExpected;
      totalActualPaid += clientActualPaid;

      return {
        client: { id: client.id, name: client.name },
        services,
        expectedTotal: clientExpected.toString(),
        actualPaidTotal: clientActualPaid.toString(),
      };
    });

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        commissionPercent,
        commissionOnTop: agent.commissionOnTop,
        commissionInOurAmount: agent.commissionInOurAmount,
      },
      periodFrom: periodFrom || null,
      periodTo: periodTo || null,
      clientEarnings,
      totalExpected: totalExpected.toString(),
      totalActualPaid: totalActualPaid.toString(),
    });
  } catch (error) {
    console.error('Error fetching agent earnings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
