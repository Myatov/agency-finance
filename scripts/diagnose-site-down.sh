#!/bin/bash

echo "=========================================="
echo "🔍 ДИАГНОСТИКА ПРОБЛЕМ С САЙТОМ"
echo "=========================================="
echo ""

cd /var/www/agency-finance || exit 1

echo "1️⃣ Проверка PM2 статуса..."
pm2 status
echo ""

echo "2️⃣ Проверка процессов Node.js..."
ps aux | grep node | grep -v grep
echo ""

echo "3️⃣ Проверка порта 3000..."
netstat -tuln | grep 3000 || ss -tuln | grep 3000
echo ""

echo "4️⃣ Последние логи приложения (50 строк)..."
pm2 logs agency-finance --lines 50 --nostream 2>&1 | tail -50
echo ""

echo "5️⃣ Ошибки приложения (последние 30)..."
pm2 logs agency-finance --err --lines 30 --nostream 2>&1 | tail -30
echo ""

echo "6️⃣ Проверка Prisma Client..."
if [ -d "node_modules/@prisma/client" ]; then
  echo "✅ Prisma Client установлен"
  if grep -q "parentId" node_modules/@prisma/client/index.d.ts 2>/dev/null; then
    echo "✅ Поле parentId найдено в Prisma Client"
  else
    echo "⚠️ Поле parentId НЕ найдено в Prisma Client"
  fi
else
  echo "❌ Prisma Client не найден"
fi
echo ""

echo "7️⃣ Проверка схемы Prisma..."
if grep -q "parentId" prisma/schema.prisma 2>/dev/null; then
  echo "✅ Поле parentId найдено в схеме"
else
  echo "❌ Поле parentId НЕ найдено в схеме"
fi
echo ""

echo "8️⃣ Проверка структуры таблицы Niche в БД..."
npx prisma db execute --stdin <<EOF 2>&1 | head -20
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Niche' 
ORDER BY ordinal_position;
EOF
echo ""

echo "9️⃣ Проверка доступности приложения..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>&1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Приложение отвечает (HTTP $HTTP_CODE)"
else
  echo "❌ Приложение не отвечает (HTTP $HTTP_CODE)"
fi
echo ""

echo "🔟 Проверка .env файла..."
if [ -f ".env" ]; then
  echo "✅ .env файл существует"
  if grep -q "DATABASE_URL" .env; then
    echo "✅ DATABASE_URL найден"
  else
    echo "❌ DATABASE_URL не найден"
  fi
else
  echo "❌ .env файл не найден"
fi
echo ""

echo "=========================================="
echo "✅ ДИАГНОСТИКА ЗАВЕРШЕНА"
echo "=========================================="
