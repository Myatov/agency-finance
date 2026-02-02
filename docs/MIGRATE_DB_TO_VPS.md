# Перенос БД на VPS и подключение локального проекта

Пошаговая инструкция: как выгрузить локальную БД на VPS и подключить к ней локальный проект.

---

## Шаг 1: Создать дамп локальной БД

На своём компьютере в папке проекта выполни:

```bash
# Если БД локальная (PostgreSQL на твоём компьютере)
pg_dump -h localhost -U postgres -d agency_finance -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Или если БД на другом сервере (замени на свои данные)
pg_dump -h IP_БД -U agency_finance -d agency_finance -F c -f backup_$(date +%Y%m%d_%H%M%S).dump
```

- `-F c` — формат custom (сжатый, удобный для восстановления).
- `-U` — пользователь БД (обычно `postgres` локально или `agency_finance`).
- `-d` — имя БД.
- `-f` — имя файла дампа.

Если запросит пароль — введи. В результате получишь файл `backup_YYYYMMDD_HHMMSS.dump` в текущей папке.

**Альтернатива — SQL-формат** (если custom не работает):

```bash
pg_dump -h localhost -U postgres -d agency_finance -f backup.sql
```

---

## Шаг 2: Загрузить дамп на VPS

**Вариант А — через SCP** (с твоего компьютера):

```bash
scp backup_YYYYMMDD_HHMMSS.dump пользователь@IP_VPS:/tmp/
```

Подставь имя файла дампа, SSH-логин и IP VPS.

**Вариант Б — через SSH и wget/curl** (если дамп в облаке):

Если загрузил дамп в облако (Google Drive, Dropbox и т.д.), на VPS:

```bash
wget https://ссылка_на_файл/backup.dump -O /tmp/backup.dump
```

**Вариант В — через git** (если дамп небольшой и добавил в репозиторий):

Не рекомендуется для больших БД, но если дамп маленький:

```bash
# На VPS после git pull
cp /var/www/agency-finance/backup.dump /tmp/
```

---

## Шаг 3: На VPS — подготовить БД

Подключись к VPS по SSH:

```bash
ssh пользователь@IP_VPS
```

**3.1. Создать БД и пользователя** (если ещё не созданы):

```bash
sudo -u postgres psql -c "CREATE USER agency_finance WITH PASSWORD 'надёжный_пароль';"
sudo -u postgres psql -c "CREATE DATABASE agency_finance OWNER agency_finance;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE agency_finance TO agency_finance;"
```

Если БД и пользователь уже есть — этот шаг пропусти.

**3.2. Очистить БД** (если там уже есть данные, которые нужно заменить):

```bash
sudo -u postgres psql -d agency_finance -c "DROP SCHEMA public CASCADE;"
sudo -u postgres psql -d agency_finance -c "CREATE SCHEMA public;"
sudo -u postgres psql -d agency_finance -c "GRANT ALL ON SCHEMA public TO agency_finance;"
```

**Внимание:** это удалит все данные в БД на VPS. Если нужно сохранить — сначала сделай бэкап.

---

## Шаг 4: Восстановить дамп на VPS

**Если дамп в формате custom (.dump):**

```bash
pg_restore -h localhost -U agency_finance -d agency_finance --clean --if-exists /tmp/backup_YYYYMMDD_HHMMSS.dump
```

Если запросит пароль — введи пароль пользователя `agency_finance`.

**Если дамп в формате SQL (.sql):**

```bash
psql -h localhost -U agency_finance -d agency_finance -f /tmp/backup.sql
```

**Проверка** (должны быть таблицы и данные):

```bash
sudo -u postgres psql -d agency_finance -c "\dt"
sudo -u postgres psql -d agency_finance -c "SELECT COUNT(*) FROM \"User\";"
```

---

## Шаг 5: На VPS — обновить схему Prisma (если нужно)

Если схема БД на VPS отличается от `prisma/schema.prisma` в проекте:

```bash
cd /var/www/agency-finance
npm run db:generate
npx prisma db push
```

Это синхронизирует структуру БД с текущей схемой Prisma (осторожно: может изменить структуру, если схема изменилась).

---

## Шаг 6: На VPS — обновить .env

Убедись, что в `/var/www/agency-finance/.env` указан правильный `DATABASE_URL`:

```env
DATABASE_URL="postgresql://agency_finance:пароль@localhost:5432/agency_finance?schema=public"
NODE_ENV=production
```

Если пароль менялся — обнови его здесь.

---

## Шаг 7: Перезапустить приложение на VPS

```bash
cd /var/www/agency-finance
pm2 restart agency-finance
pm2 logs agency-finance
```

Проверь логи — не должно быть ошибок подключения к БД.

---

## Шаг 8: Локально — подключить проект к БД на VPS

Теперь локальный проект должен работать с БД на VPS. Два варианта:

### Вариант 1: SSH-туннель (рекомендуется)

В отдельном терминале на своём компьютере:

```bash
ssh -L 5433:localhost:5432 пользователь@IP_VPS -N
```

В локальном `.env`:

```env
DATABASE_URL="postgresql://agency_finance:пароль@localhost:5433/agency_finance?schema=public"
```

### Вариант 2: Прямое подключение

В локальном `.env`:

```env
DATABASE_URL="postgresql://agency_finance:пароль@IP_VPS:5432/agency_finance?schema=public"
```

**Важно:** для прямого подключения нужно настроить PostgreSQL на VPS (см. [LOCAL_DIRECT_DB_CONNECTION.md](LOCAL_DIRECT_DB_CONNECTION.md)).

---

## Шаг 9: Проверка локально

На своём компьютере:

```bash
npm run db:generate
npm run dev
```

Открой http://localhost:3000 — данные должны быть с VPS (те же, что были в локальной БД).

---

## Краткий чеклист

- [ ] Создан дамп локальной БД (`pg_dump`)
- [ ] Дамп загружен на VPS (`scp` или другой способ)
- [ ] На VPS созданы БД и пользователь (если нужно)
- [ ] Дамп восстановлен на VPS (`pg_restore` или `psql`)
- [ ] На VPS обновлён `.env` с правильным `DATABASE_URL`
- [ ] На VPS перезапущено приложение (`pm2 restart`)
- [ ] Локально настроен `.env` для подключения к БД на VPS
- [ ] Локально `npm run dev` — работает без ошибок

---

## Если что-то пошло не так

**Ошибка при восстановлении дампа:**

- Проверь, что пользователь `agency_finance` существует и имеет права на БД.
- Проверь формат дампа: custom (`.dump`) или SQL (`.sql`).
- Если ошибка про схему — попробуй `--no-owner --no-privileges` в `pg_restore`.

**Локальный проект не подключается к БД на VPS:**

- Проверь, что SSH-туннель запущен (если используешь вариант 1).
- Проверь, что PostgreSQL на VPS принимает внешние подключения (если вариант 2).
- Проверь пароль в локальном `.env` — он должен совпадать с паролем на VPS.

**Данные не совпадают:**

- Убедись, что восстановил дамп в правильную БД.
- Проверь, что на VPS приложение использует правильный `DATABASE_URL` в `.env`.

После выполнения всех шагов локальный проект будет работать с БД на VPS, а данные будут синхронизированы.
