import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import type { Response } from 'express';

// Переопределяем контроллер библиотеки только ради Swagger-описания: логика
// (register.metrics() + Content-Type) остаётся библиотечной.
@ApiTags('health')
@Controller()
export class MetricsController extends PrometheusController {
  @Get()
  @ApiOperation({
    summary: 'Метрики Prometheus: http_requests_total{method,route,status}, длительность запросов, метрики процесса',
    description: 'Формат text/plain (Prometheus exposition). Без авторизации, как принято для scrape; персональных данных нет — только шаблоны маршрутов и счётчики.',
  })
  @ApiProduces('text/plain')
  @ApiOkResponse({ description: 'Метрики в текстовом формате Prometheus' })
  index(@Res({ passthrough: true }) response: Response) {
    return super.index(response);
  }
}
