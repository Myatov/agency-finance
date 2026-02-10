# Обновление на сервере: период в строках счёта

Точная последовательность команд по SSH после коммита «Счета: период в строках (periodOverride)...».

---

## 1. Подключиться к серверу

```bash
ssh ПОЛЬЗОВАТЕЛЬ@a.seo-performance.ru
```

(Подставьте своего пользователя, например `root` или `deploy`.)

---

## 2. Перейти в каталог проекта

```bash
cd /var/www/agency-finance
```

---

## 3. Подтянуть код из Git

```bash
git fetch origin
git pull origin main
```

Должны подтянуться изменения (в т.ч. `prisma/add-invoice-line-period-override.sql`).

---

## 4. Применить миграцию БД (добавить колонку «Период» в строки счёта)

**Вариант А** — если `psql` подхватывает `DATABASE_URL` из `.env`:

```bash
export $(grep -v '^#' .env | xargs)
export DATABASE_URL_PSQL="${DATABASE_URL%%\?*}"
psql "$DATABASE_URL_PSQL" -f prisma/add-invoice-line-period-override.sql
```

**Вариант Б** — если появляется ошибка `role "root" does not exist`:

Подставьте логин, пароль и имя БД из `.env` (из строки `DATABASE_URL`):

```bash
export PGPASSWORD='ПАРОЛЬ_ИЗ_ENV'
psql -h localhost -U ЛОГИН_ИЗ_ENV -d ИМЯ_БД_ИЗ_ENV -f /var/www/agency-finance/prisma/add-invoice-line-period-override.sql
unset PGPASSWORD
```

Ожидаемый вывод: `ALTER TABLE` (без ошибок).

---

## 5. Установить зависимости и перегенерировать Prisma

```bash
npm ci --include=dev
npx prisma generate
```

(Если `--include=dev` не поддерживается: `NODE_ENV=development npm ci`, затем `npx prisma generate`.)

---

## 6. Собрать приложение

```bash
npm run build
```

---

## 7. Перезапустить приложение

**Если используете PM2:**

```bash
pm2 restart all
```

**Если используете systemd:**

```bash
sudo systemctl restart agency-finance
```

(Имя сервиса может отличаться — проверьте `systemctl list-units | grep agency`.)

---

## 8. Проверить

- Открыть https://a.seo-performance.ru
- Раздел **Счета** → создать или отредактировать счёт: у каждой строки должно быть поле **Период**, его можно править.
- Открыть **Просмотр** счёта: в таблице должна быть колонка **Период**.

Готово.
