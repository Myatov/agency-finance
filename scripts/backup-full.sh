#!/bin/bash
# Полный бэкап проекта и БД PostgreSQL.
# Запуск: из корня проекта — bash scripts/backup-full.sh
# Требуется: .env с DATABASE_URL (для дампа БД), pg_dump (для дампа БД).

set -e
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="$PROJECT_ROOT/backups/agency-finance_$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

echo "=== Резервная копия: $BACKUP_DIR ==="

# 1. Все файлы проекта (без node_modules, .next, папки backups)
echo "Архив проекта..."
tar -czf "$BACKUP_DIR/project.tar.gz" \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=backups \
  --exclude='*.dump' \
  -C "$(dirname "$PROJECT_ROOT")" \
  "$(basename "$PROJECT_ROOT")"
echo "  -> project.tar.gz"

# 2. Копия .env (если есть) — для восстановления настроек
if [ -f .env ]; then
  cp .env "$BACKUP_DIR/.env.backup"
  echo "  -> .env.backup"
fi

# 3. Дамп БД (если есть DATABASE_URL и pg_dump)
if [ -f .env ]; then
  set +e
  export $(grep -v '^#' .env | xargs) 2>/dev/null
  set -e
fi
if [ -n "$DATABASE_URL" ] && command -v pg_dump >/dev/null 2>&1; then
  echo "Дамп базы данных..."
  mkdir -p "$BACKUP_DIR"
  pg_dump "$DATABASE_URL" -Fc -f "$BACKUP_DIR/database.dump" 2>/dev/null && echo "  -> database.dump" || echo "  (ошибка pg_dump — проверьте DATABASE_URL и доступ к БД)"
else
  if [ -z "$DATABASE_URL" ]; then
    echo "  DATABASE_URL не задан — дамп БД пропущен"
  else
    echo "  pg_dump не найден — дамп БД пропущен (установите postgresql-client)"
  fi
fi

echo "=== Готово: $BACKUP_DIR ==="
ls -la "$BACKUP_DIR"
