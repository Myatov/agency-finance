import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Функция для проверки и перегенерации Prisma Client при необходимости
function ensurePrismaClient() {
  if (process.env.NODE_ENV === 'production') {
    try {
      // Проверяем наличие моделей в сгенерированном клиенте
      const clientPath = path.join(process.cwd(), 'node_modules/@prisma/client');
      const indexPath = path.join(clientPath, 'index.d.ts');
      
      if (fs.existsSync(indexPath)) {
        const indexContent = fs.readFileSync(indexPath, 'utf-8');
        const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
        
        if (fs.existsSync(schemaPath)) {
          const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
          const hasCostCategoryInSchema = schemaContent.includes('model CostCategory');
          const hasCostCategoryInClient = indexContent.includes('costCategory') || indexContent.includes('CostCategory');
          
          // Если модель есть в схеме, но отсутствует в клиенте - перегенерируем
          if (hasCostCategoryInSchema && !hasCostCategoryInClient) {
            console.warn('⚠️  Prisma Client missing new models, regenerating...');
            try {
              execSync('npm run db:generate', { stdio: 'inherit', cwd: process.cwd() });
              console.log('✅ Prisma Client regenerated successfully');
            } catch (error) {
              console.error('❌ Failed to regenerate Prisma Client:', error);
            }
          }
        }
      }
    } catch (error) {
      // Игнорируем ошибки проверки, просто используем существующий клиент
      console.warn('Could not verify Prisma Client:', error);
    }
  }
}

// Выполняем проверку при инициализации модуля
ensurePrismaClient();

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
