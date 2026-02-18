/**
 * Удаление клиентов по имени и всех привязанных данных.
 * Поддерживает: "88 кл", "99 кл", "кл 99", "88 клиен" и т.п. (поиск по вхождению).
 *
 * Запуск: npx tsx scripts/delete-clients-88-99.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_PATTERNS = ['999клиент', 'тест 11', '88 кл', 'кл 99', '99 кл', 'кл 88', '88 клиен'];

async function main() {
  console.log('Поиск клиентов:', TARGET_PATTERNS.join(', '), '...\n');

  const clients = await prisma.client.findMany({
    where: {
      OR: TARGET_PATTERNS.map((p) => ({ name: { contains: p, mode: 'insensitive' } })),
      isSystem: false,
    },
    include: {
      sites: { select: { id: true } },
    },
  });

  if (clients.length === 0) {
    console.log('Клиенты не найдены. Готово.');
    return;
  }

  const clientIds = clients.map((c) => c.id);
  const siteIds = clients.flatMap((c) => c.sites.map((s) => s.id));

  console.log(`Найдено клиентов: ${clients.map((c) => c.name).join(', ')}`);
  console.log(`ID: ${clientIds.join(', ')}`);
  console.log(`Сайтов: ${siteIds.length}\n`);

  const services = siteIds.length > 0
    ? await prisma.service.findMany({ where: { siteId: { in: siteIds } }, select: { id: true } })
    : [];
  const serviceIds = services.map((s) => s.id);
  console.log(`Услуг: ${serviceIds.length}`);

  const workPeriods = serviceIds.length > 0
    ? await prisma.workPeriod.findMany({ where: { serviceId: { in: serviceIds } }, select: { id: true } })
    : [];
  const workPeriodIds = workPeriods.map((wp) => wp.id);
  console.log(`Периодов: ${workPeriodIds.length}\n`);

  let total = 0;
  const del = async (name: string, fn: () => Promise<{ count: number }>) => {
    const r = await fn();
    if (r.count > 0) {
      console.log(`  ${name}: ${r.count}`);
      total += r.count;
    }
    return r.count;
  };

  console.log('Удаление связанных записей...\n');

  await del('CloseoutDocument', () =>
    prisma.closeoutDocument.deleteMany({
      where:
        workPeriodIds.length > 0
          ? { OR: [{ workPeriodId: { in: workPeriodIds } }, { clientId: { in: clientIds } }] }
          : { clientId: { in: clientIds } },
    })
  );

  if (workPeriodIds.length > 0) {
    const invoices = await prisma.invoice.findMany({
      where: { workPeriodId: { in: workPeriodIds } },
      select: { id: true },
    });
    const invoiceIds = invoices.map((i) => i.id);

    if (invoiceIds.length > 0) {
      await del('Payment', () => prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } }));
      await del('InvoiceLine', () => prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } }));
    }
    await del('Invoice', () => prisma.invoice.deleteMany({ where: { workPeriodId: { in: workPeriodIds } } }));
    await del('PeriodInvoiceNote', () =>
      prisma.periodInvoiceNote.deleteMany({ where: { workPeriodId: { in: workPeriodIds } } })
    );
    await del('WorkPeriodReport', () =>
      prisma.workPeriodReport.deleteMany({ where: { workPeriodId: { in: workPeriodIds } } })
    );
  }

  await del('WorkPeriodExpenseItem', () =>
    prisma.workPeriodExpenseItem.deleteMany({ where: { workPeriodId: { in: workPeriodIds } } })
  );
  await del('WorkPeriod', () => prisma.workPeriod.deleteMany({ where: { serviceId: { in: serviceIds } } }));

  if (serviceIds.length > 0) {
    await del('Income', () => prisma.income.deleteMany({ where: { serviceId: { in: serviceIds } } }));
    await del('Expense', () =>
      prisma.expense.deleteMany({ where: { OR: [{ siteId: { in: siteIds } }, { serviceId: { in: serviceIds } }] } })
    );
  }

  await del('CloseoutPackage', () =>
    prisma.closeoutPackage.deleteMany({ where: { clientId: { in: clientIds } } })
  );

  await del('ContractDocument', () =>
    prisma.contractDocument.deleteMany({ where: { clientId: { in: clientIds } } })
  );

  await del('ClientPortalAccess', () => prisma.clientPortalAccess.deleteMany({ where: { clientId: { in: clientIds } } }));
  await del('ClientContact', () => prisma.clientContact.deleteMany({ where: { clientId: { in: clientIds } } }));
  await del('Service', () => prisma.service.deleteMany({ where: { siteId: { in: siteIds } } }));
  await del('Site', () => prisma.site.deleteMany({ where: { clientId: { in: clientIds } } }));
  await del('Client', () => prisma.client.deleteMany({ where: { id: { in: clientIds } } }));

  console.log(`\n✅ Удалено записей: ${total}`);
  console.log(`Клиенты ${clients.map((c) => c.name).join(', ')} и все связанные данные удалены.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
