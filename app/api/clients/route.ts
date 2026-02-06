import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAddClient, hasViewAllPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const viewAll = await hasViewAllPermission(user, 'clients');
    const where = viewAll ? {} : { sellerEmployeeId: user.id };

    const clients = await prisma.client.findMany({
      where,
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
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canAddClient(user)) {
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

    const client = await prisma.client.create({
      data: {
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
      },
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
    console.error('Error creating client:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
