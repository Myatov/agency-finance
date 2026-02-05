/**
 * Скрипт для проверки и перегенерации Prisma Client при необходимости.
 * Можно запускать перед стартом приложения или в CI/CD.
 * 
 * Использование:
 *   npx tsx scripts/ensure-prisma-client.ts
 *   или добавить в package.json: "prestart": "tsx scripts/ensure-prisma-client.ts"
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function checkPrismaClient() {
  const clientPath = path.join(process.cwd(), 'node_modules/@prisma/client');
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ prisma/schema.prisma not found');
    process.exit(1);
  }
  
  // Проверяем, существует ли Prisma Client
  if (!fs.existsSync(clientPath)) {
    console.log('⚠️  Prisma Client not found, generating...');
    return false;
  }
  
  // Проверяем время модификации схемы и клиента
  const schemaTime = fs.statSync(schemaPath).mtime;
  const clientTime = fs.statSync(path.join(clientPath, 'index.d.ts')).mtime;
  
  if (schemaTime > clientTime) {
    console.log('⚠️  Prisma schema is newer than client, regenerating...');
    return false;
  }
  
  // Проверяем наличие новых моделей в сгенерированном клиенте
  try {
    const indexContent = fs.readFileSync(path.join(clientPath, 'index.d.ts'), 'utf-8');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    
    // Проверяем наличие CostCategory и FinancialModelExpenseType
    const hasCostCategoryInSchema = schemaContent.includes('model CostCategory');
    const hasCostCategoryInClient = indexContent.includes('costCategory') || indexContent.includes('CostCategory');
    
    const hasFinancialModelInSchema = schemaContent.includes('model FinancialModelExpenseType');
    const hasFinancialModelInClient = indexContent.includes('financialModelExpenseType') || indexContent.includes('FinancialModelExpenseType');
    
    if (hasCostCategoryInSchema && !hasCostCategoryInClient) {
      console.log('⚠️  CostCategory model missing in Prisma Client, regenerating...');
      return false;
    }
    
    if (hasFinancialModelInSchema && !hasFinancialModelInClient) {
      console.log('⚠️  FinancialModelExpenseType model missing in Prisma Client, regenerating...');
      return false;
    }
  } catch (e) {
    console.log('⚠️  Could not verify Prisma Client, regenerating...');
    return false;
  }
  
  return true;
}

function generatePrismaClient() {
  try {
    console.log('🔄 Generating Prisma Client...');
    execSync('npm run db:generate', { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ Prisma Client generated successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to generate Prisma Client:', error);
    return false;
  }
}

function main() {
  console.log('🔍 Checking Prisma Client...');
  
  if (checkPrismaClient()) {
    console.log('✅ Prisma Client is up to date');
    process.exit(0);
  }
  
  if (generatePrismaClient()) {
    console.log('✅ Prisma Client ready');
    process.exit(0);
  } else {
    console.error('❌ Failed to ensure Prisma Client');
    process.exit(1);
  }
}

main();
