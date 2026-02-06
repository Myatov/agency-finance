/**
 * Проверка: сохраняются ли реквизиты клиента в БД.
 * Запуск: npx tsx scripts/test-client-requisites.ts
 */
import { prisma } from '../lib/db';

async function main() {
  const user = await prisma.user.findFirst();
  const legalEntity = await prisma.legalEntity.findFirst();
  if (!user || !legalEntity) {
    console.log('Нужен хотя бы один User и LegalEntity в БД. Запустите seed.');
    process.exit(1);
  }

  const testRequisites = {
    name: 'Тест реквизитов ' + Date.now(),
    legalEntityId: legalEntity.id,
    sellerEmployeeId: user.id,
    legalEntityName: 'ООО Тест',
    legalAddress: 'г. Москва, ул. Тестовая, 1',
    inn: '7707123456',
    kpp: '770701001',
    ogrn: '1027700123456',
    rs: '40702810000000000001',
    bankName: 'ПАО Сбербанк',
    bik: '044525225',
    ks: '30101810400000000225',
    paymentRequisites: 'Платежные реквизиты тест',
    contacts: '+7 999 123-45-67',
  };

  const created = await prisma.client.create({
    data: testRequisites,
  });

  const read = await prisma.client.findUnique({ where: { id: created.id } });
  const ok =
    read?.legalEntityName === testRequisites.legalEntityName &&
    read?.contacts === testRequisites.contacts &&
    read?.inn === testRequisites.inn;

  console.log(ok ? 'OK: реквизиты сохраняются в БД.' : 'FAIL: реквизиты не совпали.', read);

  await prisma.client.delete({ where: { id: created.id } });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
