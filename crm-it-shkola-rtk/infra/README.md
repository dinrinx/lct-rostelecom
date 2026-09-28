# Продакшен-стенд: docker compose up -d

Поднимает весь бэкенд одной командой на чистой Linux-машине (Docker + Docker
Compose v2): Postgres, Redis, Garage (S3-совместимое хранилище вложений),
Keycloak (realm импортируется автоматически) и сам backend. Миграции Prisma и
первичный seed демо-данных применяются автоматически при первом старте — без
отдельных ручных шагов.

## Запуск

```bash
cd infra
cp .env.example .env
# откройте .env и поменяйте пароли/CORS_ORIGINS — см. раздел ниже
docker compose up -d --build
docker compose ps        # дождитесь, пока все сервисы станут healthy
```

Backend слушает `0.0.0.0:3000` внутри контейнера (см. `backend/src/main.ts`) и
публикуется на хосте на порту из `BACKEND_PORT` (по умолчанию 3000) — то есть
доступен по внешнему адресу сервера, а не только с самой машины:

- Swagger UI: `http://<адрес-сервера>:3000/api/docs`
- Health-check: `http://<адрес-сервера>:3000/health`
- Метрики Prometheus: `http://<адрес-сервера>:3000/metrics`

Первый запуск занимает больше времени: Postgres/Redis/Garage должны стать
healthy, Garage — получить layout и ключ доступа (сервис `storage-init`,
одноразовый), только после этого стартует `backend`, который сам:

1. прогоняет `prisma migrate deploy` (с несколькими попытками на случай, если
   Postgres формально healthy, но ещё не готов принимать новые соединения);
2. сеет демо-данные — **только если в БД ещё нет ни одного вуза** (см.
   `SEED_ON_START` ниже, по умолчанию `if-empty` — безопасно для повторных
   `docker compose up`/рестартов уже работающего стенда, ничего не затирает).

## Перед боевым запуском на реальном сервере

`.env.example` уже рабочий "из коробки" (те же dev-значения, что раньше были
захардкожены в `docker-compose.yml`/`garage.toml`) — стенд поднимется и без
правок. Но это значения из публичного репозитория, известные всем, кто читал
код, поэтому перед тем, как выставить стенд на реальный сервер с публичным
IP, поменяйте в `.env`:

| Переменная | Что это | Как сгенерировать |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | пароль БД | `openssl rand -hex 24` |
| `KEYCLOAK_ADMIN_PASSWORD` | пароль админки Keycloak | `openssl rand -hex 24` |
| `GARAGE_RPC_SECRET` | сетевой ключ узла Garage | `openssl rand -hex 32` |
| `GARAGE_ADMIN_TOKEN` | токен админ-API Garage | `openssl rand -hex 16` |
| `MINIO_ACCESS_KEY` | id S3-ключа | `GK` + `openssl rand -hex 12` (Garage требует именно такой формат) |
| `MINIO_SECRET_KEY` | секрет S3-ключа | `openssl rand -hex 32` |
| `CORS_ORIGINS` | домен/адрес фронтенда | реальный адрес, откуда браузер будет ходить к API — иначе CORS отклонит все запросы |
| `KEYCLOAK_PUBLISH_ADDR` | публиковать ли 8080 наружу | `127.0.0.1`, если фактически используете `AUTH_MODE=dev` (Keycloak браузеру не нужен) |

После смены `GARAGE_RPC_SECRET`/`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` нужен
чистый перезапуск хранилища (старые ключи в уже существующем layout Garage не
испарятся сами): `docker compose down -v storage storage-init && docker compose up -d`.

Postgres/Redis/Garage (порты 5432/6379/3900) публикуются только на
`127.0.0.1` — они нужны исключительно другим контейнерам этого же
docker-compose, выставлять их на весь интернет незачем и небезопасно
(особенно Redis — в этом стенде он без пароля). Наружу (`0.0.0.0`) по
умолчанию смотрят только `backend` (порт из `BACKEND_PORT`) и `keycloak`
(нужен, только если включён `AUTH_MODE=keycloak`).

TLS/HTTPS и обратный прокси (nginx/Caddy/Traefik) этот compose-файл не
настраивает — для реального продакшена перед `backend`/`keycloak` нужен
реверс-прокси с TLS-терминацией; для демо-стенда на защите обычно достаточно
голого HTTP на порту сервера.

## Полезные команды

```bash
docker compose logs -f backend          # логи backend (structured JSON, pino)
docker compose ps                       # статус healthcheck'ов всех сервисов
docker compose exec backend npm run seed        # пересеять вручную (стирает текущие данные!)
docker compose restart backend                  # передеплоить backend без правки .env
docker compose up -d --build backend            # пересобрать backend после изменения кода
docker compose down                     # остановить всё, данные (тома) сохраняются
docker compose down -v                  # остановить и стереть ВСЕ данные (тома)
```

## Частые проблемы

- **`storage-init` перезапускается / `backend` не стартует**: `docker compose logs storage-init` —
  почти всегда это несовпадение `GARAGE_RPC_SECRET` между `storage` и `storage-init`
  (оба берут значение из одного и того же `.env`, но если меняли `.env` уже
  после первого `up`, старый layout Garage мог остаться со старым секретом —
  см. "чистый перезапуск хранилища" выше).
- **`keycloak` долго остаётся `starting`**: это нормально при первом старте
  (импорт realm + прогрев JVM) — `start_period: 30s` в healthcheck уже это
  учитывает, но на слабой машине может понадобиться больше; `docker compose logs keycloak`
  покажет прогресс.
- **Backend видит Postgres/Redis/Garage, но health-check красный**: скорее
  всего, Keycloak ещё не готов, а `AUTH_MODE=keycloak` требует его для
  проверки токенов — либо дождитесь `keycloak` healthy, либо используйте
  `AUTH_MODE=dev` для демо без реального логина.
