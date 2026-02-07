import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LegalEntityType } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Any authenticated user can view a single legal entity (needed for client forms)
    const legalEntity = await prisma.legalEntity.findUnique({
      where: { id: params.id },
    });

    if (!legalEntity) {
      return NextResponse.json({ error: 'Legal entity not found' }, { status: 404 });
    }

    return NextResponse.json({
      legalEntity: {
        ...legalEntity,
        totalTaxLoad: legalEntity.usnPercent + legalEntity.vatPercent,
      },
    });
  } catch (error: any) {
    console.error('Error fetching legal entity:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
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

    if (user.roleCode !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      type,
      usnPercent,
      vatPercent,
      isActive,
      generalDirector,
      activityBasis,
      legalAddress,
      inn,
      kpp,
      ogrn,
      rs,
      bankName,
      bik,
      ks,
      paymentInfo,
      generateClosingDocs,
      closingDocPerInvoice,
    } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) {
      const validTypes = ['IP', 'OOO', 'CARD', 'CRYPTO', 'BARTER'];
      if (!validTypes.includes(type)) {
        return NextResponse.json({ error: 'Invalid legal entity type' }, { status: 400 });
      }
      updateData.type = type as LegalEntityType;
    }
    if (usnPercent !== undefined) updateData.usnPercent = parseFloat(usnPercent) || 0;
    if (vatPercent !== undefined) updateData.vatPercent = parseFloat(vatPercent) || 0;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (generalDirector !== undefined) updateData.generalDirector = generalDirector && generalDirector.trim() !== '' ? generalDirector.trim() : null;
    if (activityBasis !== undefined) updateData.activityBasis = activityBasis && activityBasis.trim() !== '' ? activityBasis.trim() : null;
    if (legalAddress !== undefined) updateData.legalAddress = legalAddress && legalAddress.trim() !== '' ? legalAddress.trim() : null;
    if (inn !== undefined) updateData.inn = inn && inn.trim() !== '' ? inn.trim() : null;
    if (kpp !== undefined) updateData.kpp = kpp && kpp.trim() !== '' ? kpp.trim() : null;
    if (ogrn !== undefined) updateData.ogrn = ogrn && ogrn.trim() !== '' ? ogrn.trim() : null;
    if (rs !== undefined) updateData.rs = rs && rs.trim() !== '' ? rs.trim() : null;
    if (bankName !== undefined) updateData.bankName = bankName && bankName.trim() !== '' ? bankName.trim() : null;
    if (bik !== undefined) updateData.bik = bik && bik.trim() !== '' ? bik.trim() : null;
    if (ks !== undefined) updateData.ks = ks && ks.trim() !== '' ? ks.trim() : null;
    if (paymentInfo !== undefined) updateData.paymentInfo = paymentInfo && paymentInfo.trim() !== '' ? paymentInfo.trim() : null;
    if (generateClosingDocs !== undefined) updateData.generateClosingDocs = Boolean(generateClosingDocs);
    if (closingDocPerInvoice !== undefined) updateData.closingDocPerInvoice = closingDocPerInvoice === null || closingDocPerInvoice === undefined ? null : Boolean(closingDocPerInvoice);

    const updated = await prisma.legalEntity.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      legalEntity: {
        ...updated,
        totalTaxLoad: updated.usnPercent + updated.vatPercent,
      },
    });
  } catch (error: any) {
    console.error('Error updating legal entity:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Legal entity with this name already exists' }, { status: 400 });
    }
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

    // Only OWNER can delete legal entities
    if (user.roleCode !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if legal entity is used by any clients
    const clientsCount = await prisma.client.count({
      where: { legalEntityId: params.id },
    });

    if (clientsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete legal entity: it is used by ${clientsCount} client(s)` },
        { status: 400 }
      );
    }

    await prisma.legalEntity.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting legal entity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
