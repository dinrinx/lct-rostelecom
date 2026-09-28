import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowPhaseDto } from './workflow-status.dto';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WorkflowStatusInputDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Согласование договора' })
  name!: string;

  @IsEnum(WorkflowPhaseDto)
  @ApiProperty({ enum: WorkflowPhaseDto, example: WorkflowPhaseDto.CONTRACTING })
  phase!: WorkflowPhaseDto;

  @IsInt()
  @ApiProperty({ example: 2 })
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
  @IsInt({ each: true })
  @IsArray()
  @ApiPropertyOptional({
    type: Number,
    isArray: true,
    example: [1],
    description:
      'order статусов этого запроса, после которых может начаться этап. Не указано — предыдущий по order статус',
  })
  dependsOnOrders?: number[];

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'b1000000-0000-4000-8000-000000000002',
    description:
      'id статуса предыдущей активной версии, продолжением которого является этот статус. Нужен только для migrateInstances',
  })
  sourceStatusId?: string;
}

export class WorkflowTransitionInputDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Отправить на согласование' })
  name?: string;

  @IsInt()
  @ApiProperty({ example: 1, description: 'order статуса-источника среди statuses этого запроса' })
  fromStatusOrder!: number;

  @IsInt()
  @ApiProperty({ example: 2, description: 'order статуса-назначения среди statuses этого запроса' })
  toStatusOrder!: number;
}

// Создание шаблона сразу заводит его первую версию (statuses+transitions).
export class CreateWorkflowTemplateDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Типовой цикл внедрения ИТ-продукта' })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Базовый CLM-шаблон для вузов' })
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStatusInputDto)
  @ApiProperty({ type: WorkflowStatusInputDto, isArray: true })
  statuses!: WorkflowStatusInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionInputDto)
  @ApiProperty({ type: WorkflowTransitionInputDto, isArray: true })
  transitions!: WorkflowTransitionInputDto[];
}

// Правки шаблона версионируемые — PUT не изменяет существующую версию,
// а создаёт новую WorkflowTemplateVersion с обновлённым набором статусов/переходов.
export class UpdateWorkflowTemplateDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Типовой цикл внедрения ИТ-продукта (v3)' })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Добавлен статус приёмки после внедрения' })
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStatusInputDto)
  @ApiProperty({ type: WorkflowStatusInputDto, isArray: true })
  statuses!: WorkflowStatusInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionInputDto)
  @ApiProperty({ type: WorkflowTransitionInputDto, isArray: true })
  transitions!: WorkflowTransitionInputDto[];

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    example: false,
    description:
      'true — перевести взаимодействия предыдущей активной версии на новую (статус ищется по sourceStatusId). ' +
      'По умолчанию false: существующие процессы остаются на своей версии',
  })
  migrateInstances?: boolean;
}
