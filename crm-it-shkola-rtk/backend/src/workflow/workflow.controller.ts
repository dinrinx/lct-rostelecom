import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { WorkflowTemplateDto, WorkflowTemplateVersionDto } from './dto/workflow-template.dto';
import { CreateWorkflowTemplateDto, UpdateWorkflowTemplateDto } from './dto/workflow-template-write.dto';
import { InteractionInstanceDto, StatusHistoryEntryDto } from './dto/interaction-instance.dto';
import { UpdateInteractionStatusDto } from './dto/update-interaction-status.dto';
import {
  INTERACTION_INSTANCE_FIXTURES,
  STATUS_HISTORY_FIXTURES,
  WORKFLOW_TEMPLATE_FIXTURES,
  WORKFLOW_TEMPLATE_VERSION_FIXTURES,
} from './fixtures/workflow.fixtures';

@ApiTags('workflow')
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('templates')
  @ApiOperation({ summary: 'Список шаблонов workflow' })
  @ApiOkResponse({ type: WorkflowTemplateDto, isArray: true })
  getTemplates(): WorkflowTemplateDto[] {
    return WORKFLOW_TEMPLATE_FIXTURES;
  }

  @Post('templates')
  @ApiOperation({ summary: 'Создать шаблон workflow вместе с первой версией (статусы+переходы)' })
  @ApiBody({ type: CreateWorkflowTemplateDto })
  @ApiOkResponse({ type: WorkflowTemplateVersionDto })
  createTemplate(@Body() _dto: CreateWorkflowTemplateDto): WorkflowTemplateVersionDto {
    return WORKFLOW_TEMPLATE_VERSION_FIXTURES[0];
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Редактирование шаблона — создаёт новую версию (статусы+переходы)' })
  @ApiParam({ name: 'id', example: WORKFLOW_TEMPLATE_FIXTURES[0].id })
  @ApiBody({ type: UpdateWorkflowTemplateDto })
  @ApiOkResponse({ type: WorkflowTemplateVersionDto })
  updateTemplate(@Param('id') _id: string, @Body() _dto: UpdateWorkflowTemplateDto): WorkflowTemplateVersionDto {
    return WORKFLOW_TEMPLATE_VERSION_FIXTURES[0];
  }

  @Get('template-versions/:id')
  @ApiOperation({ summary: 'Версия шаблона со статусами и переходами' })
  @ApiParam({ name: 'id', example: WORKFLOW_TEMPLATE_VERSION_FIXTURES[0].id })
  @ApiOkResponse({ type: WorkflowTemplateVersionDto })
  getTemplateVersionById(@Param('id') id: string): WorkflowTemplateVersionDto {
    return (
      WORKFLOW_TEMPLATE_VERSION_FIXTURES.find((version) => version.id === id) ??
      WORKFLOW_TEMPLATE_VERSION_FIXTURES[0]
    );
  }

  @Get('interactions')
  @ApiOperation({ summary: 'Список взаимодействий с вузами' })
  @ApiOkResponse({ type: InteractionInstanceDto, isArray: true })
  getInteractions(): InteractionInstanceDto[] {
    return INTERACTION_INSTANCE_FIXTURES;
  }

  @Get('interactions/:id')
  @ApiOperation({ summary: 'Взаимодействие по идентификатору' })
  @ApiParam({ name: 'id', example: INTERACTION_INSTANCE_FIXTURES[0].id })
  @ApiOkResponse({ type: InteractionInstanceDto })
  getInteractionById(@Param('id') id: string): InteractionInstanceDto {
    return (
      INTERACTION_INSTANCE_FIXTURES.find((interaction) => interaction.id === id) ??
      INTERACTION_INSTANCE_FIXTURES[0]
    );
  }

  @Patch('interactions/:id/status')
  @ApiOperation({ summary: 'Точечное обновление статуса взаимодействия (без полной перезагрузки сущности)' })
  @ApiParam({ name: 'id', example: INTERACTION_INSTANCE_FIXTURES[0].id })
  @ApiBody({ type: UpdateInteractionStatusDto })
  @ApiOkResponse({ type: InteractionInstanceDto })
  updateInteractionStatus(
    @Param('id') id: string,
    @Body() _dto: UpdateInteractionStatusDto,
  ): InteractionInstanceDto {
    return (
      INTERACTION_INSTANCE_FIXTURES.find((interaction) => interaction.id === id) ??
      INTERACTION_INSTANCE_FIXTURES[0]
    );
  }

  @Get('interactions/:id/history')
  @ApiOperation({ summary: 'Журнал переходов по статусам взаимодействия' })
  @ApiParam({ name: 'id', example: INTERACTION_INSTANCE_FIXTURES[0].id })
  @ApiOkResponse({ type: StatusHistoryEntryDto, isArray: true })
  getInteractionHistory(@Param('id') id: string): StatusHistoryEntryDto[] {
    return STATUS_HISTORY_FIXTURES.filter((entry) => entry.interactionInstanceId === id);
  }
}
