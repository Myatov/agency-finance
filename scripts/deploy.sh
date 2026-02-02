#!/bin/bash
set -e

cd /var/www/agency-finance

echo "=== Deploy started at $(date) ==="

# Получить последние изменения
git pull origin main

# Обновить зависимости (если нужно)
npm ci --production

# Обновить Prisma Client
npm run db:generate

# Применить миграции БД (если используешь миграции)
# npx prisma migrate deploy

# Перезапустить приложение
pm2 restart agency-finance

echo "=== Deploy completed at $(date) ==="
