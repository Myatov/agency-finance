#!/bin/bash

echo "🚀 Настройка проекта Финансы агентства"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    echo "Установите Node.js с https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js установлен: $(node --version)"
echo ""

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен!"
    exit 1
fi

echo "✅ npm установлен: $(npm --version)"
echo ""

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при установке зависимостей"
    exit 1
fi

echo "✅ Зависимости установлены"
echo ""

# Проверка .env файла
if [ ! -f .env ]; then
    echo "📝 Создание .env файла..."
    cat > .env << EOF
DATABASE_URL="postgresql://user:password@localhost:5432/agency_finance?schema=public"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
EOF
    echo "✅ .env файл создан"
    echo "⚠️  ВАЖНО: Отредактируйте .env и укажите правильный DATABASE_URL!"
    echo ""
else
    echo "✅ .env файл уже существует"
    echo ""
fi

# Генерация Prisma Client
echo "🔧 Генерация Prisma Client..."
npm run db:generate

if [ $? -ne 0 ]; then
    echo "⚠️  Предупреждение: Не удалось сгенерировать Prisma Client"
    echo "Возможно, нужно настроить DATABASE_URL в .env"
fi

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "Следующие шаги:"
echo "1. Отредактируйте .env и укажите правильный DATABASE_URL"
echo "2. Создайте базу данных PostgreSQL (если еще не создана):"
echo "   psql -U postgres -c 'CREATE DATABASE agency_finance;'"
echo "3. Примените схему: npm run db:push"
echo "4. Заполните данные: npm run db:seed"
echo "5. Запустите: npm run dev"
echo ""
