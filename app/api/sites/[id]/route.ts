import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditSite, canDeleteSite, canAssignAccountManager } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const site = await prisma.site.findUnique({
      where: { id: params.id },
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
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [
            { status: 'asc' },
            { startDate: 'desc' },
          ],
        },
      },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    return NextResponse.json({ site });
  } catch (error) {
    console.error('Error fetching site:', error);
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

    const site = await prisma.site.findUnique({
      where: { id: params.id },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (!canEditSite(user, site.creatorId, site.accountManagerId || undefined)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      websiteUrl,
      description,
      niche,
      clientId,
      accountManagerId,
      isActive,
    } = body;

    // Build update data
    const updateData: any = {
      title,
      websiteUrl: websiteUrl || null,
      description: description || null,
      niche,
      clientId,
      isActive: isActive !== undefined ? isActive : site.isActive,
    };

    // Only update accountManagerId if user can assign it
    const canAssign = await canAssignAccountManager(user);
    if (canAssign) {
      // User can assign, so update accountManagerId if provided
      if (accountManagerId !== undefined) {
        updateData.accountManagerId = accountManagerId || null;
      }
    }
    // If user can't assign, don't update accountManagerId at all (keep existing value)

    const updated = await prisma.site.update({
      where: { id: params.id },
      data: updateData,
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
    });

    return NextResponse.json({ site: updated });
  } catch (error) {
    console.error('Error updating site:', error);
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

    if (!canDeleteSite(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const site = await prisma.site.findUnique({
      where: { id: params.id },
      include: {
        services: {
          include: {
            incomes: { take: 1 },
          },
          take: 1,
        },
        expenses: { take: 1 },
      },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Check if site has services with incomes or expenses
    const hasIncomes = site.services.some(s => s.incomes.length > 0);
    if (hasIncomes || site.expenses.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete site with payments or services' },
        { status: 400 }
      );
    }

    await prisma.site.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting site:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
