import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAddClient, hasViewAllPermission, hasPermission } from '@/lib/permissions';
import { notifyNewClient } from '@/lib/telegram';

const clientInclude = {
  legalEntity: true,
  seller: { select: { id: true, fullName: true } },
  accountManager: { select: { id: true, fullName: true } },
  agent: { select: { id: true, name: true, phone: true, telegram: true } },
  sites: { select: { id: true, title: true, niche: true } },
  clientContacts: { include: { contact: true } },
};

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const forPayments = searchParams.get('forPayments') === '1';
    const forCloseout = searchParams.get('forCloseout') === '1';
    const filter = searchParams.get('filter') || 'active';
    const includeNoProjects = searchParams.get('includeNoProjects') === '1';
    const archivedOnly = searchParams.get('archived') === '1';
    const sellerId = searchParams.get('sellerId');
    const accountManagerId = searchParams.get('accountManagerId');

    let where: any = {};

    if (forCloseout) {
      const canViewCloseout = await hasPermission(user, 'closeout', 'view') || await hasPermission(user, 'storage', 'view');
      if (!canViewCloseout) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      where = { accountManagerId: user.id };
    } else if (forPayments) {
      const canViewPayments = await hasPermission(user, 'payments', 'view');
      if (!canViewPayments) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const viewAllPayments = await hasViewAllPermission(user, 'payments');
      if (viewAllPayments) {
        where = { sites: { some: { services: { some: { status: 'ACTIVE' } } } } };
      } else {
        where = { accountManagerId: user.id };
      }
    } else {
      const viewAll = await hasViewAllPermission(user, 'clients');

      // Базовый фильтр по правам и архивности
      const baseWhere: any = {
        ...(viewAll ? {} : { sellerEmployeeId: user.id }),
        // По умолчанию показываем только неархивных клиентов, архивные — через отдельный фильтр
        ...(archivedOnly ? { isArchived: true } : { isArchived: false }),
      };

      const andConditions: any[] = [];

      if (filter === 'active') {
        andConditions.push({ sites: { some: { services: { some: { status: 'ACTIVE' } } } } });
      } else if (filter === 'inactive') {
        andConditions.push({
          AND: [
            { sites: { some: { services: { some: {} } } } },
            { NOT: { sites: { some: { services: { some: { status: 'ACTIVE' } } } } } },
          ],
        });
      }

      if (accountManagerId) {
        andConditions.push({ accountManagerId });
      }

      if (includeNoProjects) {
        const baseForNoProjects = viewAll ? {} : { sellerEmployeeId: user.id };
        const noProjectsWhere = {
          OR: [
            { sites: { none: {} } },
            { AND: [{ sites: { some: {} } }, { sites: { every: { services: { none: {} } } } }] },
          ],
        };

        const mainWhere =
          andConditions.length > 0 ? { ...baseWhere, AND: andConditions } : { ...baseWhere };

        where = {
          OR: [mainWhere, { ...baseForNoProjects, ...noProjectsWhere }],
        };
      } else {
        where = andConditions.length > 0 ? { ...baseWhere, AND: andConditions } : { ...baseWhere };
      }

      if (sellerId) {
        where = { ...where, sellerEmployeeId: sellerId };
      }
    }

    const clients = await prisma.client.findMany({
      where,
      include: clientInclude,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ clients }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
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
    const accountManagerId = body.accountManagerId != null && String(body.accountManagerId).trim() !== '' ? String(body.accountManagerId).trim() : null;
    const agentId = body.agentId != null && String(body.agentId).trim() !== '' ? String(body.agentId).trim() : null;
    const legalEntityName = opt(body.legalEntityName);
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
    const workStartDate = body.workStartDate != null && String(body.workStartDate).trim() !== '' ? new Date(String(body.workStartDate).trim()) : null;
    const isArchived = body.isArchived === true;
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

    const client = await prisma.client.create({
      data: {
        name,
        legalEntityId,
        sellerEmployeeId,
        accountManagerId,
        agentId,
        legalEntityName,
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
        workStartDate,
        isArchived,
      },
      include: {
        legalEntity: true,
        seller: {
          select: {
            id: true,
            fullName: true,
          },
        },
        accountManager: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (clientContacts && clientContacts.length > 0) {
      const validRoles = ['OWNER', 'MARKETING', 'FINANCE', 'IT', 'OTHER'];
      for (const link of clientContacts) {
        const contactId = link.contactId != null ? String(link.contactId).trim() : null;
        if (!contactId) continue;
        const role = link.role && validRoles.includes(String(link.role).toUpperCase()) ? String(link.role).toUpperCase() : 'OTHER';
        const isPrimary = Boolean(link.isPrimary);
        await prisma.clientContact.create({
          data: {
            clientId: client.id,
            contactId,
            role: role as 'OWNER' | 'MARKETING' | 'FINANCE' | 'IT' | 'OTHER',
            isPrimary,
          },
        });
      }
    }

    const clientWithContacts = await prisma.client.findUnique({
      where: { id: client.id },
      include: {
        legalEntity: true,
        seller: { select: { id: true, fullName: true } },
        accountManager: { select: { id: true, fullName: true } },
        agent: { select: { id: true, name: true, phone: true, telegram: true } },
        clientContacts: { include: { contact: true } },
      },
    });

    // Telegram notification (fire-and-forget)
    notifyNewClient({
      name,
      seller: client.seller,
      agent: clientWithContacts?.agent ?? null,
    }).catch((e) => console.error('[Telegram] notifyNewClient error:', e));

    return NextResponse.json({ client: clientWithContacts ?? client });
  } catch (error) {
    console.error('Error creating client:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
