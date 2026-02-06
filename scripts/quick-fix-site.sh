#!/bin/bash

echo "=========================================="
echo "🔧 БЫСТРОЕ ВОССТАНОВЛЕНИЕ САЙТА"
echo "=========================================="
echo ""

cd /var/www/agency-finance || exit 1

echo "1️⃣ Остановка приложения..."
pm2 stop agency-finance 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2
echo ""

echo "2️⃣ Обновление кода..."
git pull origin main
echo ""

echo "3️⃣ Установка зависимостей..."
npm ci || npm install
echo ""

echo "4️⃣ Генерация Prisma Client..."
npm run db:generate
echo ""

echo "5️⃣ Применение изменений схемы БД..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 | head -30
echo ""

echo "6️⃣ Очистка старой сборки..."
rm -rf .next
echo ""

echo "7️⃣ Сборка приложения..."
npm run build
echo ""

echo "8️⃣ Запуск приложения..."
pm2 start npm --name agency-finance -- start || pm2 restart agency-finance --update-env
echo ""

echo "9️⃣ Ожидание запуска..."
sleep 10
echo ""

echo "🔟 Проверка статуса..."
pm2 status
echo ""

echo "📋 Последние логи (20 строк)..."
pm2 logs agency-finance --lines 20 --nostream 2>&1 | tail -20
echo ""

echo "🌐 Проверка доступности..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>&1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Приложение работает! (HTTP $HTTP_CODE)"
else
  echo "❌ Приложение не отвечает (HTTP $HTTP_CODE)"
  echo "Проверьте логи: pm2 logs agency-finance --lines 100"
fi
echo ""

echo "=========================================="
echo "✅ ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО"
echo "=========================================="
