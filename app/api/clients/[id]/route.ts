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
        clientContacts: {
          include: {
            contact: true,
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
    const opt = (v: unknown) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);

    const name = body.name != null ? String(body.name).trim() : '';
    const legalEntityId = body.legalEntityId != null && String(body.legalEntityId).trim() !== '' ? String(body.legalEntityId).trim() : null;
    const sellerEmployeeId = body.sellerEmployeeId != null ? String(body.sellerEmployeeId).trim() : '';
    const legalEntityName = opt(body.legalEntityName);
    const contractBasis = opt(body.contractBasis);
    const legalAddress = opt(body.legalAddress);
    const inn = opt(body.inn);
    const kpp = opt(body.kpp);
    const ogrn = opt(body.ogrn);
    const rs = opt(body.rs);
    const bankName = opt(body.bankName);
    const bik = opt(body.bik);
    const ks = opt(body.ks);
    const paymentRequisites = opt(body.paymentRequisites);
    const contacts = opt(body.contacts);
    const isReturningClient = body.isReturningClient === true;
    const isKeyClient = body.isKeyClient === true;
    const keyClientStatusComment = opt(body.keyClientStatusComment);
    const returningClientStatusComment = opt(body.returningClientStatusComment);
    const clientContacts = Array.isArray(body.clientContacts) ? body.clientContacts : undefined;

    if (!name || !sellerEmployeeId) {
      return NextResponse.json(
        { error: 'Name and sellerEmployeeId are required' },
        { status: 400 }
      );
    }

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

    const updateData = {
      name,
      legalEntityId,
      sellerEmployeeId,
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
      isReturningClient,
      isKeyClient,
      keyClientStatusComment,
      returningClientStatusComment,
    };

    await prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: params.id },
        data: updateData,
      });
      if (clientContacts) {
        await tx.clientContact.deleteMany({ where: { clientId: params.id } });
        const validRoles = ['OWNER', 'MARKETING', 'FINANCE', 'IT', 'OTHER'];
        for (const link of clientContacts) {
          const contactId = link.contactId != null ? String(link.contactId).trim() : null;
          if (!contactId) continue;
          const role = link.role && validRoles.includes(String(link.role).toUpperCase()) ? String(link.role).toUpperCase() : 'OTHER';
          const isPrimary = Boolean(link.isPrimary);
          await tx.clientContact.create({
            data: {
              clientId: params.id,
              contactId,
              role: role as 'OWNER' | 'MARKETING' | 'FINANCE' | 'IT' | 'OTHER',
              isPrimary,
            },
          });
        }
      }
    });

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
        clientContacts: {
          include: {
            contact: true,
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
