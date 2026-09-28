import { Body, Controller, Get, Param, Post, Put, Req, UseInterceptors, Patch } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowTemplateVersionDto, WorkflowTemplateWithActiveVersionDto } from './dto/workflow-template.dto';
import { CreateWorkflowTemplateDto, UpdateWorkflowTemplateDto } from './dto/workflow-template-write.dto';
import { UpdateWorkflowGraphDto } from './dto/workflow-graph.dto';
import { InteractionInstanceDto, StatusHistoryEntryDto } from './dto/interaction-instance.dto';
import { CreateInteractionInstanceDto } from './dto/create-interaction-instance.dto';
import { TransitionInteractionInstanceDto } from './dto/transition-interaction-instance.dto';
import { AssignInteractionInstanceDto } from './dto/assign-interaction-instance.dto';
import { UpdateInteractionInstanceDto } from './dto/update-interaction-instance.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleDto } from '../auth/dto/user.dto';
import { CatalogScopeInterceptor, RequestWithCatalogScope } from '../catalogs/catalog-scope.interceptor';

const ANY_ROLE = [UserRoleDto.KAM, UserRoleDto.RUKOVODITEL, UserRoleDto.ADMINISTRATOR] as const;
// Создание инстанса и переход по статусам — действия, а не просмотр: Руководитель
// в этой задаче явно описан только как "видит все инстансы команды", без права
// создавать/переводить за своих КАМов, поэтому в это множество не входит.
const ACTOR_ROLES = [UserRoleDto.KAM, UserRoleDto.ADMINISTRATOR] as const;
// Ручное назначение вуза/ответственного на needsReview-инстанс — явно только
// Руководитель/Админ по формулировке задачи ("назначает вручную rukovoditel/admin"),
// КАМ сюда не входит: он не должен сам себе назначать чужие/ничейные заявки.
const ASSIGNMENT_ROLES = [UserRoleDto.RUKOVODITEL, UserRoleDto.ADMINISTRATOR] as const;

// Определяет пользователя, выполняющего действие (changedById/responsibleUserId
// по умолчанию) — DevRoleGuard уже резолвит currentUserId по email канонического
// dev-пользователя роли (или из Keycloak-токена) для ЛЮБОЙ распознанной роли,
// включая ADMINISTRATOR, так что в норме это поле всегда заполнено; explicit-
// проверка здесь — на случай если guard когда-нибудь начнёт пропускать
// ADMINISTRATOR без identity.
function requireActorId(request: RequestWithCatalogScope): string {
  if (!request.currentUserId) {
    throw new BadRequestException({
      code: 'WORKFLOW_ACTOR_UNKNOWN',
      message: 'Не удалось определить пользователя, выполняющего действие (нет currentUserId)',
    });
  }
  return request.currentUserId;
}

// CatalogScopeInterceptor вычисляет request.catalogScope один раз за запрос —
// та же построчная видимость по University.kamId, что и в catalogs (см.
// workflow.module.ts). Действует на все методы контроллера, включая
// /templates — там req.catalogScope просто не используется.
@ApiTags('workflow')
@Controller('workflow')
@UseInterceptors(CatalogScopeInterceptor)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // Список/создание/редактирование шаблонов — доступ только Администратору
  // (см. docs/backend-plan.md, раздел Admin). @Roles() уже проверяется реальным
  // DevRoleGuard (X-Dev-Role в dev-режиме / Keycloak JWT в остальных) — тем же,
  // что и в catalogs/admin, отдельного шага для RBAC здесь не нужно.
  @Get('templates')
  @ApiOperation({ summary: 'Список шаблонов workflow с активной версией (статусы+переходы)' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'administrator' })
  @ApiOkResponse({ type: WorkflowTemplateWithActiveVersionDto, isArray: true })
  // Чтение шаблона нужно всем ролям (доска и карточка взаимодействия строятся
  // по статусам активной версии); изменять — только Администратору/Руководителю.
  @Roles(...ANY_ROLE)
  getTemplates(): Promise<WorkflowTemplateWithActiveVersionDto[]> {
    return this.workflowService.listTemplates();
  }

  @Post('templates')
  @ApiOperation({ summary: 'Создать шаблон workflow вместе с первой версией (статусы+переходы)' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'administrator' })
  @ApiBody({ type: CreateWorkflowTemplateDto })
  @ApiOkResponse({ type: WorkflowTemplateVersionDto })
  @Roles(UserRoleDto.ADMINISTRATOR)
  createTemplate(@Body() dto: CreateWorkflowTemplateDto): Promise<WorkflowTemplateVersionDto> {
    return this.workflowService.createTemplate(dto);
  }

  @Put('templates/:id')
  @ApiOperation({
    summary:
      'Редактирование шаблона — НЕ мутирует текущую версию, а создаёт новую WorkflowTemplateVersion ' +
      '(isActive=true), предыдущую помечает isActive=false. Существующие InteractionInstance остаются ' +
      'привязаны к своей версии и не переезжают на новую автоматически.',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'administrator' })
  @ApiParam({ name: 'id', example: 'b0000000-0000-4000-8000-000000000001' })
  @ApiBody({ type: UpdateWorkflowTemplateDto })
  @ApiOkResponse({ type: WorkflowTemplateVersionDto })
  @Roles(UserRoleDto.ADMINISTRATOR)
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateWorkflowTemplateDto): Promise<WorkflowTemplateVersionDto> {
    return this.workflowService.updateTemplate(id, dto);
  }

  @Put('templates/:id/graph')
  @ApiOperation({
    summary: 'Заменить граф шаблона целиком (все статусы и переходы одним запросом, в одной транзакции)',
    description:
      'Для экрана-редактора (список/форма): не набор точечных CRUD-вызовов на статус/переход, а один граф. ' +
      'statuses/transitions ссылаются друг на друга по полю id внутри ЭТОГО запроса (client-side ключ узла, ' +
      'не id в БД) — так редактору не нужно сначала создавать статусы, чтобы узнать их серверные id, а потом ' +
      'создавать переходы. Как и PUT /workflow/templates/{id}: НЕ мутирует текущую версию, создаёт новую ' +
      '(isActive=true), предыдущую помечает isActive=false; существующие InteractionInstance остаются на ' +
      'своей версии. migrateInstances не поддерживается — используйте PUT /workflow/templates/{id} для переноса.',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'administrator' })
  @ApiParam({ name: 'id', example: 'b0000000-0000-4000-8000-000000000001' })
  @ApiBody({ type: UpdateWorkflowGraphDto })
  @ApiOkResponse({ type: WorkflowTemplateVersionDto })
  @Roles(UserRoleDto.ADMINISTRATOR)
  updateTemplateGraph(@Param('id') id: string, @Body() dto: UpdateWorkflowGraphDto): Promise<WorkflowTemplateVersionDto> {
    return this.workflowService.updateTemplateGraph(id, dto);
  }

  @Get('template-versions/:id')
  @ApiOperation({ summary: 'Версия шаблона со статусами и переходами' })
  @ApiParam({ name: 'id', example: 'b0000000-0000-4000-8000-000000000002' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiOkResponse({ type: WorkflowTemplateVersionDto })
  @Roles(...ANY_ROLE)
  getTemplateVersionById(@Param('id') id: string): Promise<WorkflowTemplateVersionDto> {
    return this.workflowService.getTemplateVersion(id);
  }

  // Ниже — реальные эндпоинты взаимодействий (InteractionInstance/StatusHistoryEntry).
  // Путь переименован interactions -> instances по явному запросу; список/getById
  // тоже переведены на Prisma в рамках этого же изменения — иначе только что
  // созданные инстансы не были бы видны нигде, кроме нового /transition-эндпоинта.
  @Get('instances')
  @ApiOperation({ summary: 'Список взаимодействий с вузами (видимость по роли — как в catalogs)' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiOkResponse({ type: InteractionInstanceDto, isArray: true })
  @Roles(...ANY_ROLE)
  getInstances(@Req() request: RequestWithCatalogScope): Promise<InteractionInstanceDto[]> {
    return this.workflowService.listInstances(request.catalogScope!);
  }

  @Get('instances/:id')
  @ApiOperation({ summary: 'Взаимодействие по идентификатору' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiParam({ name: 'id', example: 'b3000000-0000-4000-8000-000000000001' })
  @ApiOkResponse({ type: InteractionInstanceDto })
  @Roles(...ANY_ROLE)
  getInstanceById(
    @Param('id') id: string,
    @Req() request: RequestWithCatalogScope,
  ): Promise<InteractionInstanceDto> {
    return this.workflowService.getInstanceById(id, request.catalogScope!);
  }

  // Создание/переход — только КАМ (для своего вуза) и Администратор (без
  // ограничений); Руководитель по этой задаче только просматривает команду.
  @Post('instances')
  @ApiOperation({ summary: 'Создать взаимодействие на активной версии активного шаблона для вуза' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiBody({ type: CreateInteractionInstanceDto })
  @ApiOkResponse({ type: InteractionInstanceDto })
  @Roles(...ACTOR_ROLES)
  createInstance(
    @Body() dto: CreateInteractionInstanceDto,
    @Req() request: RequestWithCatalogScope,
  ): Promise<InteractionInstanceDto> {
    return this.workflowService.createInstance(dto, request.catalogScope!);
  }

  @Patch('instances/:id')
  @ApiOperation({
    summary: 'Точечно обновить ответственного / ИТ-продукт / заметку взаимодействия (без перехода по статусам)',
    description:
      'Все поля необязательны, но хотя бы одно обязательно. Статус здесь менять нельзя (400 WORKFLOW_STATUS_VIA_TRANSITION_ONLY) — ' +
      'только POST /workflow/instances/{id}/transition с проверкой графа переходов. Вуз — PATCH …/assignment. ' +
      'Ответственного меняют Руководитель (в своей команде) и Администратор; заметку и продукт — любая роль в своей зоне видимости.',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'rukovoditel' })
  @ApiParam({ name: 'id', example: 'b3000000-0000-4000-8000-000000000001' })
  @ApiBody({ type: UpdateInteractionInstanceDto })
  @ApiOkResponse({ type: InteractionInstanceDto })
  @Roles(...ANY_ROLE)
  updateInstance(
    @Param('id') id: string,
    @Body() dto: UpdateInteractionInstanceDto,
    @Req() request: RequestWithCatalogScope,
  ): Promise<InteractionInstanceDto> {
    return this.workflowService.updateInstance(id, dto, request.catalogScope!);
  }

  @Patch('instances/:id/assignment')
  @ApiOperation({
    summary: 'Назначить вуз и/или ответственного инстансу без них (needsReview=true из integrations/sync)',
    description:
      'Не мутирует статус/историю — только universityId/responsibleUserId (+пересчитывает needsReview). ' +
      'Хотя бы одно из полей обязательно. Если передан только universityId — ответственным по умолчанию ' +
      'становится кАМ этого вуза (University.kamId), как и при создании инстанса вручную. ' +
      'Руководитель может назначать вуз/ответственного только в пределах своей команды.',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'rukovoditel' })
  @ApiParam({ name: 'id', example: 'b3000000-0000-4000-8000-000000000001' })
  @ApiBody({ type: AssignInteractionInstanceDto })
  @ApiOkResponse({ type: InteractionInstanceDto })
  @Roles(...ASSIGNMENT_ROLES)
  patchAssignInstance(
    @Param('id') id: string,
    @Body() dto: AssignInteractionInstanceDto,
    @Req() request: RequestWithCatalogScope,
  ): Promise<InteractionInstanceDto> {
    return this.workflowService.assignInstance(id, dto, request.catalogScope!);
  }

  // Оставлен для совместимости с фронтом: то же поведение, что у PATCH выше.
  @Put('instances/:id/assignment')
  @ApiOperation({
    deprecated: true,
    summary: 'Назначить вуз и/или ответственного инстансу без них (needsReview=true из integrations/sync)',
    description:
      'Не мутирует статус/историю — только universityId/responsibleUserId (+пересчитывает needsReview). ' +
      'Хотя бы одно из полей обязательно. Если передан только universityId — ответственным по умолчанию ' +
      'становится кАМ этого вуза (University.kamId), как и при создании инстанса вручную. ' +
      'Руководитель может назначать вуз/ответственного только в пределах своей команды.',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'rukovoditel' })
  @ApiParam({ name: 'id', example: 'b3000000-0000-4000-8000-000000000001' })
  @ApiBody({ type: AssignInteractionInstanceDto })
  @ApiOkResponse({ type: InteractionInstanceDto })
  @Roles(...ASSIGNMENT_ROLES)
  assignInstance(
    @Param('id') id: string,
    @Body() dto: AssignInteractionInstanceDto,
    @Req() request: RequestWithCatalogScope,
  ): Promise<InteractionInstanceDto> {
    return this.workflowService.assignInstance(id, dto, request.catalogScope!);
  }

  @Post('instances/:id/transition')
  @ApiOperation({
    summary:
      'Переход в новый статус — проверяется по WorkflowTransition версии этого инстанса (400, если переход ' +
      'не разрешён), пишет append-only StatusHistoryEntry и обновляет currentStatusId. КАМ — только для своих вузов.',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiParam({ name: 'id', example: 'b3000000-0000-4000-8000-000000000001' })
  @ApiBody({ type: TransitionInteractionInstanceDto })
  @ApiOkResponse({ type: InteractionInstanceDto })
  @Roles(...ACTOR_ROLES)
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionInteractionInstanceDto,
    @Req() request: RequestWithCatalogScope,
  ): Promise<InteractionInstanceDto> {
    return this.workflowService.transition(id, dto, requireActorId(request), request.catalogScope!);
  }

  @Get('instances/:id/history')
  @ApiOperation({ summary: 'Вся история переходов по статусам взаимодействия, по возрастанию времени' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiParam({ name: 'id', example: 'b3000000-0000-4000-8000-000000000001' })
  @ApiOkResponse({ type: StatusHistoryEntryDto, isArray: true })
  @Roles(...ANY_ROLE)
  getInstanceHistory(
    @Param('id') id: string,
    @Req() request: RequestWithCatalogScope,
  ): Promise<StatusHistoryEntryDto[]> {
    return this.workflowService.getHistory(id, request.catalogScope!);
  }
}
