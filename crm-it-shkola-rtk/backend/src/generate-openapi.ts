import 'dotenv/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildErrorCodesMarkdown } from './common/error-codes';

// Тот же DocumentBuilder-конфиг, что и в main.ts — статический экспорт
// OpenAPI JSON для фронта/CI, без реального listen() на порту.
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });

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

  const outPath = join(__dirname, '..', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI JSON записан: ${outPath}`);

  await app.close();
  // Клиенты Redis кэша держат сокеты — одноразовому скрипту нужен явный выход.
  process.exit(process.exitCode ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  process.exit(1);
});
