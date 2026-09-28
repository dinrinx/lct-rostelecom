import { ApiProperty } from '@nestjs/swagger';

export enum HealthScoreLevelDto {
  RED = 'red',
  YELLOW = 'yellow',
  GREEN = 'green',
}

// Один вуз, прогнанный через HealthScoreService.calculateHealthScore на
// агрегированных данных (ближайшая лицензия, застрявший статус, активность,
// needsReview) — см. reports/health-score/health-score.service.ts.
export class HealthScoreItemDto {
  @ApiProperty({ example: 'a5000000-0000-4000-8000-000000000001' })
  vuzId!: string;

  @ApiProperty({ example: 'СПбГУ' })
  vuzName!: string;

  @ApiProperty({ example: 42, description: '0 (максимальный риск) .. 100 (всё в порядке)' })
  score!: number;

  @ApiProperty({ enum: HealthScoreLevelDto, example: HealthScoreLevelDto.YELLOW })
  level!: HealthScoreLevelDto;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['Лицензия истекает через 5 дн.'],
    description: 'Заранее заготовленные шаблонные причины срабатывания (не текст от ИИ), в порядке проверки условий',
  })
  reasons!: string[];
}
