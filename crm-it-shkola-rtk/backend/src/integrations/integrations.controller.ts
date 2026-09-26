import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { OrderDto } from './dto/order.dto';
import { SyncRunDto } from './dto/sync-log.dto';
import { CourseMappingDto, UpsertCourseMappingDto } from './dto/course-mapping.dto';
import {
  COURSE_MAPPING_FIXTURES,
  ORDER_FIXTURES,
  SYNC_RUN_FIXTURES,
} from './fixtures/orders.fixtures';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('orders')
  @ApiOperation({ summary: 'Список заявок, полученных из внешней интеграции (сайт/LMS)' })
  @ApiOkResponse({ type: OrderDto, isArray: true })
  getOrders(): OrderDto[] {
    return ORDER_FIXTURES;
  }

  @Get('orders/:externalId')
  @ApiOperation({ summary: 'Заявка по номеру (внешний «Номер заявки»)' })
  @ApiParam({ name: 'externalId', example: ORDER_FIXTURES[0].externalId })
  @ApiOkResponse({ type: OrderDto })
  getOrderByExternalId(@Param('externalId') externalId: string): OrderDto {
    return ORDER_FIXTURES.find((order) => order.externalId === externalId) ?? ORDER_FIXTURES[0];
  }

  // Webhook приёма заявки от внешней системы (сайт/LMS); тело запроса приходит
  // в исходном виде (см. маппинг в OrderDto), контроллер отдаёт уже нормализованную заявку.
  @Post('orders')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Приём заявки из внешней системы (сайт/LMS)' })
  @ApiBody({ type: OrderDto })
  @ApiOkResponse({ type: OrderDto })
  receiveOrder(@Body() _dto: OrderDto): OrderDto {
    return ORDER_FIXTURES[0];
  }

  // Забирает заявки мок-адаптера, создаёт/обновляет workflow-инстансы;
  // дедуп — по «Номер заявки» (externalId).
  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Забрать заявки и создать/обновить workflow-инстансы без дублей' })
  @ApiOkResponse({ type: SyncRunDto })
  runSync(): SyncRunDto {
    return SYNC_RUN_FIXTURES[0];
  }

  @Get('sync/log')
  @ApiOperation({ summary: 'История запусков синхронизации' })
  @ApiOkResponse({ type: SyncRunDto, isArray: true })
  getSyncLog(): SyncRunDto[] {
    return SYNC_RUN_FIXTURES;
  }

  @Get('course-mapping')
  @ApiOperation({ summary: 'Таблица соответствий «Курс» -> ИТ-направление/ИТ-продукт' })
  @ApiOkResponse({ type: CourseMappingDto, isArray: true })
  getCourseMapping(): CourseMappingDto[] {
    return COURSE_MAPPING_FIXTURES;
  }

  @Post('course-mapping')
  @ApiOperation({ summary: 'Добавить соответствие «Курс» -> ИТ-продукт' })
  @ApiBody({ type: UpsertCourseMappingDto })
  @ApiOkResponse({ type: CourseMappingDto })
  createCourseMapping(@Body() _dto: UpsertCourseMappingDto): CourseMappingDto {
    return COURSE_MAPPING_FIXTURES[0];
  }

  @Put('course-mapping')
  @ApiOperation({ summary: 'Изменить соответствие «Курс» -> ИТ-продукт' })
  @ApiBody({ type: UpsertCourseMappingDto })
  @ApiOkResponse({ type: CourseMappingDto })
  updateCourseMapping(@Body() _dto: UpsertCourseMappingDto): CourseMappingDto {
    return COURSE_MAPPING_FIXTURES[0];
  }
}
