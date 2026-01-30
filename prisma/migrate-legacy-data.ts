import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Миграция старых данных:
 * 1. Переименовать Project → Site (через SQL, если нужно)
 * 2. Создать системный продукт "Legacy / Без услуги"
 * 3. Создать системную услугу "Legacy / Без услуги" для каждого сайта
 * 4. Привязать старые доходы к этой услуге
 * 
 * ВАЖНО: Этот скрипт должен быть запущен ПОСЛЕ применения миграций Prisma
 * Но перед применением миграций нужно сначала обновить существующие данные
 */
async function migrateLegacyData() {
  console.log('🔄 Starting legacy data migration...');

  try {
    // Проверяем, есть ли таблица Project (старое название)
    // Если есть, нужно сначала переименовать её в Site через SQL
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Project'
      );
    `;

    if (tableExists[0]?.exists) {
      console.log('📋 Renaming Project table to Site...');
      await prisma.$executeRawUnsafe('ALTER TABLE "Project" RENAME TO "Site";');
      console.log('✅ Table renamed');
    }

    // 1. Найти или создать системный продукт для Legacy услуг
    const legacyProduct = await prisma.product.upsert({
      where: { name: 'Legacy / Без услуги' },
      update: {},
      create: {
        name: 'Legacy / Без услуги',
        sortOrder: 9999, // В конец списка
      },
    });

    console.log('✅ Legacy product created/found:', legacyProduct.id);

    // 2. Получить все существующие Sites (бывшие Projects)
    const sites = await prisma.site.findMany({
      include: {
        client: true,
      },
    });

    console.log(`📊 Found ${sites.length} sites to process`);

    // 3. Для каждого сайта создать Legacy услугу, если её еще нет
    let legacyServicesCreated = 0;
    for (const site of sites) {
      // Проверяем, есть ли уже Legacy услуга для этого сайта
      const existingLegacyService = await prisma.service.findFirst({
        where: {
          siteId: site.id,
          productId: legacyProduct.id,
        },
      });

      if (!existingLegacyService) {
        await prisma.service.create({
          data: {
            siteId: site.id,
            productId: legacyProduct.id,
            status: 'FINISHED',
            startDate: site.createdAt,
            endDate: new Date(),
            billingType: 'ONE_TIME',
            autoRenew: false,
            comment: 'Системная услуга для миграции старых данных',
          },
        });
        legacyServicesCreated++;
      }
    }

    console.log(`✅ Created ${legacyServicesCreated} legacy services`);

    // 4. Найти все доходы без serviceId и привязать их к Legacy услуге
    // ВАЖНО: Это нужно делать после того, как схема обновлена и serviceId стал обязательным
    // Но перед применением миграций нужно сначала обновить существующие данные
    
    // Проверяем, есть ли таблица Income со старыми полями
    const incomeTableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Income'
      );
    `;

    if (incomeTableExists[0]?.exists) {
      // Проверяем, есть ли поле productId (старое поле)
      const hasProductId = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'Income'
          AND column_name = 'productId'
        );
      `;

      if (hasProductId[0]?.exists) {
        console.log('📋 Migrating old incomes to services...');
        
        // Получаем все Legacy услуги
        const legacyServices = await prisma.service.findMany({
          where: {
            productId: legacyProduct.id,
          },
          include: {
            site: true,
          },
        });

        // Создаем маппинг siteId -> legacyServiceId
        const siteToLegacyService = new Map(
          legacyServices.map(s => [s.siteId, s.id])
        );

        // Получаем все доходы со старыми полями
        const oldIncomes = await prisma.$queryRaw<Array<{
          id: string;
          projectId: string | null;
        }>>`
          SELECT id, "projectId" FROM "Income" WHERE "serviceId" IS NULL;
        `;

        console.log(`📊 Found ${oldIncomes.length} incomes to migrate`);

        // Обновляем каждый доход
        for (const income of oldIncomes) {
          if (income.projectId) {
            const legacyServiceId = siteToLegacyService.get(income.projectId);
            if (legacyServiceId) {
              await prisma.$executeRawUnsafe(`
                UPDATE "Income" 
                SET "serviceId" = $1 
                WHERE id = $2;
              `, legacyServiceId, income.id);
            }
          }
        }

        console.log(`✅ Migrated ${oldIncomes.length} incomes to legacy services`);
      }
    }

    console.log('✅ Legacy data migration completed!');
    console.log(`📝 Created ${legacyServicesCreated} legacy services`);
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateLegacyData()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
