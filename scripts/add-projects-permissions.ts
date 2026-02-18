/**
 * Добавляет право projects:manage ролям OWNER и CEO (если отсутствует).
 * Идемпотентен.
 *
 * Запуск:
 *   npx tsx scripts/add-projects-permissions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES_AND_PERMISSIONS: Array<{ roleCode: string; section: string; permission: string }> = [
  { roleCode: 'OWNER', section: 'projects', permission: 'manage' },
  { roleCode: 'CEO', section: 'projects', permission: 'manage' },
];

async function main() {
  for (const entry of ROLES_AND_PERMISSIONS) {
    const role = await prisma.role.findUnique({ where: { code: entry.roleCode } });
    if (!role) {
      console.log(`Role ${entry.roleCode} not found, skipping`);
      continue;
    }
    await prisma.rolePermission.upsert({
      where: {
        roleId_section_permission: {
          roleId: role.id,
          section: entry.section,
          permission: entry.permission,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        section: entry.section,
        permission: entry.permission,
      },
    });
    console.log(`${entry.roleCode}: ${entry.section}:${entry.permission} OK`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
