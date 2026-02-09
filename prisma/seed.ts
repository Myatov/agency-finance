import { PrismaClient, LegalEntityType, ServiceStatus, BillingType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper function to hash password
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

// Helper function to create permissions for a role
async function createPermissions(roleId: string, permissions: Array<{ section: string; permission: string }>) {
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_section_permission: {
          roleId,
          section: perm.section,
          permission: perm.permission,
        },
      },
      update: {},
      create: {
        roleId,
        section: perm.section,
        permission: perm.permission,
      },
    });
  }
}

async function main() {
  console.log('🌱 Starting seed...');

  // Create departments
  const departments = {
    seo: await prisma.department.upsert({
      where: { name: 'SEO отдел' },
      update: {},
      create: { name: 'SEO отдел' },
    }),
    marketing: await prisma.department.upsert({
      where: { name: 'Маркетинг' },
      update: {},
      create: { name: 'Маркетинг' },
    }),
    sales: await prisma.department.upsert({
      where: { name: 'Отдел продаж' },
      update: {},
      create: { name: 'Отдел продаж' },
    }),
    accounting: await prisma.department.upsert({
      where: { name: 'Отдел аккаунтинга' },
      update: {},
      create: { name: 'Отдел аккаунтинга' },
    }),
    hr: await prisma.department.upsert({
      where: { name: 'HR отдел' },
      update: {},
      create: { name: 'HR отдел' },
    }),
    other: await prisma.department.upsert({
      where: { name: 'Другие' },
      update: {},
      create: { name: 'Другие' },
    }),
    pf: await prisma.department.upsert({
      where: { name: 'ПФ' },
      update: {},
      create: { name: 'ПФ' },
    }),
  };

  // Create roles: полный список разделов (включая Услуги и Юрлица)
  const allSections = ['sites', 'services', 'clients', 'contracts', 'invoices', 'closeout', 'storage', 'incomes', 'expenses', 'cost-items', 'employees', 'products', 'reports', 'legal-entities', 'roles'];
  const allManagePermissions = allSections.flatMap((section) => [{ section, permission: 'manage' }]);

  // OWNER (Владелец) — полный доступ ко всему, включая Роли и Юрлица
  const roleOwner = await prisma.role.upsert({
    where: { code: 'OWNER' },
    update: {},
    create: {
      name: 'Владелец',
      code: 'OWNER',
      isSystem: true,
    },
  });
  await createPermissions(roleOwner.id, allManagePermissions);

  // CEO — полный доступ ко всему, кроме Ролей и Юрлиц (скрытые от CEO разделы)
  const roleCEO = await prisma.role.upsert({
    where: { code: 'CEO' },
    update: {},
    create: {
      name: 'CEO',
      code: 'CEO',
      isSystem: true,
    },
  });
  await createPermissions(
    roleCEO.id,
    allSections.filter((s) => s !== 'roles' && s !== 'legal-entities').flatMap((section) => [{ section, permission: 'manage' }])
  );

  // Аккаунт-менеджер
  const roleAccountManager = await prisma.role.upsert({
    where: { code: 'ACCOUNT_MANAGER' },
    update: {},
    create: {
      name: 'Аккаунт-менеджер',
      code: 'ACCOUNT_MANAGER',
      isSystem: false,
    },
  });
  await createPermissions(roleAccountManager.id, [
    { section: 'sites', permission: 'view' },
    { section: 'sites', permission: 'create' },
    { section: 'sites', permission: 'edit' },
    { section: 'services', permission: 'view' },
    { section: 'services', permission: 'create' },
    { section: 'services', permission: 'edit' },
    { section: 'clients', permission: 'view' },
    { section: 'clients', permission: 'create' },
    { section: 'incomes', permission: 'view' },
    { section: 'incomes', permission: 'create' },
    { section: 'expenses', permission: 'view' },
    { section: 'cost-items', permission: 'view' },
    { section: 'employees', permission: 'view' },
    { section: 'products', permission: 'view' },
    { section: 'reports', permission: 'view' },
  ]);

  // SEO
  const roleSEO = await prisma.role.upsert({
    where: { code: 'SEO' },
    update: {},
    create: {
      name: 'SEO',
      code: 'SEO',
      isSystem: false,
    },
  });
  await createPermissions(roleSEO.id, [
    { section: 'sites', permission: 'view' },
    { section: 'incomes', permission: 'view' },
    { section: 'expenses', permission: 'view' },
    { section: 'cost-items', permission: 'view' },
    { section: 'employees', permission: 'view' },
    { section: 'products', permission: 'view' },
  ]);

  // Программист
  const roleProgrammer = await prisma.role.upsert({
    where: { code: 'PROGRAMMER' },
    update: {},
    create: {
      name: 'Программист',
      code: 'PROGRAMMER',
      isSystem: false,
    },
  });
  await createPermissions(roleProgrammer.id, [
    { section: 'sites', permission: 'view' },
    { section: 'incomes', permission: 'view' },
    { section: 'expenses', permission: 'view' },
    { section: 'cost-items', permission: 'view' },
    { section: 'employees', permission: 'view' },
    { section: 'products', permission: 'view' },
  ]);

  // Дизайнер
  const roleDesigner = await prisma.role.upsert({
    where: { code: 'DESIGNER' },
    update: {},
    create: {
      name: 'Дизайнер',
      code: 'DESIGNER',
      isSystem: false,
    },
  });
  await createPermissions(roleDesigner.id, [
    { section: 'sites', permission: 'view' },
    { section: 'incomes', permission: 'view' },
    { section: 'expenses', permission: 'view' },
    { section: 'cost-items', permission: 'view' },
    { section: 'employees', permission: 'view' },
    { section: 'products', permission: 'view' },
  ]);

  // GEO
  const roleGEO = await prisma.role.upsert({
    where: { code: 'GEO' },
    update: {},
    create: {
      name: 'GEO',
      code: 'GEO',
      isSystem: false,
    },
  });
  await createPermissions(roleGEO.id, [
    { section: 'sites', permission: 'view' },
    { section: 'incomes', permission: 'view' },
    { section: 'expenses', permission: 'view' },
    { section: 'cost-items', permission: 'view' },
    { section: 'employees', permission: 'view' },
    { section: 'products', permission: 'view' },
  ]);

  // Продавец
  const roleSeller = await prisma.role.upsert({
    where: { code: 'SELLER' },
    update: {},
    create: {
      name: 'Продавец',
      code: 'SELLER',
      isSystem: false,
    },
  });
  await createPermissions(roleSeller.id, [
    { section: 'sites', permission: 'view' },
    { section: 'sites', permission: 'create' },
    { section: 'services', permission: 'view' },
    { section: 'services', permission: 'create' },
    { section: 'clients', permission: 'view' },
    { section: 'clients', permission: 'create' },
    { section: 'clients', permission: 'edit' },
    { section: 'incomes', permission: 'view' },
    { section: 'incomes', permission: 'create' },
    { section: 'expenses', permission: 'view' },
    { section: 'cost-items', permission: 'view' },
    { section: 'employees', permission: 'view' },
    { section: 'products', permission: 'view' },
    { section: 'reports', permission: 'view' },
  ]);

  // Маркетолог
  const roleMarketer = await prisma.role.upsert({
    where: { code: 'MARKETER' },
    update: {},
    create: {
      name: 'Маркетолог',
      code: 'MARKETER',
      isSystem: false,
    },
  });
  await createPermissions(roleMarketer.id, [
    { section: 'sites', permission: 'view' },
    { section: 'clients', permission: 'view' },
    { section: 'incomes', permission: 'view' },
    { section: 'expenses', permission: 'view' },
    { section: 'cost-items', permission: 'view' },
    { section: 'employees', permission: 'view' },
    { section: 'products', permission: 'view' },
    { section: 'reports', permission: 'view' },
  ]);

  // Сотрудник
  const roleEmployee = await prisma.role.upsert({
    where: { code: 'EMPLOYEE' },
    update: {},
    create: {
      name: 'Сотрудник',
      code: 'EMPLOYEE',
      isSystem: false,
    },
  });
  await createPermissions(roleEmployee.id, [
    { section: 'sites', permission: 'view' },
    { section: 'incomes', permission: 'view' },
    { section: 'expenses', permission: 'view' },
    { section: 'cost-items', permission: 'view' },
    { section: 'employees', permission: 'view' },
    { section: 'products', permission: 'view' },
  ]);

  // Подрядчик
  const roleContractor = await prisma.role.upsert({
    where: { code: 'CONTRACTOR' },
    update: {},
    create: {
      name: 'Подрядчик',
      code: 'CONTRACTOR',
      isSystem: false,
    },
  });
  await createPermissions(roleContractor.id, [
    { section: 'sites', permission: 'view' },
    { section: 'expenses', permission: 'view' },
    { section: 'cost-items', permission: 'view' },
    { section: 'products', permission: 'view' },
  ]);

  // Руководитель
  const roleHead = await prisma.role.upsert({
    where: { code: 'HEAD' },
    update: {},
    create: {
      name: 'Руководитель',
      code: 'HEAD',
      isSystem: false,
    },
  });
  await createPermissions(roleHead.id, [
    { section: 'sites', permission: 'view' },
    { section: 'sites', permission: 'create' },
    { section: 'sites', permission: 'edit' },
    { section: 'clients', permission: 'view' },
    { section: 'incomes', permission: 'view' },
    { section: 'incomes', permission: 'create' },
    { section: 'expenses', permission: 'view' },
    { section: 'expenses', permission: 'create' },
    { section: 'cost-items', permission: 'view' },
    { section: 'employees', permission: 'view' },
    { section: 'employees', permission: 'manage' },
    { section: 'products', permission: 'view' },
    { section: 'reports', permission: 'view' },
  ]);

  // Create users
  const users: Record<string, any> = {};

  // 1. Management
  users['myatov'] = await prisma.user.upsert({
    where: { id: 'myatov-id' },
    update: { roleId: roleOwner.id },
    create: {
      id: 'myatov-id',
      fullName: 'Мятов Михаил',
      roleId: roleOwner.id,
      passwordHash: await hashPassword('1407'),
      isActive: true,
    },
  });

  users['levinova'] = await prisma.user.upsert({
    where: { id: 'levinova-id' },
    update: { roleId: roleCEO.id },
    create: {
      id: 'levinova-id',
      fullName: 'Левинова Маргарита',
      roleId: roleCEO.id,
      passwordHash: await hashPassword('mng'),
      isActive: true,
    },
  });

  // 2. Account managers
  users['senior_account'] = await prisma.user.upsert({
    where: { id: 'senior-account-id' },
    update: { roleId: roleAccountManager.id },
    create: {
      id: 'senior-account-id',
      fullName: 'Старший Аккаунт',
      departmentId: departments.accounting.id,
      roleId: roleAccountManager.id,
      passwordHash: await hashPassword('Acount'),
      isActive: true,
    },
  });

  users['angelina'] = await prisma.user.upsert({
    where: { id: 'angelina-id' },
    update: { roleId: roleAccountManager.id },
    create: {
      id: 'angelina-id',
      fullName: 'Ангелина',
      departmentId: departments.accounting.id,
      roleId: roleAccountManager.id,
      passwordHash: await hashPassword('ang'),
      isActive: true,
    },
  });

  users['timur'] = await prisma.user.upsert({
    where: { id: 'timur-id' },
    update: { roleId: roleAccountManager.id },
    create: {
      id: 'timur-id',
      fullName: 'Тимур',
      departmentId: departments.accounting.id,
      roleId: roleAccountManager.id,
      passwordHash: await hashPassword('t-mur'),
      isActive: true,
    },
  });

  users['nikita'] = await prisma.user.upsert({
    where: { id: 'nikita-id' },
    update: { roleId: roleAccountManager.id },
    create: {
      id: 'nikita-id',
      fullName: 'Никита',
      departmentId: departments.accounting.id,
      roleId: roleAccountManager.id,
      passwordHash: await hashPassword('nkit'),
      isActive: false, // Removed per requirements
    },
  });

  users['sveta'] = await prisma.user.upsert({
    where: { id: 'sveta-id' },
    update: { roleId: roleAccountManager.id },
    create: {
      id: 'sveta-id',
      fullName: 'Света',
      departmentId: departments.accounting.id,
      roleId: roleAccountManager.id,
      passwordHash: await hashPassword('sva'),
      isActive: true,
    },
  });

  // 3. SEO department - assign SEO role
  users['levinov_ilya'] = await prisma.user.upsert({
    where: { id: 'levinov-ilya-id' },
    update: { roleId: roleSEO.id },
    create: {
      id: 'levinov-ilya-id',
      fullName: 'Левинов Илья',
      departmentId: departments.seo.id,
      roleId: roleSEO.id,
      passwordHash: await hashPassword('levi'),
      isActive: true,
    },
  });

  users['klimovskih'] = await prisma.user.upsert({
    where: { id: 'klimovskih-id' },
    update: { roleId: roleSEO.id },
    create: {
      id: 'klimovskih-id',
      fullName: 'Климовских Варвара',
      departmentId: departments.seo.id,
      roleId: roleSEO.id,
      passwordHash: await hashPassword('varv'),
      isActive: true,
    },
  });

  users['rodivilov'] = await prisma.user.upsert({
    where: { id: 'rodivilov-id' },
    update: { roleId: roleSEO.id },
    create: {
      id: 'rodivilov-id',
      fullName: 'Родивилов Арсений',
      departmentId: departments.seo.id,
      roleId: roleSEO.id,
      passwordHash: await hashPassword('arsrod'),
      isActive: true,
    },
  });

  users['zdanovich'] = await prisma.user.upsert({
    where: { id: 'zdanovich-id' },
    update: { roleId: roleSEO.id },
    create: {
      id: 'zdanovich-id',
      fullName: 'Зданович Даниил',
      departmentId: departments.seo.id,
      roleId: roleSEO.id,
      passwordHash: await hashPassword('zdand'),
      isActive: true,
    },
  });

  users['semenov'] = await prisma.user.upsert({
    where: { id: 'semenov-id' },
    update: { roleId: roleSEO.id },
    create: {
      id: 'semenov-id',
      fullName: 'Семёнов Данила',
      departmentId: departments.seo.id,
      roleId: roleSEO.id,
      passwordHash: await hashPassword('semd'),
      isActive: true,
    },
  });

  users['strokov'] = await prisma.user.upsert({
    where: { id: 'strokov-id' },
    update: { roleId: roleSEO.id },
    create: {
      id: 'strokov-id',
      fullName: 'Строкова Елизавета',
      departmentId: departments.seo.id,
      roleId: roleSEO.id,
      passwordHash: await hashPassword('stroke'),
      isActive: true,
    },
  });

  users['mamedov'] = await prisma.user.upsert({
    where: { id: 'mamedov-id' },
    update: { roleId: roleSEO.id },
    create: {
      id: 'mamedov-id',
      fullName: 'Мамедов Рахиб',
      departmentId: departments.seo.id,
      roleId: roleSEO.id,
      passwordHash: await hashPassword('mamr'),
      isActive: true,
    },
  });

  users['mamikonyan'] = await prisma.user.upsert({
    where: { id: 'mamikonyan-id' },
    update: { roleId: roleSEO.id },
    create: {
      id: 'mamikonyan-id',
      fullName: 'Мамиконян Абриам',
      departmentId: departments.seo.id,
      roleId: roleSEO.id,
      passwordHash: await hashPassword('mama'),
      isActive: true,
    },
  });

  users['archakova'] = await prisma.user.upsert({
    where: { id: 'archakova-id' },
    update: { roleId: roleSEO.id },
    create: {
      id: 'archakova-id',
      fullName: 'Арчакова Зарема',
      departmentId: departments.seo.id,
      roleId: roleSEO.id,
      passwordHash: await hashPassword('archz'),
      isActive: true,
    },
  });

  users['maslyak'] = await prisma.user.upsert({
    where: { id: 'maslyak-id' },
    update: { roleId: roleSEO.id },
    create: {
      id: 'maslyak-id',
      fullName: 'Масляк Игорь',
      departmentId: departments.seo.id,
      roleId: roleSEO.id,
      passwordHash: await hashPassword('masli'),
      isActive: true,
    },
  });

  users['nadezhda'] = await prisma.user.upsert({
    where: { id: 'nadezhda-id' },
    update: { roleId: roleSEO.id },
    create: {
      id: 'nadezhda-id',
      fullName: 'Надежда',
      departmentId: departments.seo.id,
      roleId: roleSEO.id,
      passwordHash: await hashPassword('nadgeo'),
      isActive: true,
    },
  });

  // 4. Marketing department - assign Marketer role
  users['rom'] = await prisma.user.upsert({
    where: { id: 'rom-id' },
    update: { roleId: roleMarketer.id },
    create: {
      id: 'rom-id',
      fullName: 'РОМ',
      departmentId: departments.marketing.id,
      roleId: roleMarketer.id,
      passwordHash: await hashPassword('romi'),
      isActive: true,
    },
  });

  users['morein'] = await prisma.user.upsert({
    where: { id: 'morein-id' },
    update: { roleId: roleMarketer.id },
    create: {
      id: 'morein-id',
      fullName: 'Морейн Егор',
      departmentId: departments.marketing.id,
      roleId: roleMarketer.id,
      passwordHash: await hashPassword('mor.e'),
      isActive: true,
    },
  });

  users['hmel'] = await prisma.user.upsert({
    where: { id: 'hmel-id' },
    update: { roleId: roleMarketer.id },
    create: {
      id: 'hmel-id',
      fullName: 'Хмелевская Арина',
      departmentId: departments.marketing.id,
      roleId: roleMarketer.id,
      passwordHash: await hashPassword('hmela'),
      isActive: true,
    },
  });

  // 5. Sales department - assign Seller role
  users['rop'] = await prisma.user.upsert({
    where: { id: 'rop-id' },
    update: { roleId: roleSeller.id },
    create: {
      id: 'rop-id',
      fullName: 'РОП',
      departmentId: departments.sales.id,
      roleId: roleSeller.id,
      passwordHash: await hashPassword('rops'),
      isActive: true,
    },
  });

  users['markin'] = await prisma.user.upsert({
    where: { id: 'markin-id' },
    update: { roleId: roleSeller.id },
    create: {
      id: 'markin-id',
      fullName: 'Маркин Алексей',
      departmentId: departments.sales.id,
      roleId: roleSeller.id,
      passwordHash: await hashPassword('marka'),
      isActive: true,
    },
  });

  users['chern'] = await prisma.user.upsert({
    where: { id: 'chern-id' },
    update: { roleId: roleSeller.id },
    create: {
      id: 'chern-id',
      fullName: 'Черняк Таир',
      departmentId: departments.sales.id,
      roleId: roleSeller.id,
      passwordHash: await hashPassword('chern'),
      isActive: true,
    },
  });

  users['vasch'] = await prisma.user.upsert({
    where: { id: 'vasch-id' },
    update: { roleId: roleSeller.id },
    create: {
      id: 'vasch-id',
      fullName: 'Ващенко Никита',
      departmentId: departments.sales.id,
      roleId: roleSeller.id,
      passwordHash: await hashPassword('vasch'),
      isActive: true,
    },
  });

  // 6. Accounting department
  users['roa'] = await prisma.user.upsert({
    where: { id: 'roa-id' },
    update: { roleId: roleAccountManager.id },
    create: {
      id: 'roa-id',
      fullName: 'РОА',
      departmentId: departments.accounting.id,
      roleId: roleAccountManager.id,
      passwordHash: await hashPassword('roa'),
      isActive: true,
    },
  });

  // 7. HR department - assign Marketer role (default)
  users['begunova'] = await prisma.user.upsert({
    where: { id: 'begunova-id' },
    update: { roleId: roleMarketer.id },
    create: {
      id: 'begunova-id',
      fullName: 'Бегунова Дарья',
      departmentId: departments.hr.id,
      roleId: roleMarketer.id,
      passwordHash: await hashPassword('hrd'),
      isActive: true,
    },
  });

  // 8. Other - assign Programmer role
  users['baranov'] = await prisma.user.upsert({
    where: { id: 'baranov-id' },
    update: { roleId: roleProgrammer.id },
    create: {
      id: 'baranov-id',
      fullName: 'Баранов Андрей',
      departmentId: departments.other.id,
      roleId: roleProgrammer.id,
      passwordHash: await hashPassword('bar.a'),
      isActive: true,
    },
  });

  // 9. PF department - assign GEO role
  users['mihpf'] = await prisma.user.upsert({
    where: { id: 'mihpf-id' },
    update: { roleId: roleGEO.id },
    create: {
      id: 'mihpf-id',
      fullName: 'Михаил',
      departmentId: departments.pf.id,
      roleId: roleGEO.id,
      passwordHash: await hashPassword('mihpf'),
      isActive: true,
    },
  });

  users['denpf'] = await prisma.user.upsert({
    where: { id: 'denpf-id' },
    update: { roleId: roleGEO.id },
    create: {
      id: 'denpf-id',
      fullName: 'Денис',
      departmentId: departments.pf.id,
      roleId: roleGEO.id,
      passwordHash: await hashPassword('denpf'),
      isActive: true,
    },
  });

  users['artpf'] = await prisma.user.upsert({
    where: { id: 'artpf-id' },
    update: { roleId: roleGEO.id },
    create: {
      id: 'artpf-id',
      fullName: 'Артем',
      departmentId: departments.pf.id,
      roleId: roleGEO.id,
      passwordHash: await hashPassword('artpf'),
      isActive: true,
    },
  });

  users['ilpf'] = await prisma.user.upsert({
    where: { id: 'ilpf-id' },
    update: { roleId: roleGEO.id },
    create: {
      id: 'ilpf-id',
      fullName: 'Илья',
      departmentId: departments.pf.id,
      roleId: roleGEO.id,
      passwordHash: await hashPassword('ilpf'),
      isActive: true,
    },
  });

  users['andpf'] = await prisma.user.upsert({
    where: { id: 'andpf-id' },
    update: { roleId: roleGEO.id },
    create: {
      id: 'andpf-id',
      fullName: 'Андрей',
      departmentId: departments.pf.id,
      roleId: roleGEO.id,
      passwordHash: await hashPassword('andpf'),
      isActive: true,
    },
  });

  // Remove inactive users
  await prisma.user.updateMany({
    where: {
      fullName: { in: ['Балкаров Тимур', 'Корчагин Никита', 'Юдина Светлана'] },
    },
    data: { isActive: false },
  });

  // Assign "Сотрудник" role to all users except OWNER and CEO
  await prisma.user.updateMany({
    where: {
      NOT: {
        id: { in: [users['myatov'].id, users['levinova'].id] },
      },
    },
    data: {
      roleId: roleEmployee.id,
    },
  });

  // Create products
  const products = [
    'Базовое SEO',
    'ПФЯ',
    'ПФГ',
    'Оптимизация странички',
    'GEO',
    'Яндекс Карты',
    'Контекст',
    'Разработка сайта',
    'SEO внедрение в сайт',
    'Разработка дизайна',
    'Наполнение сайта',
    'Контент',
    'Репутация',
    'Другое',
  ];

  for (let i = 0; i < products.length; i++) {
    await prisma.product.upsert({
      where: { name: products[i] },
      update: { sortOrder: i },
      create: { name: products[i], sortOrder: i },
    });
  }

  // Create legal entities
  const legalEntities = {
    ipVtb: await prisma.legalEntity.upsert({
      where: { name: 'ИП Мятов ВТБ' },
      update: {},
      create: {
        name: 'ИП Мятов ВТБ',
        type: LegalEntityType.IP,
        usnPercent: 6,
        vatPercent: 5,
        isActive: true,
      },
    }),
    ipSberbank: await prisma.legalEntity.upsert({
      where: { name: 'ИП Мятов Сбербанк' },
      update: {},
      create: {
        name: 'ИП Мятов Сбербанк',
        type: LegalEntityType.IP,
        usnPercent: 6,
        vatPercent: 5,
        isActive: true,
      },
    }),
    oooVelur: await prisma.legalEntity.upsert({
      where: { name: 'ООО «Велюр Груп»' },
      update: {},
      create: {
        name: 'ООО «Велюр Груп»',
        type: LegalEntityType.OOO,
        usnPercent: 0,
        vatPercent: 22,
        isActive: true,
      },
    }),
    card: await prisma.legalEntity.upsert({
      where: { name: 'Карта (Робокасса)' },
      update: {},
      create: {
        name: 'Карта (Робокасса)',
        type: LegalEntityType.CARD,
        usnPercent: 4.5,
        vatPercent: 0,
        isActive: true,
      },
    }),
    usdt: await prisma.legalEntity.upsert({
      where: { name: 'USDT' },
      update: {},
      create: {
        name: 'USDT',
        type: LegalEntityType.CRYPTO,
        usnPercent: 0,
        vatPercent: 0,
        isActive: true,
      },
    }),
    barter: await prisma.legalEntity.upsert({
      where: { name: 'Бартер' },
      update: {},
      create: {
        name: 'Бартер',
        type: LegalEntityType.BARTER,
        usnPercent: 0,
        vatPercent: 0,
        isActive: true,
      },
    }),
  };

  // Create system client "Без клиентов"
  await prisma.client.upsert({
    where: { id: 'no-client-id' },
    update: {},
    create: {
      id: 'no-client-id',
      name: 'Без клиентов',
      legalEntityId: legalEntities.barter.id,
      sellerEmployeeId: users['myatov'].id,
      isSystem: true,
    },
  });

  // Cost categories (top-level, Russian names)
  const categoryNames = [
    'Зарплата',
    'Проценты с продаж',
    'Офис',
    'HR',
    'Агентские выплаты',
    'Сервисы',
    'Ссылки',
    'Подрядчик',
    'Другие расходы',
  ];
  const costCategories: { id: string; name: string; sortOrder: number }[] = [];
  for (let i = 0; i < categoryNames.length; i++) {
    const cat = await prisma.costCategory.upsert({
      where: { name: categoryNames[i] },
      update: { sortOrder: i },
      create: { name: categoryNames[i], sortOrder: i },
    });
    costCategories.push({ id: cat.id, name: cat.name, sortOrder: cat.sortOrder });
  }

  // Financial model expense types
  const fixedType = await prisma.financialModelExpenseType.upsert({
    where: { name: 'Постоянные расходы' },
    update: {},
    create: { name: 'Постоянные расходы', sortOrder: 0 },
  });
  const variableType = await prisma.financialModelExpenseType.upsert({
    where: { name: 'Переменные расходы' },
    update: {},
    create: { name: 'Переменные расходы', sortOrder: 1 },
  });

  // Default cost items (статьи расходов): category + title, each with a financial model type
  const costItemsData = [
    { categoryName: 'Зарплата', title: 'Зарплата', sortOrder: 0 },
    { categoryName: 'Проценты с продаж', title: 'Проценты с продаж', sortOrder: 1 },
    { categoryName: 'Офис', title: 'Офис', sortOrder: 2 },
    { categoryName: 'HR', title: 'HR', sortOrder: 3 },
    { categoryName: 'Агентские выплаты', title: 'Агентские выплаты', sortOrder: 4 },
    { categoryName: 'Сервисы', title: 'Сервисы', sortOrder: 5 },
    { categoryName: 'Ссылки', title: 'Ссылки', sortOrder: 6 },
    { categoryName: 'Подрядчик', title: 'Подрядчик', sortOrder: 7 },
    { categoryName: 'Другие расходы', title: 'Другие расходы', sortOrder: 8 },
  ];

  for (const item of costItemsData) {
    const cat = costCategories.find((c) => c.name === item.categoryName);
    if (!cat) continue;
    const stableId = `seed-${item.categoryName}-${item.title}`.replace(/\s+/g, '-');
    await prisma.costItem.upsert({
      where: { id: stableId },
      update: { sortOrder: item.sortOrder, financialModelExpenseTypeId: fixedType.id },
      create: {
        id: stableId,
        costCategoryId: cat.id,
        title: item.title,
        sortOrder: item.sortOrder,
        financialModelExpenseTypeId: fixedType.id,
      },
    });
  }

  console.log('✅ Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
