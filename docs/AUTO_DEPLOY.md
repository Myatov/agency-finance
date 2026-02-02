# Автоматический деплой на VPS

При отправке коммита на GitHub код автоматически обновляется на VPS и перезапускается приложение.

---

## Вариант 1: GitHub Webhook (рекомендуется)

Сервер слушает webhook от GitHub и автоматически обновляет код при push.

### Шаг 1: Создать скрипт деплоя на VPS

На VPS создай файл `/var/www/agency-finance/deploy.sh`:

```bash
#!/bin/bash
set -e

cd /var/www/agency-finance

echo "=== Deploy started at $(date) ==="

# Получить последние изменения
git pull origin main

# Обновить зависимости (если нужно)
npm ci --production

# Обновить Prisma Client
npm run db:generate

# Перезапустить приложение
pm2 restart agency-finance

echo "=== Deploy completed at $(date) ==="
```

Сделай скрипт исполняемым:

```bash
chmod +x /var/www/agency-finance/deploy.sh
```

### Шаг 2: Установить webhook сервер

На VPS установи `webhook` (легковесный сервер для обработки webhooks):

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y webhook

# Или через Go (если apt нет)
go install github.com/adnanh/webhook@latest
```

### Шаг 3: Создать конфиг webhook

Создай файл `/etc/webhook/hooks.json`:

```json
[
  {
    "id": "agency-finance-deploy",
    "execute-command": "/var/www/agency-finance/deploy.sh",
    "command-working-directory": "/var/www/agency-finance",
    "response-message": "Deploy started",
    "trigger-rule": {
      "match": {
        "type": "payload-hmac-sha256",
        "secret": "твой_секретный_ключ_для_безопасности",
        "parameter": {
          "source": "header",
          "name": "X-Hub-Signature-256"
        }
      }
    }
  }
]
```

**Важно:** замени `твой_секретный_ключ_для_безопасности` на случайную строку (например, сгенерируй через `openssl rand -hex 32`).

### Шаг 4: Запустить webhook сервер

Создай systemd сервис `/etc/systemd/system/webhook.service`:

```ini
[Unit]
Description=Webhook server
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/webhook -hooks /etc/webhook/hooks.json -verbose
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Запусти:

```bash
sudo systemctl daemon-reload
sudo systemctl enable webhook
sudo systemctl start webhook
```

Проверь статус:

```bash
sudo systemctl status webhook
```

### Шаг 5: Настроить GitHub Webhook

1. Зайди на GitHub в свой репозиторий
2. **Settings** → **Webhooks** → **Add webhook**
3. Заполни:
   - **Payload URL:** `http://твой_IP_VPS:9000/hooks/agency-finance-deploy`
   - **Content type:** `application/json`
   - **Secret:** тот же секретный ключ, что в `hooks.json`
   - **Events:** выбери "Just the push event"
4. Нажми **Add webhook**

**Если у тебя есть домен с SSL**, используй HTTPS URL вместо HTTP.

### Шаг 6: Открыть порт 9000 в фаерволе

```bash
sudo ufw allow 9000/tcp comment "Webhook server"
sudo ufw reload
```

---

## Вариант 2: GitHub Actions (через SSH)

GitHub Actions выполняет команды на VPS через SSH при каждом push.

### Шаг 1: Создать SSH ключ для деплоя

На VPS создай пользователя для деплоя (или используй существующего):

```bash
sudo useradd -m -s /bin/bash deploy
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
```

Сгенерируй SSH ключ на своём компьютере:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_agency_finance -N ""
```

Скопируй публичный ключ на VPS:

```bash
ssh-copy-id -i ~/.ssh/deploy_agency_finance.pub deploy@IP_VPS
```

Или вручную добавь в `/home/deploy/.ssh/authorized_keys` на VPS.

### Шаг 2: Создать GitHub Actions workflow

В проекте создай файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /var/www/agency-finance
            git pull origin main
            npm ci --production
            npm run db:generate
            pm2 restart agency-finance
```

### Шаг 3: Добавить секреты в GitHub

1. Зайди на GitHub в репозиторий
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
3. Добавь три секрета:
   - `VPS_HOST` — IP или домен VPS (например, `62.217.176.108`)
   - `VPS_USER` — SSH пользователь (например, `deploy` или `root`)
   - `VPS_SSH_KEY` — содержимое приватного ключа (`~/.ssh/deploy_agency_finance`)

Чтобы получить приватный ключ:

```bash
cat ~/.ssh/deploy_agency_finance
```

Скопируй весь вывод (включая `-----BEGIN` и `-----END`).

---

## Вариант 3: Простой скрипт с проверкой (без webhook)

Если не хочешь настраивать webhook или GitHub Actions, можно сделать скрипт, который периодически проверяет обновления.

На VPS создай cron задачу:

```bash
sudo crontab -e
```

Добавь строку (проверка каждые 5 минут):

```
*/5 * * * * cd /var/www/agency-finance && git fetch && [ $(git rev-parse HEAD) != $(git rev-parse origin/main) ] && /var/www/agency-finance/deploy.sh >> /var/log/agency-finance-deploy.log 2>&1
```

Или используй скрипт `/var/www/agency-finance/auto-deploy.sh`:

```bash
#!/bin/bash
cd /var/www/agency-finance
git fetch

if [ $(git rev-parse HEAD) != $(git rev-parse origin/main) ]; then
    echo "New commits found, deploying..."
    /var/www/agency-finance/deploy.sh
else
    echo "No new commits"
fi
```

И добавь в cron:

```
*/5 * * * * /var/www/agency-finance/auto-deploy.sh >> /var/log/agency-finance-deploy.log 2>&1
```

---

## Рекомендация

Для начала используй **Вариант 1 (GitHub Webhook)** — он простой, надёжный и не требует настройки GitHub Actions.

**Вариант 2 (GitHub Actions)** подходит, если:
- Хочешь видеть логи деплоя в GitHub
- Нужна более сложная логика деплоя
- Уже используешь GitHub Actions для других задач

**Вариант 3 (Cron)** — самый простой, но менее эффективный (проверка каждые N минут, а не мгновенно).

---

## Проверка работы

После настройки:

1. Сделай небольшое изменение в коде
2. Закоммить и отправь на GitHub: `git commit -m "test" && git push`
3. Проверь логи на VPS:
   ```bash
   # Для webhook
   sudo journalctl -u webhook -f
   
   # Для PM2
   pm2 logs agency-finance
   ```

Должно автоматически обновиться и перезапуститься приложение.
