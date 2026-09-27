import 'dotenv/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Тот же DocumentBuilder-конфиг, что и в main.ts — статический экспорт
// OpenAPI JSON для фронта/CI, без реального listen() на порту.
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder().setTitle('CRM ИТ Школа РТК').setVersion('0.0.1').build();
  const document = SwaggerModule.createDocument(app, config);

  const outPath = join(__dirname, '..', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI JSON записан: ${outPath}`);

  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
