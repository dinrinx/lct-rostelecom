# Перечень использованных библиотек и компонентов

Составлено вручную по `backend/package.json` (актуален на дату написания) и по
факту использования в коде — не автогенерируется командой вида `npm ls`,
поэтому при добавлении новой зависимости в `package.json` эту таблицу нужно
обновить отдельно.

## Backend (`backend/package.json`)

### Основной фреймворк

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `@nestjs/common` | ^12.1.0 | Ядро NestJS — декораторы, DI-контейнер, guard'ы, interceptor'ы, pipes |
| `@nestjs/core` | ^12.1.0 | Рантайм NestJS — bootstrap приложения, модульная система |
| `@nestjs/platform-express` | ^12.1.0 | HTTP-адаптер на Express; тянет за собой `multer` для приёма multipart-файлов (`POST /files/upload`) |
| `@nestjs/cli` (dev) | ^12.0.7 | CLI для сборки/dev-режима (`nest build`, `nest start --watch`) |
| `reflect-metadata` | ^0.2.2 | Полифилл метаданных для декораторов TypeScript — обязателен для DI Nest |
| `rxjs` | ^7.8.2 | Реактивные потоки — interceptor'ы Nest (`ReadCacheInterceptor`, `CacheInvalidationInterceptor`) построены поверх `Observable` |
| `typescript` (dev) | ^6.0.3 | Компилятор, статическая типизация всего backend |
| `ts-node` (dev) | ^10.9.2 | Запуск TypeScript без предварительной сборки — `prisma/seed.ts` и `scripts/sync-error-codes-doc.ts` выполняются так же и в контейнере (`docker-entrypoint.sh`) |

### API-документация

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `@nestjs/swagger` | ^12.0.2 | Генерация OpenAPI/Swagger UI (`/api/docs`, `/api-json`) из DTO-декораторов; источник `openapi.json` для фронта |

### База данных / ORM

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `@prisma/client` | ^6.19.3 | Сгенерированный типобезопасный клиент PostgreSQL — все запросы к БД во всех модулях |
| `prisma` (dev) | ^6.19.3 | CLI: миграции (`migrate deploy`/`migrate diff`), генерация клиента, Prisma Studio |

### Валидация входных данных

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `class-validator` | ^0.15.1 | Декларативная валидация тел запросов и query-параметров (`@IsString`, `@IsEnum` и т.д. на DTO) — глобальный `ValidationPipe` |
| `class-transformer` | ^0.5.1 | Преобразование plain JSON в экземпляры классов DTO перед валидацией (используется `class-validator` и Nest под капотом) |

### Кэш (Redis)

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `cache-manager` | ^7.2.9 | Абстракция кэша поверх Keyv-хранилищ — `AppCacheService` (namespace-кэш `/catalogs/*`, `/dashboard/*`, `/reports/charts`) |
| `@keyv/redis` | ^5.1.6 | Redis-адаптер для `cache-manager`/Keyv, с поддержкой namespace и сброса по префиксу |
| `keyv` | ^5.6.0 | Унифицированный интерфейс key-value хранилища, на котором построен `@keyv/redis` |
| `ioredis` | ^6.0.0 | Низкоуровневый Redis-клиент — `RedisService` (health-check) и прямое соединение, на котором держится Keyv-адаптер |

### Очередь фоновых задач

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `bullmq` | ^6.3.9 | Redis-очередь для асинхронной генерации отчётов (`POST /reports/jobs` → воркер → `GET /reports/export-status/{id}`), чтобы тяжёлые PDF/полные радары не блокировали запрос |

### Файловое хранилище

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `minio` | ^8.0.7 | S3-совместимый клиент — загрузка/presigned-ссылки на вложения (`files`) и сгенерированные экспорты (`reports`); работает и с MinIO, и с Garage (текущее хранилище в `infra/docker-compose.yml`), т.к. оба говорят по S3 API |

### Аутентификация / JWT

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `jose` | ^6.2.12 | Проверка JWT от Keycloak (`AUTH_MODE=keycloak`): `createRemoteJWKSet` + `jwtVerify` против JWKS realm'а. **Осознанный выбор вместо `passport-jwt`/`nestjs-keycloak-connect`** — тот стек тянет за собой Passport-стратегии и собственный жизненный цикл сессии, тогда как здесь нужна ровно одна операция (проверить подпись/claims токена), и `jose` делает это без лишней инфраструктуры вокруг `DevRoleGuard`, который и так является единственным `APP_GUARD` на оба режима (`dev`/`keycloak`) |

### Логирование и метрики

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `nestjs-pino` | ^5.2.1 | Интеграция pino с NestJS — структурные JSON-логи на каждый запрос (метод/путь/статус/время/роль/userId), без ПД в логе (152-ФЗ) |
| `pino` | ^10.3.1 | Сам JSON-логгер (транзитивно требуется `nestjs-pino`, используется и напрямую) |
| `pino-http` | ^11.0.0 | HTTP-middleware pino — автологирование запросов/ответов, которое настраивает `nestjs-pino` |
| `@willsoto/nestjs-prometheus` | ^6.1.1 | Модуль метрик Prometheus для Nest — регистрирует `/metrics`, счётчики/гистограммы через DI |
| `prom-client` | ^15.1.3 | Клиентская библиотека Prometheus (счётчик `http_requests_total`, гистограмма длительности запросов) — на ней построен `@willsoto/nestjs-prometheus` |

### Работа с файлами (импорт/экспорт)

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `exceljs` | ^4.4.0 | Чтение xlsx при импорте вузов (`catalogs/import`) и запись xlsx при экспорте реестра (`reports`) |
| `pdfkit` | ^0.20.2 | Генерация PDF-версии реестра взаимодействий (`GET /reports/interactions/export?format=pdf`) |
| `dejavu-fonts-ttf` | ^2.37.3 | Шрифт DejaVu Sans, встраиваемый в PDF — встроенные PDF-шрифты (Helvetica и т.п.) не поддерживают кириллицу, текст был бы нечитаем |
| `fastest-levenshtein` | ^1.0.16 | Расстояние Левенштейна для фаззи-дедупа названий вузов при импорте (`DUPLICATE_FUZZY` в превью импорта) |

### Инфраструктурное

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `dotenv` | ^18.0.4 | Загрузка переменных окружения из `.env` при локальном запуске (`import 'dotenv/config'` в `main.ts`/`seed.ts`/скриптах) |

### Тестирование

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `jest` (dev) | ^30.5.2 | Тест-раннер — юнит-тесты сервисов (`workflow`, `health-score`, `error-codes`, `all-exceptions.filter`, `read-cache.interceptor`) |
| `ts-jest` (dev) | ^29.4.14 | TypeScript-препроцессор для Jest — тесты пишутся на TS без отдельной сборки |
| `@types/jest` (dev) | ^30.0.0 | Типы для Jest API (`describe`/`it`/`expect`) |

### Типы TypeScript (dev, без рантайм-влияния)

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `@types/node` | ^26.6.3 | Типы Node.js API |
| `@types/express` | ^5.0.6 | Типы Express (нужны для `Request`/`Response` в guard'ах, middleware, интерцепторах) |
| `@types/multer` | ^2.2.0 | Типы для `multer` (см. `@nestjs/platform-express` выше) — файл из `FileInterceptor` |
| `@types/pdfkit` | ^0.17.6 | Типы для `pdfkit` |

### Транзитивная зависимость, используемая напрямую в коде

| Библиотека | Версия | Назначение |
| --- | --- | --- |
| `multer` | 2.4.0 (транзитивно через `@nestjs/platform-express`) | Разбор multipart/form-data при загрузке файлов (`FileInterceptor('file')` в `files`/`catalogs/import`) — не объявлен отдельной строкой в `package.json`, но напрямую определяет поведение эндпоинтов загрузки |

## Frontend (`frontend/prototype/`)

Прототип — статические `.html`-экраны без сборки и без `package.json`:
зависимостей от npm-пакетов нет вовсе. Всё, что подключено:

| Компонент | Что это | Назначение |
| --- | --- | --- |
| `_ds/…/​_ds_bundle.js` | Собранный бандл внутренней дизайн-системы (не публичный npm-пакет) | UI-компоненты (кнопки, инпуты и т.д.), токены цвета/типографики |
| `support.js` | Собственный код прототипа | Харнесс для рендера `.dc.html`-экранов (загрузка пропсов, `sendPrompt` и т.п.) |
| `crm-data.js` | Собственный код прототипа | Клиент API (`fetch` к backend) + демо-фикстуры на случай недоступности API — см. `docs/backend-plan.md` |
| `serve.py` | Скрипт на Python (стандартная библиотека, без пакетов) | Локальный статический сервер прототипа с `Cache-Control: no-store`, чтобы браузер не кэшировал экраны при разработке |

## Инфраструктура (не npm-пакеты, но часть стека — для полноты см. `docs/architecture.md`)

| Компонент | Версия/образ | Назначение |
| --- | --- | --- |
| PostgreSQL | `postgres:16` | Основная БД |
| Redis | `redis:7` | Кэш (`cache-manager`/`@keyv/redis`) и очередь (`bullmq`) |
| Garage | `dxflrs/garage:v1.0.1` | S3-совместимое хранилище вложений/экспортов (клиент — `minio`, см. выше); выбран вместо `minio/minio` (закрыт на Docker Hub без логина) и `scality/s3server` (только `linux/amd64`, на Apple Silicon шёл через эмуляцию) — собирается нативно под arm64 и amd64 |
| Keycloak | `quay.io/keycloak/keycloak:26.0` | OIDC-провайдер для `AUTH_MODE=keycloak` (проверка через `jose`, см. выше) |
