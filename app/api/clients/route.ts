import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAddClient } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clients = await prisma.client.findMany({
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
    const {
      name,
      legalEntityId,
      sellerEmployeeId,
      legalEntityName,
      contractBasis,
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
    } = body;

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

    // Validate required fields for IP/OOO types
    if (legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO')) {
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
        name,
        legalEntityId: legalEntityId || null,
        sellerEmployeeId,
        legalEntityName: legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO') ? legalEntityName : null,
        contractBasis: legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO') ? contractBasis : null,
        legalAddress: legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO') ? legalAddress : null,
        inn: legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO') ? inn : null,
        kpp: legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO') ? kpp : null,
        ogrn: legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO') ? ogrn : null,
        rs: legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO') ? rs : null,
        bankName: legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO') ? bankName : null,
        bik: legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO') ? bik : null,
        ks: legalEntity && (legalEntity.type === 'IP' || legalEntity.type === 'OOO') ? ks : null,
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
