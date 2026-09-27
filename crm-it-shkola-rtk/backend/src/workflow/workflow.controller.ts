import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowTemplateVersionDto, WorkflowTemplateWithActiveVersionDto } from './dto/workflow-template.dto';
import { CreateWorkflowTemplateDto, UpdateWorkflowTemplateDto } from './dto/workflow-template-write.dto';
import { InteractionInstanceDto, StatusHistoryEntryDto } from './dto/interaction-instance.dto';
import { CreateInteractionInstanceDto } from './dto/create-interaction-instance.dto';
import { TransitionInteractionInstanceDto } from './dto/transition-interaction-instance.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleDto } from '../auth/dto/user.dto';
import type { RequestWithDevRole } from '../auth/guards/dev-role.guard';

const ANY_ROLE = [UserRoleDto.KAM, UserRoleDto.RUKOVODITEL, UserRoleDto.ADMINISTRATOR] as const;

// Определяет пользователя, выполняющего действие (changedById/responsibleUserId
// по умолчанию) — DevRoleGuard уже резолвит currentUserId по email канонического
// dev-пользователя роли (или из Keycloak-токена) для ЛЮБОЙ распознанной роли,
// включая ADMINISTRATOR, так что в норме это поле всегда заполнено; explicit-
// проверка здесь — на случай если guard когда-нибудь начнёт пропускать
// ADMINISTRATOR без identity.
function requireActorId(request: RequestWithDevRole): string {
  if (!request.currentUserId) {
    throw new BadRequestException({
      code: 'WORKFLOW_ACTOR_UNKNOWN',
      message: 'Не удалось определить пользователя, выполняющего действие (нет currentUserId)',
    });
  }
  return request.currentUserId;
}

@ApiTags('workflow')
@Controller('workflow')
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
  @ApiOperation({ summary: 'Список взаимодействий с вузами' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiOkResponse({ type: InteractionInstanceDto, isArray: true })
  @Roles(...ANY_ROLE)
  getInstances(): Promise<InteractionInstanceDto[]> {
    return this.workflowService.listInstances();
  }

  @Get('instances/:id')
  @ApiOperation({ summary: 'Взаимодействие по идентификатору' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiParam({ name: 'id', example: 'b3000000-0000-4000-8000-000000000001' })
  @ApiOkResponse({ type: InteractionInstanceDto })
  @Roles(...ANY_ROLE)
  getInstanceById(@Param('id') id: string): Promise<InteractionInstanceDto> {
    return this.workflowService.getInstanceById(id);
  }

  @Post('instances')
  @ApiOperation({ summary: 'Создать взаимодействие на активной версии активного шаблона для вуза' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiBody({ type: CreateInteractionInstanceDto })
  @ApiOkResponse({ type: InteractionInstanceDto })
  @Roles(...ANY_ROLE)
  createInstance(@Body() dto: CreateInteractionInstanceDto): Promise<InteractionInstanceDto> {
    return this.workflowService.createInstance(dto);
  }

  @Post('instances/:id/transition')
  @ApiOperation({
    summary:
      'Переход в новый статус — проверяется по WorkflowTransition версии этого инстанса (400, если переход ' +
      'не разрешён), пишет append-only StatusHistoryEntry и обновляет currentStatusId.',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiParam({ name: 'id', example: 'b3000000-0000-4000-8000-000000000001' })
  @ApiBody({ type: TransitionInteractionInstanceDto })
  @ApiOkResponse({ type: InteractionInstanceDto })
  @Roles(...ANY_ROLE)
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionInteractionInstanceDto,
    @Req() request: RequestWithDevRole,
  ): Promise<InteractionInstanceDto> {
    return this.workflowService.transition(id, dto, requireActorId(request));
  }

  @Get('instances/:id/history')
  @ApiOperation({ summary: 'Вся история переходов по статусам взаимодействия, по возрастанию времени' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiParam({ name: 'id', example: 'b3000000-0000-4000-8000-000000000001' })
  @ApiOkResponse({ type: StatusHistoryEntryDto, isArray: true })
  @Roles(...ANY_ROLE)
  getInstanceHistory(@Param('id') id: string): Promise<StatusHistoryEntryDto[]> {
    return this.workflowService.getHistory(id);
  }
}
