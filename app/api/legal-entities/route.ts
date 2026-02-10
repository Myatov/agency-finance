import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LegalEntityType } from '@prisma/client';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canView = await hasPermission(user, 'legal-entities', 'view');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Any authenticated user can view legal entities (needed for client creation/editing)
    // But only active ones are shown in dropdowns
    const legalEntities = await prisma.legalEntity.findMany({
      where: {
        isActive: true, // Only return active legal entities for dropdowns
      },
      orderBy: { name: 'asc' },
    });

    // Calculate totalTaxLoad for each entity
    const entitiesWithTaxLoad = legalEntities.map((entity) => ({
      ...entity,
      totalTaxLoad: entity.usnPercent + entity.vatPercent,
    }));

    return NextResponse.json({ legalEntities: entitiesWithTaxLoad });
  } catch (error: any) {
    console.error('Error fetching legal entities:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canManage = await hasPermission(user, 'legal-entities', 'manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      type,
      usnPercent,
      vatPercent,
      isActive,
      fullName,
      contactInfo,
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

    if (!name || type === undefined || usnPercent === undefined || vatPercent === undefined) {
      return NextResponse.json(
        { error: 'Name, type, usnPercent, and vatPercent are required' },
        { status: 400 }
      );
    }

    // Validate and convert type to enum
    const validTypes = ['IP', 'OOO', 'CARD', 'CRYPTO', 'BARTER'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid legal entity type' }, { status: 400 });
    }

    // Helper function to clean string values
    const cleanString = (val: any): string | null => {
      if (!val || typeof val !== 'string') return null;
      const trimmed = val.trim();
      return trimmed === '' ? null : trimmed;
    };

    const createData: any = {
      name: name.trim(),
      type: type as LegalEntityType,
      usnPercent: parseFloat(String(usnPercent)) || 0,
      vatPercent: parseFloat(String(vatPercent)) || 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    };

    // Add optional fields only if they have values
    const optionalFields = {
      fullName,
      contactInfo,
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
    };

    for (const [key, value] of Object.entries(optionalFields)) {
      const cleaned = cleanString(value);
      if (cleaned !== null) {
        createData[key] = cleaned;
      }
    }

    if (generateClosingDocs !== undefined) createData.generateClosingDocs = Boolean(generateClosingDocs);
    if (closingDocPerInvoice !== undefined) createData.closingDocPerInvoice = closingDocPerInvoice === null || closingDocPerInvoice === undefined ? null : Boolean(closingDocPerInvoice);

    const legalEntity = await prisma.legalEntity.create({
      data: createData,
    });

    return NextResponse.json({
      legalEntity: {
        ...legalEntity,
        totalTaxLoad: legalEntity.usnPercent + legalEntity.vatPercent,
      },
    });
  } catch (error: any) {
    console.error('Error creating legal entity:', error);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    console.error('Error stack:', error?.stack);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Legal entity with this name already exists' }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
