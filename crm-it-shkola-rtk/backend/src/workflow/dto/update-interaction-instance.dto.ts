import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

// Поля взаимодействия, которые можно править точечно, не проводя переход по
// статусам. Статус (currentStatusId), версия шаблона и вуз сюда НЕ входят:
// статус меняется только через POST /workflow/instances/{id}/transition (там
// проверяется граф WorkflowTransition и пишется история), вуз — через
// PATCH /workflow/instances/{id}/assignment.
export class InteractionInstanceEditableDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'c0000000-0000-4000-8000-000000000001',
    description: 'Новый ответственный КАМ. Только Руководитель (в своей команде) и Администратор',
  })
  responsibleUserId!: string;

  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @ApiProperty({ example: 'a3000000-0000-4000-8000-000000000001', nullable: true, description: 'null — снять продукт' })
  itProductId!: string | null;

  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  @ApiProperty({ example: 'Ждём подпись ректора до конца месяца', nullable: true, description: 'null или "" — очистить заметку' })
  note!: string | null;
}

// Все поля необязательны, но хотя бы одно должно быть передано (иначе 400).
export class UpdateInteractionInstanceDto extends PartialType(InteractionInstanceEditableDto) {}
