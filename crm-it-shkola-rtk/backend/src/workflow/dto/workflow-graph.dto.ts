import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowPhaseDto } from './workflow-status.dto';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Экран-редактор шаблона работает с графом целиком (список статусов + список
// переходов между ними), а не точечными CRUD-вызовами на каждую сущность —
// поэтому ссылки внутри запроса идут по client-side `id` узла графа, а не по
// order (см. WorkflowStatusInputDto в workflow-template-write.dto.ts — там
// ссылки по order, это для более простого сценария "просто список статусов").
// `id` здесь — ключ, СУЩЕСТВУЮЩИЙ ТОЛЬКО В ПРЕДЕЛАХ ЭТОГО ЗАПРОСА (обычно то,
// что уже сгенерировал редактор на клиенте для узла графа — и для новых
// статусов, и для перенесённых из предыдущей версии); реальные id статусов
// в БД возвращает уже ответ, sourceStatusId/migrateInstances этот эндпоинт
// не поддерживает — только полная замена графа новой версией.
export class GraphStatusInputDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'st-2', description: 'Ключ узла графа в пределах этого запроса (для ссылок из transitions/dependsOnStatusIds)' })
  id!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Согласование договора' })
  name!: string;

  @IsEnum(WorkflowPhaseDto)
  @ApiProperty({ enum: WorkflowPhaseDto, example: WorkflowPhaseDto.CONTRACTING, description: 'Одна из 7 CLM-макростадий — обязательна для каждого статуса' })
  phase!: WorkflowPhaseDto;

  @IsInt()
  @ApiProperty({ example: 2, description: 'Порядок на доске/в списке (не обязан совпадать с топологическим порядком графа)' })
  order!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 21, nullable: true, description: 'Норматив SLA, дней в статусе' })
  slaDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 14, description: 'Минимальная длительность этапа, дней (по умолчанию 0)' })
  minDays?: number;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: false, description: 'Необязательный этап (по умолчанию false)' })
  isOptional?: boolean;

  @IsOptional()
  @IsString({ each: true })
  @IsArray()
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['st-1'],
    description: 'id узлов ИЗ ЭТОГО ЖЕ ЗАПРОСА, после которых может начаться этап. Не указано — пусто (этап ничего не ждёт)',
  })
  dependsOnStatusIds?: string[];
}

export class GraphTransitionInputDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Отправить на согласование' })
  name?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'st-1', description: 'id узла-источника из statuses этого запроса' })
  fromStatusId!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'st-2', description: 'id узла-назначения из statuses этого запроса' })
  toStatusId!: string;
}

export class UpdateWorkflowGraphDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphStatusInputDto)
  @ApiProperty({ type: GraphStatusInputDto, isArray: true })
  statuses!: GraphStatusInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphTransitionInputDto)
  @ApiProperty({ type: GraphTransitionInputDto, isArray: true })
  transitions!: GraphTransitionInputDto[];
}
