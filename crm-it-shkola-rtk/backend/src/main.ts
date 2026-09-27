import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Прототип фронта открывается как статический HTML (в том числе прямо с диска,
  // Origin: null) и ходит в API с заголовком X-Dev-Role — без CORS браузер
  // блокирует такие запросы. CORS_ORIGINS (через запятую) сужает список источников.
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : true,
    exposedHeaders: ['X-Total-Count'],
  });

  const config = new DocumentBuilder()
    .setTitle('CRM ИТ Школа РТК')
    .setVersion('0.0.1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api-json' });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
