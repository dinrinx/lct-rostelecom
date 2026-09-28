import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { NextFunction, Request, Response } from 'express';
import type { Counter, Histogram } from 'prom-client';

export const HTTP_REQUESTS_TOTAL = 'http_requests_total';
export const HTTP_REQUEST_DURATION = 'http_request_duration_seconds';

// Считает запросы по эндпоинту и статусу. Label route — ШАБЛОН маршрута
// (/catalogs/universities/:id), а не реальный путь: иначе каждый id давал бы
// новый ряд метрик (взрыв кардинальности) и светил бы идентификаторы.
// Middleware, а не interceptor: только он видит и 404 на несуществующие пути,
// и ответы после exception filter (итоговый статус).
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(
    @InjectMetric(HTTP_REQUESTS_TOTAL) private readonly requests: Counter<string>,
    @InjectMetric(HTTP_REQUEST_DURATION) private readonly duration: Histogram<string>,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const stopTimer = this.duration.startTimer();
    res.on('finish', () => {
      // Для несуществующих путей express отдаёт маршрут самого wildcard-middleware — сводим к одному label.
      const matched = req.route?.path && req.route.path !== '/*path';
      const route = matched ? `${req.baseUrl ?? ''}${req.route.path}` : 'unmatched';
      const labels = { method: req.method, route, status: String(res.statusCode) };
      this.requests.inc(labels);
      stopTimer(labels);
    });
    next();
  }
}
