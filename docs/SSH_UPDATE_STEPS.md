# Пошаговое обновление на сервере через SSH

Инструкция для обновления приложения после коммитов. При первом развёртывании массовых расходов (налоги) нужно применить миграцию `add-expense-source-income-id.sql`.

---

## Шаг 1. Подключиться к серверу

На своём компьютере в терминале:

```bash
ssh ПОЛЬЗОВАТЕЛЬ@IP_ИЛИ_ДОМЕН_СЕРВЕРА
```

Пример: `ssh root@62.217.176.108` или `ssh deploy@a.seo-performance.ru`

---

## Шаг 2. Перейти в папку проекта

```bash
cd /var/www/agency-finance
```

Проверьте, что вы в нужной директории:

```bash
pwd
# Должно быть: /var/www/agency-finance
```

---

## Шаг 3. (Опционально) Обновить базу данных

**Массовые расходы (налоги):** если на сервере ещё не применяли миграцию для поля `Expense.sourceIncomeId`:

```bash
cd /var/www/agency-finance
export $(grep -v '^#' .env | xargs)
# psql не понимает ?schema=public — убираем query-часть из URL
export DATABASE_URL_PSQL="${DATABASE_URL%%\?*}"
psql "$DATABASE_URL_PSQL" -f prisma/add-expense-source-income-id.sql
```

**Личный кабинет клиента:** если таблица `ClientPortalAccess` ещё не создана:

```bash
# Посмотреть параметры БД
grep DATABASE_URL .env

# Проверить наличие таблицы ClientPortalAccess (подставьте ЛОГИН, ПАРОЛЬ, ИМЯ_БД из .env)
export PGPASSWORD='ПАРОЛЬ'
psql -h localhost -U ЛОГИН -d ИМЯ_БД -c "\dt ClientPortalAccess"
unset PGPASSWORD
```

Если таблицы нет — применить миграцию:

```bash
export PGPASSWORD='ПАРОЛЬ'
psql -h localhost -U ЛОГИН -d ИМЯ_БД -f prisma/add-client-portal-access.sql
unset PGPASSWORD
```

Подробнее: **docs/CLIENT_PORTAL_DB_MIGRATION.md**

**Оплаты — ожидаемая сумма по периодам (2026-02-09):** при обновлении до коммита с `WorkPeriod.expectedAmount`:

1) Добавить колонку (один раз):

```bash
cd /var/www/agency-finance
export $(grep -v '^#' .env | xargs)
export DATABASE_URL_PSQL="${DATABASE_URL%%\?*}"
psql "$DATABASE_URL_PSQL" -f prisma/add-work-period-expected-amount.sql
```

2) **Обязательно** заполнить цены у существующих периодов (чтобы при смене цены услуги старые периоды не менялись):

```bash
psql "$DATABASE_URL_PSQL" -f prisma/backfill-work-period-expected-amount.sql
```

3) После удаления дубликатов периодов в интерфейсе (Услуги → Периоды → удалить лишние, без доходов и счетов) — защита от повторного появления дубликатов:

```bash
psql "$DATABASE_URL_PSQL" -f prisma/add-work-period-unique-dates.sql
```

Если скрипт п.3 выдаёт ошибку из‑за оставшихся дубликатов — удалите лишние периоды и запустите его снова.

---

## Шаг 4. Обновить код из Git

```bash
git fetch origin
git pull origin main
```

Убедитесь, что обновление прошло без ошибок (должны подтянуться изменения).

---

## Шаг 5. Добавить переменную для ссылки личного кабинета

Чтобы ссылка «Личный кабинет» в разделе Клиенты формировалась как `https://a.seo-performance.ru/...`, а не `https://localhost:3000/...`:

```bash
nano .env
```

В конец файла добавьте строку (или измените, если уже есть):

```
NEXT_PUBLIC_APP_URL=https://a.seo-performance.ru
```

Сохраните: `Ctrl+O`, Enter, `Ctrl+X`.

---

## Шаг 6. Установить зависимости и перегенерировать Prisma

```bash
npm ci
npm run db:generate
```

---

## Шаг 7. Собрать приложение

```bash
rm -rf .next
npm run build
```

Дождитесь окончания сборки (без ошибок).

---

## Шаг 8. Перезапустить приложение

```bash
pm2 restart agency-finance --update-env
```

Проверьте статус:

```bash
pm2 status
pm2 logs agency-finance --lines 30
```

В логах не должно быть ошибок.

---

## Шаг 9. Проверить в браузере

1. Откройте **https://a.seo-performance.ru**
2. Войдите в CRM.
3. Раздел **Клиенты** → у любого клиента нажмите **«Личный кабинет»**.
4. Убедитесь, что ссылка начинается с **https://a.seo-performance.ru/cabinet/enter/...**
5. Откройте эту ссылку в новой вкладке (или в режиме инкогнито) — должна открыться форма ввода пароля **без** циклического перенаправления.
6. Введите пароль (если доступ уже создан) — должен произойти вход в личный кабинет.

---

## Краткая шпаргалка (все команды подряд)

Подставьте свои `ПОЛЬЗОВАТЕЛЬ`, `IP_СЕРВЕРА`, при необходимости — параметры БД.

```bash
ssh ПОЛЬЗОВАТЕЛЬ@IP_СЕРВЕРА
cd /var/www/agency-finance
git pull origin main

# Добавить в .env: NEXT_PUBLIC_APP_URL=https://a.seo-performance.ru
nano .env

npm ci
npm run db:generate
rm -rf .next && npm run build
pm2 restart agency-finance --update-env
pm2 logs agency-finance --lines 20
```

---

## Если что-то пошло не так

- **Ошибка при сборке:** посмотрите вывод `npm run build`, при необходимости выполните `npm ci` заново и повторите `npm run build`.
- **Ошибка «ClientPortalAccess» в логах:** таблица не создана, выполните шаг 3 (миграция БД) и снова `npm run db:generate`, затем `pm2 restart agency-finance --update-env`.
- **Ссылка всё ещё localhost:** проверьте, что в `.env` на сервере есть `NEXT_PUBLIC_APP_URL=https://a.seo-performance.ru` и перезапустите приложение с `--update-env`.

---

**Дата:** 2026-02-08
