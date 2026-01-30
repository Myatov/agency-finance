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

    if (!canManageProducts(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { productIds } = body;

    if (!Array.isArray(productIds)) {
      return NextResponse.json({ error: 'productIds must be an array' }, { status: 400 });
    }

    // Update sortOrder for each product
    await Promise.all(
      productIds.map((productId: string, index: number) =>
        prisma.product.update({
          where: { id: productId },
          data: { sortOrder: index },
        })
      )
    );

    const products = await prisma.product.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error reordering products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
