import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  503: 'SERVICE_UNAVAILABLE',
};

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

// Единая схема ошибок { code, message, details? } (CLAUDE.md) для ВСЕХ ответов:
// доменные исключения уже приходят в этой форме и проходят как есть; стандартные
// исключения Nest (без code) и ошибки Prisma приводятся к ней, а неожиданные
// сбои возвращают 500 INTERNAL_ERROR без утечки внутренностей (детали — только в лог).
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.normalize(exception);
    response.status(status).json(body);
  }

  private normalize(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      if (typeof raw === 'object' && raw !== null && typeof (raw as ErrorBody).code === 'string') {
        return { status, body: raw as ErrorBody };
      }
      const rawMessage = typeof raw === 'object' && raw !== null ? (raw as { message?: unknown }).message : undefined;
      const message =
        typeof raw === 'string'
          ? raw
          : Array.isArray(rawMessage)
            ? rawMessage.join('; ')
            : String(rawMessage ?? exception.message);
      return { status, body: { code: CODE_BY_STATUS[status] ?? 'HTTP_ERROR', message } };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return this.of(409, 'UNIQUE_CONSTRAINT', 'Запись с такими значениями уже существует');
        case 'P2003':
          return this.of(
            409,
            'FK_CONSTRAINT',
            'Ссылка на несуществующую связанную запись, либо на запись ссылаются другие данные',
          );
        case 'P2025':
          return this.of(404, 'NOT_FOUND', 'Запись не найдена');
        case 'P2000':
        case 'P2006':
        case 'P2007':
        case 'P2009':
        case 'P2011':
        case 'P2012':
        case 'P2020':
          return this.of(400, 'VALIDATION_ERROR', 'Некорректные данные запроса (тип или формат значения)');
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return this.of(400, 'VALIDATION_ERROR', 'Некорректные данные запроса (тип или формат значения)');
    }

    this.logAndHideDetails(exception);
    return this.of(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера');
  }

  // Стектрейс пишем структурно (pino кладёт его в поле err.stack). Исключение —
  // ошибки Prisma: их message содержит аргументы запроса (в них бывают
  // ФИО/email/телефон), поэтому для них логируем только тип и код (152-ФЗ).
  private logAndHideDetails(exception: unknown): void {
    if (!(exception instanceof Error)) {
      this.logger.error(String(exception));
    } else if (exception.name.startsWith('PrismaClient')) {
      const code = (exception as { code?: string }).code;
      this.logger.error(`${exception.name}${code ? ` ${code}` : ''} (детали запроса скрыты)`);
    } else {
      this.logger.error(exception.message, exception.stack);
    }
  }

  private of(status: number, code: string, message: string): { status: number; body: ErrorBody } {
    return { status, body: { code, message } };
  }
}
