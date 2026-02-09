# Инструкция: обновление на сервере (Оплаты — ожидаемая сумма по периодам)

**Дата коммита:** 2026-02-09  
**Коммит:** описание в сообщении «Оплаты: ожидаемая сумма по периодам, отчёт только просрочки, привязка к месяцу по типу предоплаты».

После этого обновления:
- У каждого рабочего периода может быть своя ожидаемая сумма (редактируется в карточке периода).
- Вкладка «Ближайшие оплаты» показывает только просрочки по оплате; колонки Отчёт / Счёт / Акт на ней убраны.
- Период привязывается к месяцу по полю «Когда выставлять счёт» (предоплата → месяц начала, постоплата → месяц конца).

---

## Что сделать по шагам на сервере (SSH)

### 1. Подключиться к серверу

На своём компьютере:

```bash
ssh ПОЛЬЗОВАТЕЛЬ@IP_ИЛИ_ДОМЕН_СЕРВЕРА
```

Пример: `ssh root@62.217.176.108` или `ssh deploy@a.seo-performance.ru`

---

### 2. Перейти в каталог проекта

```bash
cd /var/www/agency-finance
```

Проверить:

```bash
pwd
# Ожидается: /var/www/agency-finance
```

*(Если у вас путь другой — подставьте свой, например `/home/deploy/agency-finance`.)*

---

### 3. Подтянуть код из Git

```bash
git fetch origin
git pull origin main
```

В выводе должно быть что-то вроде `Updating a3a02ca..c3de7d2` и список изменённых файлов (в т.ч. `prisma/schema.prisma`, `prisma/add-work-period-expected-amount.sql`). Если Git пишет, что локальных изменений нет и нечего коммитить — это нормально, просто вы уже на актуальном коммите.

---

### 4. Применить миграцию базы данных (обязательно)

Добавляется колонка `expectedAmount` в таблицу `WorkPeriod`. Без этого шага приложение может падать при обращении к новому полю.

**Вариант А — через переменные из `.env` (рекомендуется):**

Сначала загрузите `.env` и проверьте, что URL подхватился:

```bash
cd /var/www/agency-finance
set -a
source .env
set +a
# Убираем ?schema=... и прочее из URL
export DATABASE_URL_PSQL="${DATABASE_URL%%\?*}"
echo "Подключение: ${DATABASE_URL_PSQL%%@*}@..."   # покажет user@host, без пароля
```

Если вывод пустой — в `.env` нет `DATABASE_URL` или он с комментарием. Иначе запускайте миграцию:

```bash
psql "$DATABASE_URL_PSQL" -f prisma/add-work-period-expected-amount.sql
```

Если появляется ошибка **`role "root" does not exist`** — `psql` игнорирует URL и подключается под текущим пользователем ОС. Используйте **вариант Б**.

**Вариант Б — явное подключение (решает ошибку `role "root" does not exist`):**

`psql` на сервере может не принять URL из переменной и подключиться по сокету под пользователем `root`. Тогда подключайтесь явно: логин, пароль и база из `.env`.

```bash
cd /var/www/agency-finance
grep DATABASE_URL .env
```

В строке вида `DATABASE_URL="postgresql://ЛОГИН:ПАРОЛЬ@localhost:5432/ИМЯ_БД?..."` возьмите **ЛОГИН**, **ПАРОЛЬ** и **ИМЯ_БД**. Подставьте их в команду:

```bash
export PGPASSWORD='ПАРОЛЬ'
psql -h localhost -U ЛОГИН -d ИМЯ_БД -f /var/www/agency-finance/prisma/add-work-period-expected-amount.sql
unset PGPASSWORD
```

Пример: если в `.env` указано `postgresql://agency_finance:SecretPass@localhost:5432/agency_finance`, то:

```bash
export PGPASSWORD='SecretPass'
psql -h localhost -U agency_finance -d agency_finance -f /var/www/agency-finance/prisma/add-work-period-expected-amount.sql
unset PGPASSWORD
```

**Вариант В — от пользователя `postgres` (если знаете только имя базы):**

Если логин/пароль из URL использовать не хотите, а пользователь `postgres` в системе есть:

```bash
sudo -u postgres psql -d ИМЯ_БД -f /var/www/agency-finance/prisma/add-work-period-expected-amount.sql
```

Замените `ИМЯ_БД` на имя базы из `DATABASE_URL` (например `agency_finance`).

---

### 5. Установить зависимости и перегенерировать Prisma Client

```bash
cd /var/www/agency-finance
npm ci
npx prisma generate
```

Если в проекте есть скрипт `npm run db:generate`, можно вместо `npx prisma generate` выполнить:

```bash
npm run db:generate
```

---

### 6. Собрать приложение

```bash
cd /var/www/agency-finance
rm -rf .next
npm run build
```

Дождаться окончания без ошибок. При ошибках — посмотреть вывод и при необходимости повторить `npm ci` и снова `npm run build`.

---

### 7. Перезапустить приложение (PM2)

```bash
pm2 restart agency-finance --update-env
```

Проверить статус и логи:

```bash
pm2 status
pm2 logs agency-finance --lines 30
```

В логах не должно быть сообщений об ошибках (например, про отсутствующую колонку в БД).

---

### 8. Проверить в браузере

1. Открыть **https://a.seo-performance.ru** (или ваш домен).
2. Войти в CRM.
3. Раздел **Оплаты**:
   - Вкладка **«Ближайшие оплаты»** — только строки с просрочкой по оплате, без колонок Отчёт / Счёт / Акт.
   - Раскрыть **«Описание отчёта и подсказки»** — должен быть текст про предоплату/постоплату и привязку к месяцу.
4. **Услуги** → любая услуга → **Периоды** → открыть период → **Счета и оплаты**: блок «Ожидаемо за период» с кнопкой **«Изменить»** — можно менять сумму по периоду и сохранять.

Если всё так — обновление применено корректно.

---

## Краткая последовательность команд (копировать по порядку)

Подставьте свой способ подключения к БД (см. шаг 4).

```bash
ssh ПОЛЬЗОВАТЕЛЬ@СЕРВЕР
cd /var/www/agency-finance

git fetch origin && git pull origin main

# Миграция БД (обязательно)
export $(grep -v '^#' .env | xargs)
export DATABASE_URL_PSQL="${DATABASE_URL%%\?*}"
psql "$DATABASE_URL_PSQL" -f prisma/add-work-period-expected-amount.sql

npm ci
npx prisma generate
rm -rf .next && npm run build
pm2 restart agency-finance --update-env
pm2 logs agency-finance --lines 20
```

---

## Если что-то пошло не так

- **Ошибка при `psql` (миграция):** проверьте `DATABASE_URL` в `.env`, что PostgreSQL запущен (`sudo systemctl status postgresql`), что пользователь и база существуют. При «column already exists» — миграция уже применялась, можно переходить к шагу 5.
- **Ошибка при сборке:** выполните `npm ci` снова, затем `npm run build`. Если ошибка про Prisma — проверьте, что выполнен `npx prisma generate` после `git pull`.
- **В логах ошибка про `expectedAmount` или «column does not exist»:** миграция не применена или применена не к той базе. Выполните шаг 4 ещё раз для нужной базы.
- **На сайте старый интерфейс:** убедитесь, что `pm2 restart agency-finance --update-env` выполнен и в `pm2 status` приложение в статусе `online`. При необходимости перезапустите ещё раз.

---

**Дата инструкции:** 2026-02-09
