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

    if (!name || !sellerEmployeeId) {
      return NextResponse.json(
        { error: 'Name and sellerEmployeeId are required' },
        { status: 400 }
      );
    }

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

    const client = await prisma.client.create({
      data: {
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
