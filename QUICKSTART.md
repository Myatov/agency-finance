# Быстрый старт

## Автоматическая настройка

Запустите скрипт настройки:

```bash
./setup.sh
```

Скрипт выполнит:
- ✅ Проверку Node.js и npm
- ✅ Установку зависимостей
- ✅ Создание .env файла (если не существует)
- ✅ Генерацию Prisma Client

## Ручная настройка

Если скрипт не работает, выполните команды вручную:

```bash
# 1. Установка зависимостей
npm install

# 2. Создайте .env файл (если не существует)
# Отредактируйте DATABASE_URL

# 3. Генерация Prisma Client
npm run db:generate

# 4. Применение схемы БД
npm run db:push

# 5. Заполнение данными
npm run db:seed

# 6. Запуск
npm run dev
```

## Настройка базы данных

### Вариант 1: Локальная PostgreSQL

1. Установите PostgreSQL
2. Создайте базу данных:
```bash
psql -U postgres
CREATE DATABASE agency_finance;
\q
```

3. В `.env` укажите:
```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/agency_finance?schema=public"
```

### Вариант 2: Облачная БД (Supabase, Railway, Neon)

1. Создайте проект в выбранном сервисе
2. Скопируйте connection string
3. Вставьте в `.env` как `DATABASE_URL`

## Первый вход

После запуска `npm run dev` откройте http://localhost:3000

Войдите с одним из паролей:
- `1407` - Мятов Михаил (OWNER)
- `mng` - Левинова Маргарита (CEO)
- `Acount` - Старший Аккаунт
- `finA` - Финансист

Полный список в `prisma/seed.ts`
