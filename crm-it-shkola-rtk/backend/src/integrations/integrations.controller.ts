import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { OrderDto } from './dto/order.dto';
import { SyncRunDto } from './dto/sync-log.dto';
import { CourseMappingDto, UpsertCourseMappingDto } from './dto/course-mapping.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleDto } from '../auth/dto/user.dto';
import type { RequestWithDevRole } from '../auth/guards/dev-role.guard';

// Весь модуль — только ADMINISTRATOR (см. docs/backend-plan.md, Integrations:
// "Админ / системный вызов" для sync). RBAC по вузам/КАМам здесь не нужен —
// интеграция работает на уровне всей системы, не отдельного вуза.
@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('orders')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Список заявок, полученных из внешней интеграции (сайт/LMS)',
    description:
      'МОК: читает backend/fixtures/integrations/orders.json вместо реального обращения к внешнему API. ' +
      'Контракт (форма заявки, см. OrderDto) принят самостоятельно по итогам разбора реального экспортного файла от организаторов — ' +
      'в проде здесь был бы HTTP-вызов к сайту/LMS с тем же самым выходным контрактом.',
  })
  @ApiOkResponse({ type: OrderDto, isArray: true })
  getOrders(): Promise<OrderDto[]> {
    return this.integrationsService.getOrders();
  }

  // Забирает заявки мок-адаптера, создаёт/обновляет workflow-инстансы;
  // дедуп — по «Номер заявки» (externalId). Вуз НЕ выводится из заявки —
  // только курс/направление/продукт через course-mapping; каждый созданный
  // инстанс получает needsReview=true, universityId=null, responsibleUserId=null —
  // руководитель/админ назначают вуз и ответственного вручную.
  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Забрать заявки и создать/обновить workflow-инстансы без дублей',
    description:
      'МОК: в реальной интеграции это был бы вызов внешнего API сайта/LMS (см. GET /integrations/orders); ' +
      'здесь синхронизация читает тот же фиктивный адаптер. Заявка не содержит вуза — маппинг заявка→вуз ' +
      'НЕ выполняется автоматически: определяется только направление/продукт (через course-mapping), ' +
      'а вуз и ответственный назначаются вручную (needsReview=true до назначения).',
  })
  @ApiOkResponse({ type: SyncRunDto })
  runSync(@Req() request: RequestWithDevRole): Promise<SyncRunDto> {
    if (!request.currentUserId) {
      throw new BadRequestException({ code: 'CURRENT_USER_REQUIRED', message: 'Не удалось определить текущего пользователя' });
    }
    return this.integrationsService.runSync(request.currentUserId);
  }

  @Get('sync/log')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'История запусков синхронизации' })
  @ApiOkResponse({ type: SyncRunDto, isArray: true })
  getSyncLog(): Promise<SyncRunDto[]> {
    return this.integrationsService.getSyncLog();
  }

  @Get('course-mapping')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Таблица соответствий «Курс» -> ИТ-направление/ИТ-продукт' })
  @ApiOkResponse({ type: CourseMappingDto, isArray: true })
  getCourseMapping(): Promise<CourseMappingDto[]> {
    return this.integrationsService.getCourseMapping();
  }

  @Post('course-mapping')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Добавить соответствие «Курс» -> ИТ-продукт' })
  @ApiBody({ type: UpsertCourseMappingDto })
  @ApiOkResponse({ type: CourseMappingDto })
  createCourseMapping(@Body() dto: UpsertCourseMappingDto): Promise<CourseMappingDto> {
    return this.integrationsService.createCourseMapping(dto);
  }

  @Put('course-mapping')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Изменить соответствие «Курс» -> ИТ-продукт' })
  @ApiBody({ type: UpsertCourseMappingDto })
  @ApiOkResponse({ type: CourseMappingDto })
  updateCourseMapping(@Body() dto: UpsertCourseMappingDto): Promise<CourseMappingDto> {
    return this.integrationsService.updateCourseMapping(dto);
  }
}
