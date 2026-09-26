# CRM ИТ Школа РТК — контекст для Claude Code

Хакатон-кейс (ЛЦТ), дедлайн 29.09.2026 23:59. CRM автоматизирует цикл взаимодействия ИТ Школы РТК с вузами: статусы, лицензии, отчёты, интеграции с LMS/сайтом.

## Роли

КАМ (свои вузы) → Руководитель (своя команда, переназначает ответственных) → Администратор (каталоги, workflow-шаблоны, пользователи). RBAC на уровне запросов, не только UI.

## Стек (не менять без явного запроса)

NestJS + TypeScript, Prisma + PostgreSQL, Redis (кэш + BullMQ под отчёты), MinIO (S3-совместимое хранилище файлов), Keycloak (OIDC), Docker Compose, Swagger (@nestjs/swagger).

## Ключевые сущности

University, ItDirection, ItProduct, Vendor, ResponsiblePerson, License/Contract, WorkflowTemplate+Version, WorkflowStatus (с полем `phase` — 7 CLM-макростадий), WorkflowTransition, InteractionInstance (привязан к конкретной версии шаблона), StatusHistoryEntry (append-only), FileAttachment, User, ImportJob, AuditLog.

## Killer-фича

Радар лицензий и SLA: подсветка лицензий, истекающих в ближайшие 60/30/7 дней, и взаимодействий, зависших на статусе дольше порога. Простые SQL-правила по датам, без ML.

## Обязательные конвенции

- Контракт (Swagger/DTO) — источник истины. Любое изменение формы данных фиксируй явно, не молча.
- Dev-авторизация: заголовок `X-Dev-Role` (kam|rukovoditel|administrator) вместо Keycloak при `AUTH_MODE=dev`.
- Отчёты — асинхронно (очередь), не блокирующим запросом.
- Обновления статусов/данных — через PATCH, без полной перезагрузки сущности.
- Единая схема ошибок: `{ code, message, details? }`.
- Комментарии в коде на сложных местах бизнес-логики, без обфускации.

## Нефункциональные требования

Отклик API < 1с на переходах/фильтрации; 50 параллельных пользователей; 10 параллельных отчётов без деградации.

## Структура репо

`/backend`, `/frontend`, `/infra` (docker-compose, realm-export), `/docs`.

Подробный пошаговый план и точки синхронизации с фронтом — в `docs/backend-plan.md`.
