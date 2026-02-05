# Команды для настройки сервера (копируй по порядку)

Выполняй на VPS с **Ubuntu 22.04** после подключения по SSH.  
Замени `ваш_надёжный_пароль`, `your-domain.com`, `https://github.com/...` на свои значения.

---

## 1. Система и базовые пакеты

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

---

## 2. Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

---

## 3. PostgreSQL 15

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Создание БД и пользователя (подставь свой пароль):

```bash
sudo -u postgres psql -c "CREATE USER agency_finance WITH PASSWORD 'ваш_надёжный_пароль';"
sudo -u postgres psql -c "CREATE DATABASE agency_finance OWNER agency_finance;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE agency_finance TO agency_finance;"
```

---

## 4. Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

---

## 5. PM2

```bash
sudo npm install -g pm2
```

---

## 6. Каталог приложения и клонирование

```bash
sudo mkdir -p /var/www/agency-finance
sudo chown $USER:$USER /var/www/agency-finance
cd /var/www/agency-finance
git clone https://github.com/ВАШ_ЛОГИН/agency-finance.git .
```

Если репозиторий приватный — настрой SSH-ключ или используй токен в URL.

---

## 7. Сборка приложения

```bash
cd /var/www/agency-finance
npm ci
npm run db:generate
npm run build
```

---

## 8. Файл .env

Создай файл и вставь (подставь свой пароль от БД):

```bash
nano /var/www/agency-finance/.env
```

Содержимое:

```
DATABASE_URL="postgresql://agency_finance:ваш_надёжный_пароль@localhost:5432/agency_finance?schema=public"
NODE_ENV=production
SECURE_COOKIES=false
```

**Важно:** 
- Если используете HTTPS (SSL настроен) — установите `SECURE_COOKIES=true`
- Если используете только HTTP (без SSL) — установите `SECURE_COOKIES=false`

Сохрани: `Ctrl+O`, Enter, `Ctrl+X`. Затем:

```bash
chmod 600 /var/www/agency-finance/.env
```

---

## 9. Миграции и начальные данные

```bash
cd /var/www/agency-finance
npx prisma db push
npm run db:seed
```

---

## 10. Запуск приложения через PM2

```bash
cd /var/www/agency-finance
pm2 start npm --name "agency-finance" -- start
pm2 save
pm2 startup
```

Проверка: `pm2 status`, логи: `pm2 logs agency-finance`.

---

## 11. Nginx — конфиг сайта

В проекте есть готовый конфиг: `docs/nginx/agency-finance.conf`. На сервере:

```bash
sudo cp /var/www/agency-finance/docs/nginx/agency-finance.conf /etc/nginx/sites-available/agency-finance
sudo sed -i 's/your-domain.com/твой-домен.ru/g' /etc/nginx/sites-available/agency-finance
```

Или создай вручную и вставь (замени `your-domain.com` на свой домен):

```bash
sudo nano /etc/nginx/sites-available/agency-finance
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        proxy_temp_file_write_size 8k;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Включи сайт и перезагрузи Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/agency-finance /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 12. SSL (Let's Encrypt)

Подставь свой домен:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Дальше certbot спросит email и согласие — ответь и дождись выдачи сертификата.

---

## Краткая шпаргалка (только команды, без пояснений)

| Шаг | Команды |
|-----|---------|
| 1 | `sudo apt update && sudo apt upgrade -y` → `sudo apt install -y curl git build-essential` |
| 2 | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash -` → `sudo apt install -y nodejs` |
| 3 | `sudo apt install -y postgresql postgresql-contrib` → `sudo systemctl enable postgresql` → `sudo systemctl start postgresql` → создание БД/пользователя (см. блок выше) |
| 4 | `sudo apt install -y nginx` → `sudo systemctl enable nginx` |
| 5 | `sudo npm install -g pm2` |
| 6 | `sudo mkdir -p /var/www/agency-finance` → `sudo chown $USER:$USER /var/www/agency-finance` → `cd /var/www/agency-finance` → `git clone <repo> .` |
| 7 | `npm ci` → `npm run db:generate` → `npm run build` |
| 8 | Создать `.env` с `DATABASE_URL` и `NODE_ENV=production` |
| 9 | `npx prisma db push` → `npm run db:seed` |
| 10 | `pm2 start npm --name "agency-finance" -- start` → `pm2 save` → `pm2 startup` |
| 11 | Создать конфиг Nginx → `sudo ln -s ... sites-enabled/` → `sudo nginx -t` → `sudo systemctl reload nginx` |
| 12 | `sudo apt install -y certbot python3-certbot-nginx` → `sudo certbot --nginx -d домен` |

Подробности и варианты — в `docs/VPS_DEPLOYMENT.md`.
