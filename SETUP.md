# Инструкция по установке и запуску

## Предварительные требования

1. **Node.js** версии 18 или выше
   - Скачайте с https://nodejs.org/
   - Или установите через Homebrew: `brew install node`

2. **PostgreSQL** версии 14 или выше
   - Установите PostgreSQL локально
   - Или используйте облачную БД (например, Supabase, Railway, Neon)

## Шаги установки

### 1. Установите зависимости

```bash
npm install
```

### 2. Настройте переменные окружения

Скопируйте пример конфигурации и отредактируйте `.env`:

```bash
cp .env.example .env
```

Подробное описание переменных — в файле `.env.example`. Обязательно укажите `DATABASE_URL` и для работы PDF/QR — `NEXT_PUBLIC_APP_URL`. Каталог для PDF счетов задаётся через `INVOICE_PDF_DIR` (по умолчанию `invoices-pdf` в корне проекта).

Отредактируйте файл `.env` и укажите правильный `DATABASE_URL`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/agency_finance?schema=public"
```

**Примеры:**
- Локальная БД: `postgresql://postgres:postgres@localhost:5432/agency_finance?schema=public`
- Supabase: `postgresql://user:password@db.xxxxx.supabase.co:5432/postgres`
- Railway: `postgresql://user:password@containers-us-west-xxx.railway.app:5432/railway`

### 3. Создайте базу данных (если еще не создана)

```bash
# Подключитесь к PostgreSQL и создайте БД
psql -U postgres
CREATE DATABASE agency_finance;
\q
```

### 4. Примените схему базы данных

```bash
npm run db:push
```

Или создайте миграцию:

```bash
npm run db:migrate
```

### 5. Заполните базу начальными данными

```bash
npm run db:seed
```

Это создаст:
- Всех пользователей из ТЗ с паролями
- Отделы
- Продукты
- Системного клиента "Без клиентов"
- Справочник затрат

### 6. Запустите приложение

```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:3000

## Первый вход

Используйте один из паролей из seed данных:

- **Мятов Михаил** (OWNER) - пароль: `1407`
- **Левинова Маргарита** (CEO) - пароль: `mng`
- **Старший Аккаунт** (HEAD_ACCOUNTING) - пароль: `Acount`
- **Финансист** (FINANCE) - пароль: `finA`

Полный список паролей см. в `prisma/seed.ts`

## Возможные проблемы

### Ошибка подключения к БД

Проверьте:
1. PostgreSQL запущен
2. `DATABASE_URL` в `.env` правильный
3. База данных `agency_finance` создана

### Ошибка при seed

Убедитесь, что:
1. База данных пустая или можно перезаписать данные
2. Все миграции применены (`npm run db:push`)

### Порт 3000 занят

Измените порт в `package.json` или используйте:
```bash
PORT=3001 npm run dev
```

## Команды для разработки

```bash
npm run dev          # Запуск dev сервера
npm run build        # Сборка для production
npm run start        # Запуск production сервера
npm run db:generate  # Генерация Prisma Client
npm run db:push      # Применение изменений схемы
npm run db:migrate   # Создание миграции
npm run db:seed      # Заполнение базы данными
```
