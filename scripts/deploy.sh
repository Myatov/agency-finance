#!/bin/bash
set -e

cd /var/www/agency-finance

echo "=== Deploy started at $(date) ==="

# Получить последние изменения
git pull origin main

# Обновить зависимости (включая dev, так как нужны для сборки Next.js)
npm ci

# Обновить Prisma Client
npm run db:generate

# Очистить старую сборку и пересобрать проект
rm -rf .next
npm run build

# Применить миграции БД (если используешь миграции)
# npx prisma migrate deploy

# Перезапустить приложение
pm2 restart agency-finance --update-env

echo "=== Deploy completed at $(date) ==="
