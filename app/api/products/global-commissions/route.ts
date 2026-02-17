import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageProducts } from '@/lib/permissions';

export async function PUT(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await canManageProducts(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { sellerCommission, amCommission } = body;

    if (!sellerCommission || !amCommission) {
      return NextResponse.json(
        { error: 'Both sellerCommission and amCommission are required' },
        { status: 400 }
      );
    }

    const products = await prisma.product.findMany({
      select: { id: true },
    });

    if (products.length === 0) {
      return NextResponse.json(
        { error: 'No products found' },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const product of products) {
        // Upsert SELLER commission
        await tx.productCommission.upsert({
          where: {
            productId_role: {
              productId: product.id,
              role: 'SELLER',
            },
          },
          update: {
            standardPercent: sellerCommission.standardPercent,
            partnerPercent: sellerCommission.partnerPercent,
            description: sellerCommission.description || null,
          },
          create: {
            productId: product.id,
            role: 'SELLER',
            standardPercent: sellerCommission.standardPercent,
            partnerPercent: sellerCommission.partnerPercent,
            description: sellerCommission.description || null,
          },
        });

        // Upsert ACCOUNT_MANAGER commission
        await tx.productCommission.upsert({
          where: {
            productId_role: {
              productId: product.id,
              role: 'ACCOUNT_MANAGER',
            },
          },
          update: {
            standardPercent: amCommission.standardPercent,
            partnerPercent: amCommission.partnerPercent,
            description: amCommission.description || null,
          },
          create: {
            productId: product.id,
            role: 'ACCOUNT_MANAGER',
            standardPercent: amCommission.standardPercent,
            partnerPercent: amCommission.partnerPercent,
            description: amCommission.description || null,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating global commissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
