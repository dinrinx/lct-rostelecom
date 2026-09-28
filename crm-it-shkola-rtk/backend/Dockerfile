# Один образ на build+runtime, без multi-stage-обрезки node_modules: seed
# (prisma/seed.ts) запускается через ts-node и импортирует код из src/
# (../src/cache/caches — переиспользует сброс Redis-кэша после пересева), так
# что рантайму всё равно нужны src/, TypeScript и ts-node в devDependencies.
# Для хакатон-стенда это осознанный компромисс: чуть тяжелее образ, зато
# «собери и запусти» без отдельной сборки CLI-инструментов начинки.
#
# node:24-alpine, а не node:24-slim/Debian: тот же выбор, что уже сделан для
# infra/garage/init (см. соседний Dockerfile). Отдельный apk-пакет openssl
# НЕ ставим: в самом node:24-alpine уже есть /usr/lib/libssl.so.3 (Node сам
# слинкован с OpenSSL 3.x) — этого достаточно движку Prisma, собранному под
# linux-musl-openssl-3.0.x (см. prisma/schema.prisma). Лишний apk add — это
# ещё один сетевой поход во внешний реестр пакетов на этапе сборки.
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# generate ДО build: dist/ импортирует типы @prisma/client, которых не будет
# без предварительной генерации клиента по prisma/schema.prisma.
RUN npx prisma generate
RUN npm run build

COPY scripts/docker-entrypoint.sh scripts/seed-if-empty.cjs ./scripts/
RUN chmod +x ./scripts/docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

# node:24-alpine уже содержит непривилегированного пользователя "node" —
# entrypoint (миграции/seed/старт) не требует root.
RUN chown -R node:node /app
USER node

# Тот же /health, что видит внешний мониторинг (см. docker-compose.yml) —
# без curl/wget в образе: у Node 24 есть глобальный fetch.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
