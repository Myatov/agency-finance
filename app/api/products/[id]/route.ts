import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageProducts } from '@/lib/permissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManageProducts(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: { name },
    });

    return NextResponse.json({ product });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Product already exists' }, { status: 400 });
    }
    console.error('Error updating product:', error);
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

    if (!canManageProducts(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if product is used in services (which are used in incomes)
    const services = await prisma.service.findFirst({
      where: { productId: params.id },
    });

    if (services) {
      return NextResponse.json(
        { error: 'Cannot delete product that is used in services' },
        { status: 400 }
      );
    }

    await prisma.product.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
