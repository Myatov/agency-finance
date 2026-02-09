# Инструкция: деплой через SSH

После пуша изменений в репозиторий выполните на сервере через SSH следующие шаги.

## 1. Подключиться к серверу

```bash
ssh user@your-server
```

(подставьте своего пользователя и хост).

## 2. Перейти в каталог приложения

```bash
cd /var/www/agency-finance
```

(или тот путь, где развёрнуто приложение).

## 3. Обновить код с GitHub

```bash
git pull origin main
```

## 4. Обновить схему БД (новое поле для PDF)

Добавлено поле `Invoice.pdfGeneratedAt`. Примените изменения схемы:

```bash
npx prisma db push
```

Либо, если используете миграции:

```bash
npx prisma migrate deploy
```

(в этом случае миграция должна быть заранее создана и закоммичена).

## 5. Создать каталог для PDF (если его ещё нет)

Сформированные PDF сохраняются в каталог `invoices-pdf` в корне проекта (либо в путь из переменной `INVOICE_PDF_DIR`). Создайте каталог и дайте права веб-серверу/приложению:

```bash
mkdir -p invoices-pdf
chmod 755 invoices-pdf
```

Если приложение запускается от пользователя `www-data` (или другого):

```bash
chown www-data:www-data invoices-pdf
```

(подставьте своего пользователя, от которого работает приложение).

## 6. (Опционально) Переменная окружения для каталога PDF

Если нужно хранить PDF в другом месте (например, на отдельном диске), задайте в `.env` или в конфиге процесса:

```bash
INVOICE_PDF_DIR=/путь/к/каталогу/invoices-pdf
```

## 7. Установить зависимости и пересобрать (если нужно)

Обычно это делает ваш скрипт деплоя. Если деплой ручной:

```bash
npm install
npx prisma generate
npm run build
```

## 8. Перезапустить приложение

Пример для PM2:

```bash
pm2 restart agency-finance
```

Или как у вас настроено (systemd, docker и т.п.).

---

## Краткий чеклист

- [ ] `git pull origin main`
- [ ] `npx prisma db push` (или `npx prisma migrate deploy`)
- [ ] `mkdir -p invoices-pdf && chmod 755 invoices-pdf` (и при необходимости `chown`)
- [ ] При необходимости задать `INVOICE_PDF_DIR` в окружении
- [ ] При ручном деплое: `npm install && npx prisma generate && npm run build`
- [ ] Перезапуск приложения (например, `pm2 restart agency-finance`)
