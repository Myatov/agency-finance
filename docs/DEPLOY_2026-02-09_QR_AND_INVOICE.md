# Инструкция: обновление на сервере (QR, дата старта клиента, публичная ссылка на счёт)

**Коммит:** «Ближайшие оплаты→Ближайшие; дата периода ДД.ММ.ГГГГ в закрывающих; поле Дата старта у клиента; QR личного кабинета; публичная ссылка и QR для счёта (publicToken)».

Что меняется:
- В отчёте оплат вкладка переименована в «Ближайшие».
- Закрывающие документы: период выводится в формате ДД.ММ.ГГГГ.
- У клиента добавлено поле «Дата старта работы с клиентом».
- В модалке «Личный кабинет» — QR-код для входа в ЛК.
- У каждого счёта — публичная ссылка и QR для скачивания PDF без входа.

---

## Что делать по шагам по SSH

### 1. Подключиться к серверу

На своём компьютере в терминале:

```bash
ssh ПОЛЬЗОВАТЕЛЬ@IP_ИЛИ_ДОМЕН_СЕРВЕРА
```

Примеры: `ssh root@62.217.176.108` или `ssh deploy@a.seo-performance.ru`

---

### 2. Перейти в каталог проекта

```bash
cd /var/www/agency-finance
```

Проверить: `pwd` — должно быть `/var/www/agency-finance`.

---

### 3. Подтянуть код из Git

```bash
git fetch origin
git pull origin main
```

Должны подтянуться изменения (в т.ч. `prisma/add-client-work-start-date.sql`, `prisma/add-invoice-public-token.sql`, `app/api/qr/`, `app/api/invoices/public/` и др.).

---

### 4. Применить миграции базы данных (обязательно)

Добавляются колонки: `Client.workStartDate`, `Invoice.publicToken`. Без этого шага приложение может падать.

**Вариант А — через DATABASE_URL из `.env`:**

```bash
cd /var/www/agency-finance
export $(grep -v '^#' .env | xargs)
export DATABASE_URL_PSQL="${DATABASE_URL%%\?*}"
psql "$DATABASE_URL_PSQL" -f prisma/add-client-work-start-date.sql
psql "$DATABASE_URL_PSQL" -f prisma/add-invoice-public-token.sql
```

**Вариант Б — если появляется ошибка `role "root" does not exist`:**

Возьмите из `.env` логин, пароль и имя базы (из строки `DATABASE_URL="postgresql://ЛОГИН:ПАРОЛЬ@localhost:5432/ИМЯ_БД?..."`). Затем:

```bash
export PGPASSWORD='ПАРОЛЬ'
psql -h localhost -U ЛОГИН -d ИМЯ_БД -f /var/www/agency-finance/prisma/add-client-work-start-date.sql
psql -h localhost -U ЛОГИН -d ИМЯ_БД -f /var/www/agency-finance/prisma/add-invoice-public-token.sql
unset PGPASSWORD
```

Пример: если в `.env` указано `postgresql://agency_finance:SecretPass@localhost:5432/agency_finance`:

```bash
export PGPASSWORD='SecretPass'
psql -h localhost -U agency_finance -d agency_finance -f /var/www/agency-finance/prisma/add-client-work-start-date.sql
psql -h localhost -U agency_finance -d agency_finance -f /var/www/agency-finance/prisma/add-invoice-public-token.sql
unset PGPASSWORD
```

Ожидаемый вывод по каждой команде: сообщение об успешном выполнении (или что объект уже существует — тогда всё ок).

---

### 5. Установить зависимости и перегенерировать Prisma

```bash
npm ci --include=dev
npx prisma generate
```

Если `npm ci --include=dev` не поддерживается: `NODE_ENV=development npm ci`, затем `npx prisma generate`.

---

### 6. Собрать приложение

```bash
rm -rf .next
npm run build
```

Дождаться окончания сборки без ошибок.

---

### 7. Перезапустить приложение

```bash
pm2 restart agency-finance --update-env
```

Проверить:

```bash
pm2 status
pm2 logs agency-finance --lines 30
```

В логах не должно быть ошибок.

---

### 8. Проверить в браузере

1. Откройте **https://a.seo-performance.ru** (или ваш домен).
2. Войдите в CRM.
3. **Клиенты** → у любого клиента нажмите **«Личный кабинет»** — в модалке должен быть QR-код для входа в ЛК.
4. Откройте любой **период** (Услуги → период) — у счёта должна быть иконка QR; по ссылке из QR счёт должен открываться в PDF без входа.
5. В карточке клиента при редактировании должно быть поле **«Дата старта работы с клиентом»**.

---

## Краткая шпаргалка (все команды подряд)

Подставьте свои `ПОЛЬЗОВАТЕЛЬ`, `IP_СЕРВЕРА`; при ошибке `psql` используйте вариант Б из шага 4.

```bash
ssh ПОЛЬЗОВАТЕЛЬ@IP_СЕРВЕРА
cd /var/www/agency-finance
git fetch origin && git pull origin main

export $(grep -v '^#' .env | xargs)
export DATABASE_URL_PSQL="${DATABASE_URL%%\?*}"
psql "$DATABASE_URL_PSQL" -f prisma/add-client-work-start-date.sql
psql "$DATABASE_URL_PSQL" -f prisma/add-invoice-public-token.sql

npm ci --include=dev
npx prisma generate
rm -rf .next && npm run build
pm2 restart agency-finance --update-env
pm2 logs agency-finance --lines 20
```

---

**Дата:** 2026-02-09
