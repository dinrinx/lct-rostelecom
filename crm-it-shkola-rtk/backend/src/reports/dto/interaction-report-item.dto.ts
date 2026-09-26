import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowPhaseDto } from '../../workflow/dto/workflow-status.dto';

// Денормализованная строка реестра взаимодействий для фильтруемого отчёта —
// собирает данные InteractionInstance + University + ItProduct + WorkflowStatus + User
// в одну плоскую форму, удобную для таблицы и экспорта.
export class InteractionReportItemDto {
  @ApiProperty({ example: 'b3000000-0000-4000-8000-000000000001' })
  interactionInstanceId!: string;

  @ApiProperty({ example: 'a5000000-0000-4000-8000-000000000001' })
  universityId!: string;

  @ApiProperty({ example: 'СПбГУ (демо)' })
  universityName!: string;

  @ApiPropertyOptional({ example: 'a1000000-0000-4000-8000-000000000001', nullable: true })
  itDirectionId?: string | null;

  @ApiPropertyOptional({ example: 'Импортированные продукты (реестр вендоров)', nullable: true })
  itDirectionName?: string | null;

  @ApiPropertyOptional({ example: 'a3000000-0000-4000-8000-000000000001', nullable: true })
  itProductId?: string | null;

  @ApiPropertyOptional({ example: 'Базис Dynamix', nullable: true })
  itProductName?: string | null;

  @ApiProperty({ example: 'b1000000-0000-4000-8000-000000000002' })
  currentStatusId!: string;

  @ApiProperty({ example: 'Согласование договора' })
  currentStatusName!: string;

  @ApiProperty({ enum: WorkflowPhaseDto, example: WorkflowPhaseDto.CONTRACTING })
  currentPhase!: WorkflowPhaseDto;

  @ApiProperty({ example: 'c0000000-0000-4000-8000-000000000001' })
  responsibleUserId!: string;

  @ApiProperty({ example: 'Иванова Мария Сергеевна' })
  responsibleUserName!: string;

  @ApiProperty({ example: '2026-09-01T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-20T14:30:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ example: 12, description: 'Сколько дней взаимодействие находится в текущем статусе' })
  daysInCurrentStatus!: number;

  @ApiProperty({ example: false, description: 'Превышен ли SLA-порог для текущего статуса' })
  isOverdue!: boolean;
}

export class InteractionsReportExportDto {
  @ApiProperty({ example: 'xlsx', enum: ['xls', 'xlsx', 'pdf'] })
  format!: 'xls' | 'xlsx' | 'pdf';

  @ApiProperty({ example: 'reestr-vzaimodeystviy-2026-09-26.xlsx' })
  fileName!: string;

  @ApiProperty({
    example: 'https://minio.internal/crm-exports/reestr-vzaimodeystviy-2026-09-26.xlsx?X-Amz-Expires=600&...',
  })
  url!: string;

  @ApiProperty({ example: '2026-09-26T10:00:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ example: 3 })
  rowCount!: number;
}
