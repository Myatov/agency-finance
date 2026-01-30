# Выгрузка проекта на GitHub

Пошаговая инструкция, как выложить проект **agency-finance** на GitHub.

---

## 1. Подготовка (уже сделано в проекте)

- В `.gitignore` исключены: `node_modules`, `.env`, `.next`, бэкапы, дампы БД — они не попадут в репозиторий.
- Файл `.env` с паролями и `DATABASE_URL` **никогда** не коммитьте.

---

## 2. Создать репозиторий на GitHub

1. Зайдите на [github.com](https://github.com) и войдите в аккаунт.
2. Нажмите **«+»** → **«New repository»**.
3. Заполните:
   - **Repository name:** например `agency-finance` или `002_agency_finance`.
   - **Description:** по желанию, например «Финансы агентства — MVP».
   - **Public** или **Private** — на ваш выбор.
   - **НЕ** ставьте галочки «Add a README», «Add .gitignore», «Choose a license» — репозиторий должен быть пустым.
4. Нажмите **«Create repository»**.

После создания GitHub покажет страницу с URL репозитория, например:
`https://github.com/ВАШ_ЛОГИН/agency-finance.git`

---

## 3. Инициализировать Git и сделать первый коммит (у себя на компьютере)

Откройте терминал в папке проекта и выполните по порядку.

### 3.1 Инициализация и первый коммит

```bash
cd /Users/myatov/cursor/002_agency_finance

# Инициализировать репозиторий
git init

# Добавить все файлы (учитывается .gitignore)
git add .

# Проверить, что в коммит не попали .env и node_modules
git status

# Первый коммит
git commit -m "Initial commit: agency-finance MVP"
```

### 3.2 Подключить удалённый репозиторий и отправить код

Подставьте вместо `ВАШ_ЛОГИН` и `agency-finance` свои значения (как на GitHub).

```bash
# Подключить remote (замените URL на свой с GitHub)
git remote add origin https://github.com/ВАШ_ЛОГИН/agency-finance.git

# Переименовать ветку в main (если GitHub использует main)
git branch -M main

# Отправить код на GitHub
git push -u origin main
```

При первом `git push` браузер или терминал могут запросить авторизацию GitHub (логин/пароль или токен). Используйте свой аккаунт или [Personal Access Token](https://github.com/settings/tokens).

---

## 4. Если репозиторий уже был создан с README на GitHub

Если вы случайно создали репозиторий с README и теперь при `git push` видите конфликт:

```bash
git pull origin main --allow-unrelated-histories
# Разрешить конфликты в файлах, если появятся, затем:
git add .
git commit -m "Merge with GitHub README"
git push -u origin main
```

---

## 5. Дальнейшая работа

После первой выгрузки для обновления кода на GitHub:

```bash
git add .
git commit -m "Описание изменений"
git push
```

---

## 6. Важно: секреты не в репозитории

- Файл **`.env`** в `.gitignore` — не удаляйте его из правил и не коммитьте.
- На новом месте (другой ПК, VPS) создайте `.env` вручную и укажите свой `DATABASE_URL` и другие переменные.
- В README или в `SETUP.md` можно написать: «Скопируйте `.env.example` в `.env` и заполните» — тогда имеет смысл добавить в репозиторий только `.env.example` (без паролей).

Если нужно, могу предложить содержимое `.env.example` для этого проекта.
