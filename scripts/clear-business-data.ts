/**
 * Очистка бизнес-данных для демо/обучения.
 * Справочники сохраняются (сотрудники, роли, юрлица, продукты, категории расходов, ниши, агенты и т.д.).
 * Удаляются: клиенты, сайты, услуги, периоды, счета, платежи, закрывающие документы,
 * договора, доходы, расходы, контакты. В конце создаётся системный клиент «Без клиентов».
 *
 * Запуск: npx tsx scripts/clear-business-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_CLIENT_ID = 'no-client-id';

async function main() {
  console.log('🧹 Очистка бизнес-данных (справочники не трогаем)...\n');

  // Порядок удаления — от зависимых к родительским (FK)

  const deleteCount = async (name: string, fn: () => Promise<{ count: number }>) => {
    const r = await fn();
    if (r.count > 0) console.log(`  ${name}: удалено ${r.count}`);
    return r.count;
  };

  let total = 0;

  total += await deleteCount('Payment', () => prisma.payment.deleteMany({}));
  total += await deleteCount('InvoiceLine', () => prisma.invoiceLine.deleteMany({}));
  total += await deleteCount('CloseoutDocument', () => prisma.closeoutDocument.deleteMany({}));
  total += await deleteCount('Invoice', () => prisma.invoice.deleteMany({}));
  total += await deleteCount('PeriodInvoiceNote', () => prisma.periodInvoiceNote.deleteMany({}));
  total += await deleteCount('WorkPeriodReport', () => prisma.workPeriodReport.deleteMany({}));
  total += await deleteCount('WorkPeriod', () => prisma.workPeriod.deleteMany({}));
  total += await deleteCount('Income', () => prisma.income.deleteMany({}));
  total += await deleteCount('Expense', () => prisma.expense.deleteMany({}));
  total += await deleteCount('CloseoutPackage', () => prisma.closeoutPackage.deleteMany({}));
  total += await deleteCount('ContractSection', () => prisma.contractSection.deleteMany({}));
  total += await deleteCount('ContractDocument', () => prisma.contractDocument.deleteMany({}));
  total += await deleteCount('ClientPortalAccess', () => prisma.clientPortalAccess.deleteMany({}));
  total += await deleteCount('ClientContact', () => prisma.clientContact.deleteMany({}));
  total += await deleteCount('Service', () => prisma.service.deleteMany({}));
  total += await deleteCount('Site', () => prisma.site.deleteMany({}));
  total += await deleteCount('Client', () => prisma.client.deleteMany({}));
  total += await deleteCount('Contact', () => prisma.contact.deleteMany({}));

  console.log(`\n✅ Удалено записей: ${total}\n`);

  // Восстановить системного клиента «Без клиентов» (нужен для выбора «без клиента» в формах)
  const firstUser = await prisma.user.findFirst({ where: { isActive: true } });
  const barterEntity = await prisma.legalEntity.findFirst({ where: { type: 'BARTER' } });
  const anyEntity = await prisma.legalEntity.findFirst({ where: { isActive: true } });
  const legalEntityId = (barterEntity ?? anyEntity)?.id;
  if (!firstUser) {
    console.warn('⚠️ Нет активного пользователя — системный клиент не создан. Запустите seed или создайте пользователя.');
  } else if (!legalEntityId) {
    console.warn('⚠️ Нет юрлица — системный клиент создан без legalEntityId.');
  }

  if (firstUser) {
    await prisma.client.upsert({
      where: { id: SYSTEM_CLIENT_ID },
      update: {
        name: 'Без клиентов',
        legalEntityId: legalEntityId ?? null,
        sellerEmployeeId: firstUser.id,
        isSystem: true,
      },
      create: {
        id: SYSTEM_CLIENT_ID,
        name: 'Без клиентов',
        legalEntityId: legalEntityId ?? null,
        sellerEmployeeId: firstUser.id,
        isSystem: true,
      },
    });
    console.log('✅ Системный клиент «Без клиентов» создан/обновлён.\n');
  }

  console.log('Готово. Сайт готов к наполнению с нуля.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
