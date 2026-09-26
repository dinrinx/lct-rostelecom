# CRM ИТ Школа РТК

Контекст проекта и правила разработки — в CLAUDE.md.
План по шагам и точки синхронизации с фронтом — в docs/backend-plan.md.

## Быстрый старт

Инфраструктура (Postgres, Redis, MinIO, Keycloak):

```bash
cd infra
docker compose up -d
```

Бэкенд:

```bash
cd backend
cp .env.example .env
npm install

npx prisma migrate deploy   # применить миграции
npm run seed                # засеять вендоров/продукты (vendors.xlsx) и демо-вузы/лицензии

npm run start:dev
```

По умолчанию API поднимается на `http://localhost:3000`. Dev-авторизация включена по умолчанию (`AUTH_MODE=dev` в `.env.example`) — роль передаётся заголовком `X-Dev-Role: kam|rukovoditel|administrator`.

## Документация API

- Swagger UI: http://localhost:3000/api/docs
- OpenAPI JSON: http://localhost:3000/api-json

## Проверка стенда

```bash
curl http://localhost:3000/health
```

Ответ `{ "status": "ok", "db": "ok", "redis": "ok", "uptime": ... }` подтверждает, что бэкенд видит Postgres и Redis из `docker compose up`.
