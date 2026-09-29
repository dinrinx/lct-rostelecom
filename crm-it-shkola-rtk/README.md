# CRM ИТ Школа РТК

Архитектура и функциональное описание — в docs/architecture.md.
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
npm run seed                # вендоры/продукты из vendors.xlsx + демо-данные (те же id, что в прототипе фронта)

npm run start:dev
```

По умолчанию API поднимается на `http://localhost:3000`. Dev-авторизация включена по умолчанию (`AUTH_MODE=dev` в `.env.example`) — роль передаётся заголовком `X-Dev-Role: kam|rukovoditel|administrator`.

Нужен Node.js 20+ (NestJS 12).

## Прототип фронта на живом API

Прототип (`frontend/prototype`) — статические HTML, отдельной сборки нет. Бэкенд отдаёт CORS, так что
страницы можно открыть прямо с диска (`CRM.dc.html` — кабинет КАМа/руководителя, `Admin.dc.html` — админка)
или раздать любым статическим сервером:

```bash
cd frontend/prototype
python3 serve.py
```

`serve.py` — обычный статический сервер, но с `Cache-Control: no-store`: экраны прототипа подгружаются
через `fetch`, и с `python3 -m http.server` браузер показывает их старые версии после правок.

и открыть http://localhost:8123/CRM.dc.html. Клиент `crm-data.js` ходит в `http://localhost:3000` (режим `auto`):
если API недоступен, страницы работают на встроенных демо-фикстурах. Индикатор источника данных — плашка
«API/демо» в админке и `CRM.source` в консоли браузера.

## Документация API

- Swagger UI: http://localhost:3000/api/docs
- OpenAPI JSON: http://localhost:3000/api-json

## Проверка стенда

```bash
curl http://localhost:3000/health
```

Ответ `{ "status": "ok", "db": "ok", "redis": "ok", "uptime": ... }` подтверждает, что бэкенд видит Postgres и Redis из `docker compose up`.

- `GET /health` — добавлено поле `keycloak`.
