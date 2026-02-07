import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditIncome } from '@/lib/permissions';
import { parseAmount } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const income = await prisma.income.findUnique({
      where: { id: params.id },
      include: {
        service: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            site: {
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
            },
          },
        },
        legalEntity: {
          select: {
            id: true,
            name: true,
          },
        },
        workPeriod: {
          select: {
            id: true,
            dateFrom: true,
            dateTo: true,
            periodType: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
        updater: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!income) {
      return NextResponse.json({ error: 'Income not found' }, { status: 404 });
    }

    // Convert BigInt to string for JSON serialization
    const incomeResponse = JSON.parse(JSON.stringify(income, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return NextResponse.json({ income: incomeResponse });
  } catch (error) {
    console.error('Error fetching income:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const income = await prisma.income.findUnique({
      where: { id: params.id },
    });

    if (!income) {
      return NextResponse.json({ error: 'Income not found' }, { status: 404 });
    }

    const canEdit = await canEditIncome(user, income.createdByUserId);
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { amount, serviceId, workPeriodId, legalEntityId, comment, incomeDate } = body;

    const updateData: any = {
      updatedAt: new Date(),
      updatedByUserId: user.id,
    };

    if (amount) {
      updateData.amount = parseAmount(amount);
    }
    if (serviceId) {
      // Verify service exists
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });
      if (!service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }
      updateData.serviceId = serviceId;
    }
    if (workPeriodId !== undefined) {
      updateData.workPeriodId = workPeriodId || null;
    }
    if (legalEntityId !== undefined) {
      updateData.legalEntityId = legalEntityId || null;
    }
    if (comment !== undefined) {
      updateData.comment = comment || null;
    }
    // Only OWNER and CEO can change incomeDate
    if (incomeDate && (user.roleCode === 'OWNER' || user.roleCode === 'CEO')) {
      updateData.incomeDate = new Date(incomeDate);
    }

    const updated = await prisma.income.update({
      where: { id: params.id },
      data: updateData,
      include: {
        service: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            site: {
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
            },
          },
        },
        legalEntity: {
          select: {
            id: true,
            name: true,
          },
        },
        workPeriod: {
          select: {
            id: true,
            dateFrom: true,
            dateTo: true,
            periodType: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
        updater: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Convert BigInt to string for JSON serialization
    const incomeResponse = JSON.parse(JSON.stringify(updated, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return NextResponse.json({ income: incomeResponse });
  } catch (error) {
    console.error('Error updating income:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const income = await prisma.income.findUnique({
      where: { id: params.id },
    });

    if (!income) {
      return NextResponse.json({ error: 'Income not found' }, { status: 404 });
    }

    // Only OWNER and CEO can delete incomes
    if (user.roleCode !== 'OWNER' && user.roleCode !== 'CEO') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.income.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting income:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
