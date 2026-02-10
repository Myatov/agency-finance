/**
 * Добавляет права для разделов «Контакты», «Агенты / Партнёры» и «Счета»
 * роли ACCOUNT_MANAGER.
 *
 * Скрипт идемпотентен: повторный запуск не создаёт дубли.
 *
 * Запуск:
 *   npx tsx scripts/add-contacts-agents-invoices-permissions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLE_CODE = 'ACCOUNT_MANAGER';

const PERMISSIONS: Array<{ section: string; permission: string }> = [
  // Контакты
  { section: 'contacts', permission: 'view' },
  { section: 'contacts', permission: 'create' },
  { section: 'contacts', permission: 'edit' },
  // Агенты / Партнёры
  { section: 'agents', permission: 'view' },
  { section: 'agents', permission: 'create' },
  { section: 'agents', permission: 'edit' },
  // Счета — просмотр списка и деталей
  { section: 'invoices', permission: 'view' },
];

async function main() {
  console.log('🔐 Обновление прав роли ACCOUNT_MANAGER...');

  const role = await prisma.role.findUnique({
    where: { code: ROLE_CODE },
  });

  if (!role) {
    console.error(`❌ Роль с кодом ${ROLE_CODE} не найдена`);
    return;
  }

  for (const p of PERMISSIONS) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_section_permission: {
          roleId: role.id,
          section: p.section,
          permission: p.permission,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        section: p.section,
        permission: p.permission,
      },
    });
  }

  console.log('✅ Права для ACCOUNT_MANAGER обновлены.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

