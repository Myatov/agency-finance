#!/bin/bash

echo "=========================================="
echo "🔍 ГЛУБОКАЯ ДИАГНОСТИКА 502 ОШИБКИ"
echo "=========================================="
echo ""

cd /var/www/agency-finance || exit 1

echo "1️⃣ Проверка PM2 статуса..."
pm2 status
echo ""

echo "2️⃣ Проверка процессов Node.js..."
ps aux | grep -E "node|next" | grep -v grep
echo ""

echo "3️⃣ Проверка порта 3000..."
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "✅ Порт 3000 занят:"
  lsof -i:3000
else
  echo "❌ Порт 3000 НЕ занят - приложение не запущено!"
fi
echo ""

echo "4️⃣ Проверка последних логов PM2 (50 строк)..."
pm2 logs agency-finance --lines 50 --nostream 2>&1 | tail -50
echo ""

echo "5️⃣ Проверка ошибок PM2 (30 строк)..."
pm2 logs agency-finance --err --lines 30 --nostream 2>&1 | tail -30
echo ""

echo "6️⃣ Проверка .next директории..."
if [ -d ".next" ]; then
  echo "✅ .next существует"
  ls -la .next | head -10
else
  echo "❌ .next НЕ существует!"
fi
echo ""

echo "7️⃣ Проверка .env файла..."
if [ -f ".env" ]; then
  echo "✅ .env существует"
  if grep -q "DATABASE_URL" .env; then
    echo "✅ DATABASE_URL найден"
  else
    echo "❌ DATABASE_URL НЕ найден!"
  fi
else
  echo "❌ .env НЕ существует!"
fi
echo ""

echo "8️⃣ Проверка Prisma Client..."
if [ -d "node_modules/@prisma/client" ]; then
  echo "✅ Prisma Client установлен"
else
  echo "❌ Prisma Client НЕ установлен!"
fi
echo ""

echo "9️⃣ Тест подключения к приложению..."
for i in {1..3}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>&1 || echo "000")
  echo "Попытка $i: HTTP $HTTP_CODE"
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✅ Приложение отвечает!"
    break
  fi
  sleep 1
done
echo ""

echo "🔟 Проверка Nginx конфигурации..."
if [ -f "/etc/nginx/sites-available/default" ]; then
  echo "Проверяю upstream в nginx config:"
  grep -A 5 "proxy_pass" /etc/nginx/sites-available/default | head -10 || echo "Не найдено proxy_pass"
fi
echo ""

echo "1️⃣1️⃣ Попытка запуска приложения..."
pm2 delete agency-finance 2>/dev/null || true
sleep 2

# Проверяем наличие сборки
if [ ! -d ".next" ]; then
  echo "⚠️ .next не существует, запускаю сборку..."
  npm run build
fi

echo "Запускаю через PM2..."
pm2 start npm --name agency-finance -- start
sleep 5

echo "Проверка статуса после запуска:"
pm2 status
echo ""

echo "Проверка логов после запуска (10 строк):"
pm2 logs agency-finance --lines 10 --nostream 2>&1 | tail -10
echo ""

echo "Финальная проверка доступности (3 попытки)..."
for i in {1..3}; do
  sleep 2
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>&1 || echo "000")
  echo "Попытка $i: HTTP $HTTP_CODE"
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✅ Приложение работает! (HTTP $HTTP_CODE)"
    exit 0
  fi
done

echo ""
echo "❌ Приложение все еще не отвечает"
echo ""
echo "📋 Рекомендации:"
echo "1. Проверьте логи: pm2 logs agency-finance --lines 100"
echo "2. Проверьте сборку: ls -la .next"
echo "3. Проверьте .env: cat .env"
echo "4. Попробуйте запустить вручную: cd /var/www/agency-finance && npm start"
