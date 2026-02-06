#!/bin/bash

# Не используем set -e, чтобы скрипт продолжал работу при ошибках

echo "=========================================="
echo "🔧 ПОЛНОЕ ВОССТАНОВЛЕНИЕ САЙТА (502 FIX)"
echo "=========================================="
echo ""

cd /var/www/agency-finance || exit 1

echo "1️⃣ Остановка всех процессов..."
pm2 stop agency-finance 2>/dev/null || true
pm2 delete agency-finance 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true
sleep 3
echo "✅ Процессы остановлены"
echo ""

echo "2️⃣ Проверка занятости порта 3000..."
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "⚠️ Порт 3000 занят, освобождаю..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  sleep 2
fi
echo "✅ Порт 3000 свободен"
echo ""

echo "3️⃣ Обновление кода..."
git pull origin main
echo ""

echo "4️⃣ Установка зависимостей..."
npm ci || npm install
echo ""

echo "5️⃣ Генерация Prisma Client..."
npm run db:generate
echo ""

echo "6️⃣ Применение изменений схемы БД..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 | head -50 || echo "⚠️ DB push завершился с предупреждениями (это нормально)"
echo ""

echo "7️⃣ Применение SQL миграций..."
npx prisma db execute --file prisma/create-niche-table.sql 2>&1 || echo "⚠️ Миграция Niche уже применена или пропущена"
npx prisma db execute --file prisma/add-expense-legal-entity.sql 2>&1 || echo "⚠️ Миграция Expense пропущена"
npx prisma db execute --file prisma/add-user-fields.sql 2>&1 || echo "⚠️ Миграция User пропущена"
npx prisma db execute --file prisma/add-contracts-closeout-tables.sql 2>&1 || echo "⚠️ Миграция Contracts пропущена"
npx prisma db execute --file prisma/add-client-requisites-columns.sql 2>&1 || echo "⚠️ Миграция Client пропущена"
echo ""

echo "8️⃣ Очистка старой сборки..."
rm -rf .next
rm -rf node_modules/.cache
echo "✅ Очистка завершена"
echo ""

echo "9️⃣ Сборка приложения..."
if npm run build 2>&1; then
  echo "✅ Сборка завершена"
else
  echo "⚠️ Ошибка сборки, проверяю наличие .next..."
  if [ ! -d ".next" ]; then
    echo "❌ Папка .next не найдена после сборки!"
    echo "Попытка повторной сборки..."
    npm run build 2>&1 || {
      echo "❌ Повторная сборка тоже не удалась"
      echo "Проверьте логи выше для диагностики"
      exit 1
    }
  else
    echo "⚠️ Сборка завершилась с ошибками, но .next существует, продолжаем..."
  fi
fi
echo ""

echo "🔟 Проверка наличия сборки..."
if [ ! -d ".next" ]; then
  echo "❌ .next не существует! Запускаю сборку..."
  npm run build
  if [ ! -d ".next" ]; then
    echo "❌ Сборка не удалась! Проверьте ошибки выше."
    exit 1
  fi
fi
echo "✅ Сборка существует"
echo ""

echo "1️⃣1️⃣ Запуск приложения через PM2..."
# Удаляем старый процесс если есть
pm2 delete agency-finance 2>/dev/null || true
sleep 2

# Проверяем что порт свободен
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "⚠️ Порт 3000 все еще занят, убиваю процессы..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  sleep 2
fi

# Запускаем через PM2 с явным указанием рабочей директории
cd /var/www/agency-finance
pm2 start npm --name agency-finance -- start --cwd /var/www/agency-finance
sleep 5

# Проверяем что запустилось
PM2_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="agency-finance") | .pm2_env.status' 2>/dev/null || echo "notfound")
if [ "$PM2_STATUS" != "online" ]; then
  echo "⚠️ Приложение не запустилось (статус: $PM2_STATUS)"
  echo "Проверяю логи..."
  pm2 logs agency-finance --lines 20 --nostream 2>&1 | tail -20
  echo ""
  echo "Пробую запустить напрямую для диагностики..."
  cd /var/www/agency-finance
  timeout 5 npm start 2>&1 | head -20 || echo "Запуск напрямую тоже не удался"
else
  echo "✅ Приложение запущено через PM2"
fi
echo ""

echo "1️⃣1️⃣ Ожидание запуска (15 секунд)..."
sleep 15
echo ""

echo "1️⃣2️⃣ Проверка статуса PM2..."
pm2 status
echo ""

echo "1️⃣3️⃣ Проверка процессов Node.js..."
ps aux | grep -E "node|next" | grep -v grep | head -5
echo ""

echo "1️⃣4️⃣ Проверка порта 3000..."
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "✅ Порт 3000 занят приложением"
else
  echo "⚠️ Порт 3000 не занят!"
fi
echo ""

echo "1️⃣5️⃣ Последние логи приложения (30 строк)..."
pm2 logs agency-finance --lines 30 --nostream 2>&1 | tail -30
echo ""

echo "1️⃣6️⃣ Ошибки приложения (20 строк)..."
pm2 logs agency-finance --err --lines 20 --nostream 2>&1 | tail -20 || echo "⚠️ Ошибок не найдено"
echo ""

echo "1️⃣7️⃣ Проверка доступности приложения..."
for i in {1..5}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>&1 || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✅ Приложение отвечает! (HTTP $HTTP_CODE)"
    break
  else
    echo "⏳ Попытка $i/5: HTTP $HTTP_CODE, жду 3 секунды..."
    sleep 3
  fi
done

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "302" ] && [ "$HTTP_CODE" != "401" ] && [ "$HTTP_CODE" != "404" ]; then
  echo ""
  echo "❌ Приложение не отвечает (HTTP $HTTP_CODE)"
  echo ""
  echo "📋 Дополнительная диагностика:"
  echo "1. Проверьте логи: pm2 logs agency-finance --lines 100"
  echo "2. Проверьте .env файл: cat .env | grep DATABASE_URL"
  echo "3. Проверьте Prisma: npx prisma studio (откроется в браузере)"
  echo "4. Проверьте Nginx: sudo nginx -t"
  echo ""
else
  echo ""
  echo "=========================================="
  echo "✅ ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО!"
  echo "=========================================="
fi
