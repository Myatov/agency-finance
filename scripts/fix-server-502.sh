#!/bin/bash
set -e

echo "=== Диагностика и исправление 502 Bad Gateway ==="
echo ""

cd /var/www/agency-finance || { echo "❌ Не удалось перейти в директорию проекта"; exit 1; }

echo "1️⃣ Проверка статуса PM2..."
pm2 status || echo "⚠️ PM2 не запущен"

echo ""
echo "2️⃣ Проверка Prisma Client..."
if [ ! -d "node_modules/@prisma/client" ]; then
    echo "⚠️ Prisma Client не найден, генерирую..."
    npm run db:generate
else
    echo "✓ Prisma Client найден"
fi

echo ""
echo "3️⃣ Генерация Prisma Client (на всякий случай)..."
npm run db:generate

echo ""
echo "4️⃣ Применение изменений схемы БД..."
npx prisma db push --skip-generate || echo "⚠️ DB push завершился с ошибкой, но продолжаем..."

echo ""
echo "5️⃣ Проверка логов PM2..."
pm2 logs agency-finance --lines 20 --nostream || echo "⚠️ Не удалось получить логи"

echo ""
echo "6️⃣ Перезапуск приложения..."
pm2 restart agency-finance --update-env || pm2 start npm --name agency-finance -- start

echo ""
echo "7️⃣ Ожидание запуска..."
sleep 5

echo ""
echo "8️⃣ Финальный статус..."
pm2 status

echo ""
echo "✅ Диагностика завершена. Проверьте статус приложения выше."
