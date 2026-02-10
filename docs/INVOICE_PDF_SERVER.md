# Формирование PDF счёта на сервере (Puppeteer)

Кнопка «Сформировать PDF» на странице просмотра счёта использует Puppeteer (Chrome). На Linux-сервере для запуска встроенного Chrome нужны системные библиотеки.

## Ошибка: error while loading shared libraries (libatk, libcairo и т.д.)

Если при нажатии «Сформировать PDF» появляется ошибка вида:

```
Failed to launch the browser process: Code: 127
.../chrome: error while loading shared libraries: libcairo.so.2: cannot open shared object file
```

### Решение: поставить полный набор зависимостей и перезапустить приложение

**1. Установите все зависимости одним разом (Debian / Ubuntu):**

```bash
sudo apt-get update
sudo apt-get install -y \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgdk-pixbuf2.0-0 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnss3 \
  libnspr4 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  zlib1g
```

**2. Обязательно перезапустите приложение** (Node/Next.js должен запускаться уже после установки библиотек, иначе дочерний процесс Chrome может не подхватить их):

```bash
# если через PM2:
pm2 restart all

# или если через systemd:
sudo systemctl restart your-app-service

# или просто заново запустите приложение вручную
```

После этого снова нажмите «Сформировать PDF».

### Узнать, каких библиотек не хватает

Путь к Chrome у Puppeteer обычно такой:  
`~/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome`

```bash
ldd ~/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome 2>/dev/null | grep "not found"
```

В выводе будут перечислены недостающие `.so` — по имени файла можно найти пакет:  
`apt-cache search libcairo` и т.п.
