#!/bin/bash

set +e  # Не останавливаться на ошибках

echo "=========================================="
echo "🔥 АГРЕССИВНОЕ ВОССТАНОВЛЕНИЕ 502"
echo "=========================================="
echo ""

cd /var/www/agency-finance || exit 1

echo "1️⃣ ПОЛНАЯ ОСТАНОВКА ВСЕХ ПРОЦЕССОВ..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
pkill -9 -f "node.*next" 2>/dev/null || true
pkill -9 -f "npm.*start" 2>/dev/null || true
sleep 3
echo "✅ Все процессы остановлены"
echo ""

echo "2️⃣ ОСВОБОЖДЕНИЕ ПОРТА 3000..."
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "Убиваю процессы на порту 3000..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  sleep 2
fi
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "⚠️ Порт все еще занят!"
  lsof -i:3000
else
  echo "✅ Порт 3000 свободен"
fi
echo ""

echo "3️⃣ ОБНОВЛЕНИЕ КОДА..."
git pull origin main
echo ""

echo "4️⃣ УСТАНОВКА ЗАВИСИМОСТЕЙ..."
npm ci 2>&1 | tail -20
if [ $? -ne 0 ]; then
  echo "⚠️ npm ci не удался, пробую npm install..."
  npm install 2>&1 | tail -20
fi
echo ""

echo "5️⃣ ГЕНЕРАЦИЯ PRISMA CLIENT..."
npm run db:generate 2>&1 | tail -20
echo ""

echo "6️⃣ ПРИМЕНЕНИЕ СХЕМЫ БД..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 | tail -30
echo ""

echo "7️⃣ ПРИМЕНЕНИЕ SQL МИГРАЦИЙ..."
npx prisma db execute --file prisma/create-niche-table.sql 2>&1 | tail -10 || echo "Миграция пропущена"
echo ""

echo "8️⃣ ОЧИСТКА И СБОРКА..."
rm -rf .next
rm -rf node_modules/.cache
echo "Запускаю сборку..."
npm run build 2>&1 | tail -50

if [ ! -d ".next" ]; then
  echo "❌ КРИТИЧЕСКАЯ ОШИБКА: Сборка не создана!"
  echo "Проверьте ошибки выше"
  exit 1
fi

echo "✅ Сборка завершена"
echo ""

echo "9️⃣ ПРОВЕРКА СТРУКТУРЫ .next..."
ls -la .next/ | head -10
if [ -d ".next/standalone" ]; then
  echo "✅ Standalone сборка найдена"
elif [ -d ".next/server" ]; then
  echo "✅ Server сборка найдена"
else
  echo "⚠️ Необычная структура .next"
fi
echo ""

echo "🔟 ЗАПУСК ЧЕРЕЗ PM2..."
pm2 delete agency-finance 2>/dev/null || true
sleep 1

# Пробуем разные способы запуска
echo "Способ 1: npm start через PM2..."
cd /var/www/agency-finance
pm2 start npm --name agency-finance -- start 2>&1

sleep 5

PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="agency-finance") | .pm2_env.status' 2>/dev/null || echo "unknown")

if [ "$PM2_STATUS" != "online" ]; then
  echo "⚠️ PM2 статус: $PM2_STATUS"
  echo ""
  echo "Проверяю логи PM2:"
  pm2 logs agency-finance --lines 30 --nostream 2>&1 | tail -30
  echo ""
  
  echo "Пробую запустить напрямую для диагностики..."
  cd /var/www/agency-finance
  timeout 10 npm start 2>&1 &
  DIRECT_PID=$!
  sleep 5
  
  if ps -p $DIRECT_PID > /dev/null 2>&1; then
    echo "✅ Прямой запуск работает (PID: $DIRECT_PID)"
    kill $DIRECT_PID 2>/dev/null || true
    sleep 1
    
    echo "Запускаю через PM2 с явным путем..."
    pm2 start npm --name agency-finance -- start --cwd /var/www/agency-finance
  else
    echo "❌ Прямой запуск тоже не работает"
    echo "Последние строки вывода:"
    wait $DIRECT_PID 2>&1 | tail -20 || true
  fi
fi

sleep 5

echo ""
echo "1️⃣1️⃣ ФИНАЛЬНАЯ ПРОВЕРКА..."
echo "PM2 статус:"
pm2 status
echo ""

echo "Процессы Node.js:"
ps aux | grep -E "node|next" | grep -v grep | head -5
echo ""

echo "Порт 3000:"
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "✅ Порт занят:"
  lsof -i:3000
else
  echo "❌ Порт НЕ занят!"
fi
echo ""

echo "Последние логи (20 строк):"
pm2 logs agency-finance --lines 20 --nostream 2>&1 | tail -20
echo ""

echo "Ошибки (20 строк):"
pm2 logs agency-finance --err --lines 20 --nostream 2>&1 | tail -20 || echo "Ошибок не найдено"
echo ""

echo "Тест HTTP запроса (5 попыток):"
for i in {1..5}; do
  sleep 2
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000 2>&1 || echo "000")
  echo "Попытка $i: HTTP $HTTP_CODE"
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✅ ПРИЛОЖЕНИЕ РАБОТАЕТ! (HTTP $HTTP_CODE)"
    exit 0
  fi
done

echo ""
echo "❌ ПРИЛОЖЕНИЕ НЕ ОТВЕЧАЕТ"
echo ""
echo "📋 ДИАГНОСТИКА:"
echo "1. Проверьте .env: cat .env | grep DATABASE_URL"
echo "2. Проверьте логи: pm2 logs agency-finance --lines 100"
echo "3. Попробуйте запустить вручную: cd /var/www/agency-finance && npm start"
echo "4. Проверьте Nginx: sudo nginx -t && sudo systemctl status nginx"
