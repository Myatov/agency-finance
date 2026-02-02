# Настройка GitHub Actions для мгновенного деплоя

Автоматический деплой через cron уже настроен (проверка каждые 5 минут).  
Для мгновенного деплоя при каждом push настрой GitHub Actions.

---

## Что уже сделано

✅ SSH ключ создан и добавлен на сервер  
✅ Скрипт деплоя настроен  
✅ Cron задача работает (проверка каждые 5 минут)

---

## Настройка GitHub Actions (опционально, для мгновенного деплоя)

### Шаг 1: Добавить секреты в GitHub

1. Зайди на GitHub: https://github.com/Myatov/agency-finance
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
3. Добавь три секрета:

**VPS_HOST:**
```
62.217.176.108
```

**VPS_USER:**
```
root
```

**VPS_SSH_KEY:**
Скопируй содержимое приватного ключа (ниже):

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBpzLdm59QLdiIL94Zlz68xZ22Oqmz/VPUbOTQYun0CzwAAAJidPMrHnTzK
xwAAAAtzc2gtZWQyNTUxOQAAACBpzLdm59QLdiIL94Zlz68xZ22Oqmz/VPUbOTQYun0Czw
AAAEDWLtuVG9gb5w+offmdUwkqxo7QaA9Gelxn7lfyzwMXB2nMt2bn1At2Igv3hmXPrzFn
bY6qbP9U9Rs5NBi6fQLPAAAAFWRlcGxveUBhZ2VuY3ktZmluYW5jZQ==
-----END OPENSSH PRIVATE KEY-----
```

**Важно:** копируй весь ключ, включая строки `-----BEGIN` и `-----END`.

### Шаг 2: Проверка

После добавления секретов при следующем `git push` GitHub Actions автоматически запустится и задеплоит изменения на VPS.

Проверить можно в репозитории: **Actions** → там будут видны запуски workflow.

---

## Текущая настройка (Cron)

Сейчас работает автоматический деплой через cron:
- Проверка обновлений каждые **5 минут**
- Если есть новые коммиты → автоматический деплой
- Логи: `/var/log/agency-finance-deploy.log` на VPS

Это работает и без GitHub Actions. GitHub Actions нужен только для **мгновенного** деплоя (сразу при push, а не через 5 минут).

---

## Проверка работы

**Тест cron деплоя:**

1. Сделай небольшое изменение в коде
2. Закоммить и отправь: `git commit -m "test" && git push`
3. Подожди до 5 минут или проверь вручную на VPS:
   ```bash
   ssh root@62.217.176.108
   tail -f /var/log/agency-finance-deploy.log
   ```

**Тест GitHub Actions (если настроил):**

1. Сделай изменение и отправь: `git push`
2. Зайди на GitHub → **Actions** → увидишь запуск workflow
3. Через 10-30 секунд код обновится на VPS

---

## Управление

**Просмотр логов деплоя на VPS:**
```bash
tail -f /var/log/agency-finance-deploy.log
```

**Ручной запуск деплоя:**
```bash
ssh root@62.217.176.108
cd /var/www/agency-finance
./deploy.sh
```

**Отключить автоматический деплой:**
```bash
ssh root@62.217.176.108
crontab -e
# Закомментируй или удали строку с auto-deploy.sh
```

Все готово! Теперь при каждом `git push` код автоматически обновится на VPS.
