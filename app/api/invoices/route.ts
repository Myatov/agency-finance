import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessServiceForPeriods } from '@/lib/permissions';

const invoiceListInclude = {
  payments: true,
  lines: {
    include: {
      workPeriod: {
        include: {
          service: {
            include: { site: { include: { client: { select: { sellerEmployeeId: true } } } } },
          },
        },
      },
    },
  },
  legalEntity: { select: { id: true, name: true } },
  workPeriod: {
    include: {
      service: {
        include: { site: { include: { client: { select: { id: true, name: true, sellerEmployeeId: true } } } } },
      },
    },
  },
};

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workPeriodId = request.nextUrl.searchParams.get('workPeriodId');

    if (workPeriodId) {
      const period = await prisma.workPeriod.findUnique({
        where: { id: workPeriodId },
        include: {
          service: { include: { site: { include: { client: true } } } },
        },
      });
      if (!period) return NextResponse.json({ error: 'Work period not found' }, { status: 404 });

      const canAccess = await canAccessServiceForPeriods(
        user,
        period.service.site.accountManagerId,
        period.service.site.client.sellerEmployeeId
      );
      if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const [byPeriod, byLines] = await Promise.all([
        prisma.invoice.findMany({
          where: { workPeriodId },
          include: invoiceListInclude,
        }),
        prisma.invoice.findMany({
          where: { lines: { some: { workPeriodId } } },
          include: invoiceListInclude,
        }),
      ]);
      const seen = new Set(byPeriod.map((i) => i.id));
      const merged = [...byPeriod];
      for (const inv of byLines) {
        if (!seen.has(inv.id)) {
          merged.push(inv);
          seen.add(inv.id);
        }
      }

      const out = JSON.parse(JSON.stringify(merged, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
      return NextResponse.json({ invoices: out });
    }

    // Список всех счетов (для раздела «Счета»): только те, к которым есть доступ
    const all = await prisma.invoice.findMany({
      include: invoiceListInclude,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    const filtered: typeof all = [];
    for (const inv of all) {
      const canMain = await canAccessServiceForPeriods(
        user,
        inv.workPeriod.service.site.accountManagerId,
        inv.workPeriod.service.site.client.sellerEmployeeId
      );
      if (canMain) {
        filtered.push(inv);
        continue;
      }
      for (const l of inv.lines) {
        const can = await canAccessServiceForPeriods(
          user,
          l.workPeriod.service.site.accountManagerId,
          l.workPeriod.service.site.client.sellerEmployeeId
        );
        if (can) {
          filtered.push(inv);
          break;
        }
      }
    }

    const out = JSON.parse(JSON.stringify(filtered, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ invoices: out });
  } catch (e: any) {
    console.error('GET invoices', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      workPeriodId,
      amount,
      coverageFrom,
      coverageTo,
      invoiceNumber,
      invoiceDate: invoiceDateBody,
      legalEntityId,
      invoiceNotRequired,
      lines: linesBody,
    } = body;

    const legalEntity = await prisma.legalEntity.findUnique({
      where: { id: legalEntityId },
    });
    if (!legalEntity) return NextResponse.json({ error: 'Legal entity not found' }, { status: 404 });

    // Создание счёта из раздела «Счета» с несколькими периодами (строками)
    if (Array.isArray(linesBody) && linesBody.length > 0) {
      const first = linesBody[0];
      const workPeriodIdFirst = first.workPeriodId;
      if (!workPeriodIdFirst) {
        return NextResponse.json({ error: 'У каждой строки должен быть workPeriodId' }, { status: 400 });
      }
      const firstPeriod = await prisma.workPeriod.findUnique({
        where: { id: workPeriodIdFirst },
        include: { service: { include: { site: { include: { client: { select: { legalEntityId: true } } } } } } },
      });
      if (!firstPeriod) return NextResponse.json({ error: 'Период не найден' }, { status: 404 });
      const clientLegalEntityId = firstPeriod.service.site.client.legalEntityId;
      if (!clientLegalEntityId) {
        return NextResponse.json(
          { error: 'У клиента не указано юрлицо. Укажите юрлицо в карточке клиента.' },
          { status: 400 }
        );
      }
      const legalEntityFromClient = await prisma.legalEntity.findUnique({
        where: { id: clientLegalEntityId },
      });
      if (!legalEntityFromClient) return NextResponse.json({ error: 'Юрлицо клиента не найдено' }, { status: 404 });
      if (!legalEntityFromClient.generateClosingDocs) {
        return NextResponse.json(
          { error: 'У выбранного юрлица клиента отключено «Формировать закрывающие документы». Включите в разделе Юрлица или выберите другое юрлицо у клиента.' },
          { status: 400 }
        );
      }
      let totalAmount = BigInt(0);
      const lineCreates: { workPeriodId: string; amount: bigint; sortOrder: number; serviceNameOverride?: string | null; siteNameOverride?: string | null }[] = [];
      for (let i = 0; i < linesBody.length; i++) {
        const row = linesBody[i];
        const wpId = row.workPeriodId;
        const amt = row.amount !== undefined ? BigInt(Math.round(parseFloat(String(row.amount)) * 100)) : null;
        if (!wpId || amt === null) {
          return NextResponse.json({ error: `Строка ${i + 1}: должны быть указаны workPeriodId и amount` }, { status: 400 });
        }
        const period = await prisma.workPeriod.findUnique({
          where: { id: wpId },
          include: { service: { include: { site: { include: { client: true } } } } },
        });
        if (!period) return NextResponse.json({ error: `Период ${wpId} не найден` }, { status: 404 });
        const canAccess = await canAccessServiceForPeriods(
          user,
          period.service.site.accountManagerId,
          period.service.site.client.sellerEmployeeId
        );
        if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        totalAmount += amt;
        lineCreates.push({
          workPeriodId: wpId,
          amount: amt,
          sortOrder: i,
          serviceNameOverride: row.serviceNameOverride && String(row.serviceNameOverride).trim() ? String(row.serviceNameOverride).trim() : null,
          siteNameOverride: row.siteNameOverride && String(row.siteNameOverride).trim() ? String(row.siteNameOverride).trim() : null,
        });
      }
      // Номер счёта: 5–7 знаков, уникальный
      let nextNumber: string;
      if (invoiceNumber && String(invoiceNumber).trim()) {
        nextNumber = String(invoiceNumber).trim();
      } else {
        const withNum = await prisma.invoice.findMany({
          where: { invoiceNumber: { not: null } },
          select: { invoiceNumber: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        const numeric = withNum
          .map((i) => i.invoiceNumber)
          .filter((n): n is string => n != null && /^\d{5,7}$/.test(String(n)))
          .map((n) => parseInt(n, 10));
        const max = numeric.length ? Math.max(...numeric) : 99999;
        nextNumber = String(max + 1);
      }
      const { randomUUID } = await import('crypto');
      const invoiceDate = invoiceDateBody ? new Date(invoiceDateBody) : new Date();
      const invoice = await prisma.invoice.create({
        data: {
          workPeriodId: workPeriodIdFirst,
          amount: totalAmount,
          coverageFrom: null,
          coverageTo: null,
          invoiceNumber: nextNumber,
          invoiceDate,
          legalEntityId: clientLegalEntityId,
          generateClosingDocsAtInvoice: legalEntityFromClient.generateClosingDocs,
          closingDocPerInvoiceAtInvoice: legalEntityFromClient.closingDocPerInvoice,
          invoiceNotRequired: Boolean(invoiceNotRequired),
          publicToken: randomUUID(),
          createdByUserId: user.id,
          lines: {
            create: lineCreates,
          },
        },
        include: {
          payments: true,
          lines: {
            include: {
              workPeriod: {
                include: {
                  service: {
                    include: {
                      product: { select: { name: true } },
                      site: { select: { title: true } },
                    },
                  },
                },
              },
            },
          },
          legalEntity: { select: { id: true, name: true } },
        },
      });
      const out = JSON.parse(JSON.stringify(invoice, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
      return NextResponse.json({ invoice: out });
    }

    // Создание счёта с одного периода (со страницы периода или старый формат)
    if (!workPeriodId || amount === undefined || !legalEntityId) {
      return NextResponse.json({ error: 'workPeriodId, amount, legalEntityId are required' }, { status: 400 });
    }

    const period = await prisma.workPeriod.findUnique({
      where: { id: workPeriodId },
      include: {
        service: { include: { site: { include: { client: true } } } },
      },
    });
    if (!period) return NextResponse.json({ error: 'Work period not found' }, { status: 404 });

    const canAccess = await canAccessServiceForPeriods(
      user,
      period.service.site.accountManagerId,
      period.service.site.client.sellerEmployeeId
    );
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const amountBigInt = BigInt(Math.round(parseFloat(String(amount)) * 100));

    // Если у ЮЛ не включено «Формировать закрывающие документы» — только пометка, счёт не создаём
    if (!legalEntity.generateClosingDocs) {
      const note = await prisma.periodInvoiceNote.create({
        data: {
          workPeriodId,
          amount: amountBigInt,
          legalEntityId,
          invoiceNumber: invoiceNumber && String(invoiceNumber).trim() ? String(invoiceNumber).trim() : null,
          issuedAt: new Date(),
          createdByUserId: user.id,
        },
        include: {
          legalEntity: { select: { id: true, name: true } },
        },
      });
      const out = JSON.parse(JSON.stringify(note, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
      return NextResponse.json({ note: out });
    }

    const { randomUUID } = await import('crypto');
    const invoiceDate = coverageFrom ? new Date(coverageFrom) : new Date();

    const invoice = await prisma.invoice.create({
      data: {
        workPeriodId,
        amount: amountBigInt,
        coverageFrom: coverageFrom ? new Date(coverageFrom) : null,
        coverageTo: coverageTo ? new Date(coverageTo) : null,
        invoiceNumber: invoiceNumber && String(invoiceNumber).trim() ? String(invoiceNumber).trim() : null,
        invoiceDate,
        legalEntityId,
        generateClosingDocsAtInvoice: legalEntity.generateClosingDocs,
        closingDocPerInvoiceAtInvoice: legalEntity.closingDocPerInvoice,
        invoiceNotRequired: Boolean(invoiceNotRequired),
        publicToken: randomUUID(),
        createdByUserId: user.id,
        lines: {
          create: {
            workPeriodId,
            amount: amountBigInt,
            sortOrder: 0,
          },
        },
      },
      include: {
        payments: true,
        lines: true,
        legalEntity: { select: { id: true, name: true } },
      },
    });

    const out = JSON.parse(JSON.stringify(invoice, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return NextResponse.json({ invoice: out });
  } catch (e: any) {
    console.error('POST invoices', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
