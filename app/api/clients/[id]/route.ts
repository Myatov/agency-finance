import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditClient, canDeleteClient } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        legalEntity: true,
        seller: {
          select: {
            id: true,
            fullName: true,
          },
        },
        sites: {
          select: {
            id: true,
            title: true,
            niche: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    console.error('Error fetching client:', error);
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

    if (!canEditClient(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const name = body.name;
    const legalEntityId = body.legalEntityId ?? null;
    const sellerEmployeeId = body.sellerEmployeeId;
    const legalEntityName = body.legalEntityName ?? null;
    const contractBasis = body.contractBasis ?? null;
    const legalAddress = body.legalAddress ?? null;
    const inn = body.inn ?? null;
    const kpp = body.kpp ?? null;
    const ogrn = body.ogrn ?? null;
    const rs = body.rs ?? null;
    const bankName = body.bankName ?? null;
    const bik = body.bik ?? null;
    const ks = body.ks ?? null;
    const paymentRequisites = body.paymentRequisites ?? null;
    const contacts = body.contacts ?? null;

    // Get legal entity if provided
    let legalEntity = null;
    if (legalEntityId) {
      legalEntity = await prisma.legalEntity.findUnique({
        where: { id: legalEntityId },
      });
      if (!legalEntity) {
        return NextResponse.json({ error: 'Legal entity not found' }, { status: 400 });
      }
    }

    const skipContractBasisFor = ['ИП Мятов Сбербанк', 'ИП Мятов ВТБ', 'ООО Велюр Груп'];
    const skipContractBasis = legalEntity && skipContractBasisFor.includes(legalEntity.name);

    if (legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO') && !skipContractBasis) {
      if (
        !legalEntityName ||
        !contractBasis ||
        !legalAddress ||
        !inn ||
        !kpp ||
        !ogrn ||
        !rs ||
        !bankName ||
        !bik ||
        !ks
      ) {
        return NextResponse.json(
          { error: 'All legal requisites are required for IP/OOO legal entities' },
          { status: 400 }
        );
      }
    }

    const updateData = {
      name: String(name),
      legalEntityId: legalEntityId || null,
      sellerEmployeeId: String(sellerEmployeeId),
      legalEntityName,
      contractBasis: skipContractBasis ? null : contractBasis,
      legalAddress,
      inn,
      kpp,
      ogrn,
      rs,
      bankName,
      bik,
      ks,
      paymentRequisites,
      contacts,
    };

    const client = await prisma.client.update({
      where: { id: params.id },
      data: updateData,
      include: {
        legalEntity: true,
        seller: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json({ client });
  } catch (error) {
    console.error('Error updating client:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
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

    if (!canDeleteClient(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = await prisma.client.findUnique({
      where: { id: params.id },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (client.isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system client' },
        { status: 400 }
      );
    }

    // Get "Без клиентов" client
    const noClient = await prisma.client.findFirst({
      where: { isSystem: true },
    });

    if (!noClient) {
      return NextResponse.json(
        { error: 'System client not found' },
        { status: 500 }
      );
    }

    // Move all sites to "Без клиентов"
    await prisma.site.updateMany({
      where: { clientId: params.id },
      data: { clientId: noClient.id },
    });

    // Delete client
    await prisma.client.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
