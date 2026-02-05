# Развёртывание на VPS — конфигурация сервера

Рекомендуемая конфигурация под проект **agency-finance** (Next.js 14 + PostgreSQL + Prisma).

---

## 1. Рекомендуемые характеристики VPS

### Вариант A: Один сервер (приложение + БД) — **оптимально для MVP / до ~50 пользователей**

| Параметр | Минимум | Рекомендуется | Комфортно |
|----------|---------|---------------|-----------|
| **CPU** | 1 vCPU | 2 vCPU | 2–4 vCPU |
| **RAM** | 1 GB | 2 GB | 4 GB |
| **Диск** | 20 GB SSD | 40 GB SSD | 60+ GB SSD |
| **ОС** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

**Почему достаточно:** Next.js + Node ~300–500 MB RAM, PostgreSQL ~200–400 MB, запас под пики и обновления.

### Вариант B: Раздельная схема (отдельный VPS под БД)

- **App-сервер:** 1–2 vCPU, 2 GB RAM, 20 GB SSD  
- **DB-сервер:** 1 vCPU, 1–2 GB RAM, 20 GB SSD  

Имеет смысл при росте нагрузки или требовании изолировать БД.

### Провайдеры (примеры)

- **Timeweb Cloud**, **Selectel**, **REG.RU** — РФ, удобная оплата  
- **DigitalOcean**, **Hetzner**, **Vultr** — хорошее соотношение цена/качество  
- **Yandex Cloud** — если нужна интеграция с экосистемой Яндекса  

---

## 2. Программный стек на VPS

| Компонент | Версия | Назначение |
|-----------|--------|------------|
| **OS** | Ubuntu 22.04 LTS | Базовая ОС |
| **Node.js** | 20 LTS | Запуск Next.js |
| **PostgreSQL** | 15 | База данных |
| **Nginx** | latest | Reverse proxy, SSL, статика |
| **PM2** | latest | Запуск и автозапуск Node-приложения |
| **Certbot** | latest | SSL-сертификаты (Let's Encrypt) |

---

## 3. Минимальная конфигурация (пошагово)

### 3.1 Подключение и базовая настройка

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка нужных пакетов
sudo apt install -y curl git build-essential
```

### 3.2 Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x.x
npm -v
```

### 3.3 PostgreSQL 15

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Создание БД и пользователя
sudo -u postgres psql -c "CREATE USER agency_finance WITH PASSWORD 'ваш_надёжный_пароль';"
sudo -u postgres psql -c "CREATE DATABASE agency_finance OWNER agency_finance;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE agency_finance TO agency_finance;"
```

### 3.4 Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 3.5 PM2 (глобально)

```bash
sudo npm install -g pm2
```

---

## 4. Размещение приложения

```bash
# Каталог приложения (например)
sudo mkdir -p /var/www/agency-finance
sudo chown $USER:$USER /var/www/agency-finance
cd /var/www/agency-finance

# Клонирование (или загрузка через git/scp)
git clone <ваш-репозиторий> .
# или: scp -r ./project/* user@vps:/var/www/agency-finance/

# Установка зависимостей и сборка
npm ci
npm run db:generate
npm run build
```

---

## 5. Переменные окружения на сервере

Файл `/var/www/agency-finance/.env` (права: `chmod 600 .env`):

```env
# База данных (подставьте свой пароль и хост, если БД на этом же сервере — localhost)
DATABASE_URL="postgresql://agency_finance:ваш_надёжный_пароль@localhost:5432/agency_finance?schema=public"

# Опционально: для продакшена
NODE_ENV=production

# Настройка secure cookies (требуется для HTTPS)
# Если используете HTTPS (SSL настроен через Certbot) - установите SECURE_COOKIES=true
# Если используете только HTTP (без SSL) - установите SECURE_COOKIES=false
SECURE_COOKIES=false
```

Миграции и сид (один раз после деплоя):

```bash
cd /var/www/agency-finance
npx prisma db push
npm run db:seed
```

---

## 6. Запуск через PM2

```bash
cd /var/www/agency-finance
pm2 start npm --name "agency-finance" -- start
pm2 save
pm2 startup
```

Проверка: `pm2 status`, логи: `pm2 logs agency-finance`.

---

## 7. Nginx — reverse proxy

Файл конфигурации: в проекте есть готовая конфигурация `docs/nginx/agency-finance.conf`. Скопируй её на сервер и замени `your-domain.com` на свой домен:

```bash
sudo nano /etc/nginx/sites-available/agency-finance
```

Или скопировать из репозитория (с хоста, где есть проект):

```bash
sudo cp /var/www/agency-finance/docs/nginx/agency-finance.conf /etc/nginx/sites-available/agency-finance
sudo sed -i 's/your-domain.com/твой-домен.ru/g' /etc/nginx/sites-available/agency-finance
```

Содержимое конфигурации (если создаёшь вручную):

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

Включение и перезагрузка Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/agency-finance /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Сертификат будет продлеваться автоматически.

---

## 9. Безопасность

- **Firewall:** открыть только 22 (SSH), 80 (HTTP), 443 (HTTPS). Порт 5432 не открывать в интернет.
- **SSH:** ключи вместо пароля, отключить вход под root при необходимости.
- **Пароли БД:** сложные, хранить только в `.env`, не коммитить в git.
- **Обновления:** регулярно `apt update && apt upgrade`.

---

## 10. Итоговая «идеальная» конфигурация для этого проекта

| Параметр | Значение |
|----------|----------|
| **VPS** | 2 vCPU, 2 GB RAM, 40 GB SSD |
| **ОС** | Ubuntu 22.04 LTS |
| **Node.js** | 20 LTS |
| **PostgreSQL** | 15 (на том же VPS для MVP) |
| **Процесс** | PM2 (`npm run start`) |
| **Прокси** | Nginx + SSL (Certbot) |
| **Домен** | Указать в Nginx и Certbot |

Этого достаточно для стабильной работы приложения в продакшене при типичной нагрузке агентства.
