#!/bin/sh
# Продакшен-энтрипоинт контейнера backend: применяет миграции Prisma и (по
# умолчанию только при первом старте на пустой БД) сеет демо-данные, затем
# запускает сервер. Одна команда снаружи (docker compose up -d) — без
# отдельных ручных шагов "зайти в контейнер и прогнать миграции руками".
set -e

echo "[entrypoint] применяю миграции Prisma (prisma migrate deploy)..."
# Небольшой ретрай: healthcheck Postgres в docker-compose уже гарантирует, что
# depends_on дождался готовности, но на некоторых системах есть узкое окно
# между "healthcheck прошёл" и "порт стабильно принимает новые соединения".
attempt=0
until npx prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 5 ]; then
    echo "[entrypoint] prisma migrate deploy не удался после $attempt попыток — выхожу." >&2
    exit 1
  fi
  echo "[entrypoint] миграции не применились (попытка $attempt/5), повтор через 3с..."
  sleep 3
done

# always     — пересевать при КАЖДОМ старте контейнера (сотрёт то, что накопилось
#              на сервере за это время — только для одноразовых демо-прогонов).
# if-empty   — сеять один раз: только если в БД ещё нет ни одного вуза (по умолчанию).
# never      — миграции есть, seed не трогаем вовсе (реальные пользовательские данные).
SEED_MODE="${SEED_ON_START:-if-empty}"
case "$SEED_MODE" in
  always)
    echo "[entrypoint] SEED_ON_START=always — пересеваю демо-данными..."
    npm run seed
    ;;
  never)
    echo "[entrypoint] SEED_ON_START=never — seed пропущен."
    ;;
  if-empty|*)
    echo "[entrypoint] SEED_ON_START=if-empty — проверяю, нужен ли первичный seed..."
    node ./scripts/seed-if-empty.cjs
    ;;
esac

echo "[entrypoint] запускаю сервер..."
exec node dist/main.js
