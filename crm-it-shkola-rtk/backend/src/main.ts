import 'dotenv/config';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildErrorCodesMarkdown } from './common/error-codes';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { createValidationPipe } from './common/validation';

// Дефолт — те же dev-порты, что уже прописаны как redirectUris в
// infra/keycloak/realm-export.json (5173 vite, 4200 angular, 3000, 8081) —
// фронт открывает браузер именно с одного из них, не с origin бэкенда.
// 8123 — статический прототип frontend/prototype (python3 serve.py).
// CORS_ORIGINS в .env переопределяет список, если порт фронта другой.
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4200',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:8123',
  'http://127.0.0.1:8123',
];

function resolveCorsOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS;
  if (!fromEnv) {
    return DEFAULT_CORS_ORIGINS;
  }
  return fromEnv
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap() {
  // bufferLogs: всё, что Nest пишет при старте, уйдёт уже через pino в JSON.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(createValidationPipe());

  // Без этого браузер блокирует все fetch() фронта к бэкенду на другом origin —
  // preflight (OPTIONS) на X-Dev-Role/Authorization иначе даже не отвечает.
  app.enableCors({
    origin: resolveCorsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Dev-Role', 'X-Dev-User-Id'],
    exposedHeaders: ['X-Total-Count'],
  });

  const config = new DocumentBuilder()
    .setTitle('CRM ИТ Школа РТК')
    .setVersion('0.0.1')
    .setDescription(
      'Любая ошибка API возвращается в единой форме `{ code, message, details? }` — независимо от эндпоинта ' +
        '(см. AllExceptionsFilter). Полный список `code`, их HTTP-статусов и рекомендаций по обработке в UI:\n\n' +
        buildErrorCodesMarkdown(),
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api-json' });

  // Явно 0.0.0.0, а не только дефолт Node (который и так слушает все интерфейсы,
  // но неявно) — чтобы в контейнере/на сервере сервис гарантированно был
  // доступен по внешнему адресу, а не только с localhost внутри хоста.
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
