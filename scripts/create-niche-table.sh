#!/bin/bash

echo "=========================================="
echo "🔧 СОЗДАНИЕ ТАБЛИЦЫ NICHE"
echo "=========================================="
echo ""

cd /var/www/agency-finance || exit 1

echo "1️⃣ Применение SQL скрипта для создания таблицы Niche..."
npx prisma db execute --file prisma/create-niche-table.sql

if [ $? -eq 0 ]; then
  echo "✅ Таблица Niche создана успешно!"
else
  echo "❌ Ошибка при создании таблицы"
  exit 1
fi

echo ""
echo "2️⃣ Проверка существования таблицы..."
npx prisma db execute --stdin <<EOF
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'Niche';
EOF

echo ""
echo "3️⃣ Проверка структуры таблицы..."
npx prisma db execute --stdin <<EOF
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Niche' 
ORDER BY ordinal_position;
EOF

echo ""
echo "=========================================="
echo "✅ ГОТОВО"
echo "=========================================="
