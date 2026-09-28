import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { PrometheusModule, makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { HTTP_REQUESTS_TOTAL, HTTP_REQUEST_DURATION, HttpMetricsMiddleware } from './http-metrics.middleware';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      controller: MetricsController,
      defaultMetrics: { enabled: true },
    }),
  ],
  providers: [
    makeCounterProvider({
      name: HTTP_REQUESTS_TOTAL,
      help: 'Количество HTTP-запросов по методу, шаблону маршрута и статусу ответа',
      labelNames: ['method', 'route', 'status'],
    }),
    makeHistogramProvider({
      name: HTTP_REQUEST_DURATION,
      help: 'Длительность обработки HTTP-запросов, секунды',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    }),
    HttpMetricsMiddleware,
  ],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpMetricsMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
