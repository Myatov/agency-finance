import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasViewAllPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const viewAll = await hasViewAllPermission(user, 'storage');

    // Fetch contracts grouped by client
    const contractsWhere: any = {};
    if (!viewAll) {
      contractsWhere.OR = [
        { uploadedByUserId: user.id },
        { client: { accountManagerId: user.id } },
        { client: { sellerEmployeeId: user.id } },
      ];
    }

    const contracts = await prisma.contractDocument.findMany({
      where: contractsWhere,
      include: {
        client: { select: { id: true, name: true } },
        uploader: { select: { id: true, fullName: true } },
        site: { select: { id: true, title: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    // Fetch invoices
    const invoicesWhere: any = {};
    if (!viewAll) {
      invoicesWhere.OR = [
        { createdByUserId: user.id },
        { workPeriod: { service: { site: { client: { accountManagerId: user.id } } } } },
        { workPeriod: { service: { site: { client: { sellerEmployeeId: user.id } } } } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where: invoicesWhere,
      include: {
        legalEntity: { select: { id: true, name: true } },
        workPeriod: {
          include: {
            service: {
              include: {
                site: {
                  include: {
                    client: { select: { id: true, name: true } },
                  },
                },
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch closeout documents (has clientId directly)
    const closeoutWhere: any = {};
    if (!viewAll) {
      closeoutWhere.OR = [
        { uploadedById: user.id },
        { client: { accountManagerId: user.id } },
        { client: { sellerEmployeeId: user.id } },
      ];
    }

    const closeoutDocs = await prisma.closeoutDocument.findMany({
      where: closeoutWhere,
      include: {
        client: { select: { id: true, name: true } },
        workPeriod: {
          include: {
            service: {
              include: {
                site: { select: { title: true } },
                product: { select: { name: true } },
              },
            },
          },
        },
        uploader: { select: { id: true, fullName: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    // Fetch period reports (no uploadedAt - use completedAt, no uploader - use accountManager)
    const reportsWhere: any = {};
    if (!viewAll) {
      reportsWhere.OR = [
        { accountManagerId: user.id },
        { workPeriod: { service: { site: { client: { accountManagerId: user.id } } } } },
        { workPeriod: { service: { site: { client: { sellerEmployeeId: user.id } } } } },
      ];
    }

    const periodReports = await prisma.workPeriodReport.findMany({
      where: reportsWhere,
      include: {
        accountManager: { select: { id: true, fullName: true } },
        workPeriod: {
          include: {
            service: {
              include: {
                site: {
                  include: {
                    client: { select: { id: true, name: true } },
                  },
                },
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    // Group everything by client
    const clientMap = new Map<string, {
      client: { id: string; name: string };
      contracts: any[];
      invoices: any[];
      closeoutDocs: any[];
      periodReports: any[];
    }>();

    const getOrCreate = (clientId: string, clientName: string) => {
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          client: { id: clientId, name: clientName },
          contracts: [],
          invoices: [],
          closeoutDocs: [],
          periodReports: [],
        });
      }
      return clientMap.get(clientId)!;
    };

    for (const c of contracts) {
      if (c.client) {
        const group = getOrCreate(c.client.id, c.client.name);
        group.contracts.push({
          id: c.id,
          type: c.type,
          docNumber: c.docNumber,
          docDate: c.docDate,
          endDate: c.endDate,
          status: c.status,
          uploadedAt: c.uploadedAt,
          originalName: c.originalName,
          uploader: c.uploader,
          site: c.site,
        });
      }
    }

    for (const inv of invoices) {
      const client = inv.workPeriod?.service?.site?.client;
      if (client) {
        const group = getOrCreate(client.id, client.name);
        group.invoices.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount.toString(),
          createdAt: inv.createdAt,
          legalEntity: inv.legalEntity,
          service: inv.workPeriod?.service?.product?.name,
          site: inv.workPeriod?.service?.site?.title,
          periodFrom: inv.workPeriod?.dateFrom,
          periodTo: inv.workPeriod?.dateTo,
        });
      }
    }

    for (const cd of closeoutDocs) {
      if (cd.client) {
        const group = getOrCreate(cd.client.id, cd.client.name);
        group.closeoutDocs.push({
          id: cd.id,
          docType: cd.docType,
          originalName: cd.originalName,
          uploadedAt: cd.uploadedAt,
          uploader: cd.uploader,
          service: cd.workPeriod?.service?.product?.name,
          site: cd.workPeriod?.service?.site?.title,
          periodFrom: cd.workPeriod?.dateFrom,
          periodTo: cd.workPeriod?.dateTo,
        });
      }
    }

    for (const pr of periodReports) {
      const client = pr.workPeriod?.service?.site?.client;
      if (client) {
        const group = getOrCreate(client.id, client.name);
        group.periodReports.push({
          id: pr.id,
          paymentType: pr.paymentType,
          originalName: pr.originalName,
          completedAt: pr.completedAt,
          accountManager: pr.accountManager,
          service: pr.workPeriod?.service?.product?.name,
          site: pr.workPeriod?.service?.site?.title,
          periodFrom: pr.workPeriod?.dateFrom,
          periodTo: pr.workPeriod?.dateTo,
        });
      }
    }

    const clientGroups = Array.from(clientMap.values()).sort((a, b) =>
      a.client.name.localeCompare(b.client.name, 'ru')
    );

    return NextResponse.json({ clientGroups });
  } catch (error: any) {
    console.error('Error fetching storage by client:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error?.message : undefined },
      { status: 500 }
    );
  }
}
