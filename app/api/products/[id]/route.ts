import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageProducts, hasPermission } from '@/lib/permissions';

const productInclude = {
  expenseItems: {
    include: {
      template: {
        include: {
          department: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  commissions: true,
  accountManagerFees: {
    orderBy: { sortOrder: 'asc' as const },
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canViewProducts = await hasPermission(user, 'products', 'view');
    const canViewServices = await hasPermission(user, 'services', 'view');
    const canCreateServices = await hasPermission(user, 'services', 'create');
    const canAccessProducts =
      canViewProducts || canViewServices || canCreateServices;
    if (!canAccessProducts) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: productInclude,
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Error fetching product:', error);
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

    if (!(await canManageProducts(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, expenseItems, commissions, accountManagerFees } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const productId = params.id;

    const product = await prisma.$transaction(async (tx) => {
      // Update product name
      await tx.product.update({
        where: { id: productId },
        data: { name },
      });

      // Expense items: delete all existing, then recreate
      if (expenseItems !== undefined) {
        await tx.productExpenseItem.deleteMany({
          where: { productId },
        });

        if (expenseItems.length > 0) {
          await tx.productExpenseItem.createMany({
            data: expenseItems.map(
              (item: {
                expenseItemTemplateId: string;
                valueType: string;
                defaultValue: number;
                description?: string;
                sortOrder?: number;
              }) => ({
                productId,
                expenseItemTemplateId: item.expenseItemTemplateId,
                valueType: item.valueType,
                defaultValue: item.defaultValue,
                description: item.description ?? null,
                sortOrder: item.sortOrder ?? 0,
              })
            ),
          });
        }
      }

      // Commissions: upsert by [productId, role]
      if (commissions !== undefined) {
        for (const comm of commissions as Array<{
          role: string;
          standardPercent: number;
          partnerPercent: number;
          calculationBase?: string;
          description?: string;
        }>) {
          await tx.productCommission.upsert({
            where: {
              productId_role: {
                productId,
                role: comm.role as any,
              },
            },
            update: {
              standardPercent: comm.standardPercent,
              partnerPercent: comm.partnerPercent,
              calculationBase: comm.calculationBase ?? null,
              description: comm.description ?? null,
            },
            create: {
              productId,
              role: comm.role as any,
              standardPercent: comm.standardPercent,
              partnerPercent: comm.partnerPercent,
              calculationBase: comm.calculationBase ?? null,
              description: comm.description ?? null,
            },
          });
        }
      }

      // Account manager fees: delete all existing, then recreate
      if (accountManagerFees !== undefined) {
        await tx.productAccountManagerFee.deleteMany({
          where: { productId },
        });

        if (accountManagerFees.length > 0) {
          await tx.productAccountManagerFee.createMany({
            data: accountManagerFees.map(
              (fee: {
                conditionField?: string;
                conditionMin?: number;
                conditionMax?: number;
                feeAmount: number;
                description?: string;
                sortOrder?: number;
              }) => ({
                productId,
                conditionField: fee.conditionField ?? null,
                conditionMin: fee.conditionMin ?? null,
                conditionMax: fee.conditionMax ?? null,
                feeAmount: BigInt(fee.feeAmount),
                description: fee.description ?? null,
                sortOrder: fee.sortOrder ?? 0,
              })
            ),
          });
        }
      }

      // Return the updated product with all relations
      return tx.product.findUnique({
        where: { id: productId },
        include: productInclude,
      });
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

    if (!(await canManageProducts(user))) {
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
