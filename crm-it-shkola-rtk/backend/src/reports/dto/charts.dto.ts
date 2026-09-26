import { ApiProperty } from '@nestjs/swagger';

export class ChartSlicePointDto {
  @ApiProperty({ example: 'Согласование договора' })
  label!: string;

  @ApiProperty({ example: 4 })
  value!: number;
}

export class ChartTimeSeriesPointDto {
  @ApiProperty({ example: '2026-09-01' })
  date!: string;

  @ApiProperty({ example: 2 })
  value!: number;
}

// 2-3 базовых графика для отчётного дашборда: распределение по статусам (pie),
// динамика новых взаимодействий по времени (line), лицензии по продуктам (bar).
export class ChartsResponseDto {
  @ApiProperty({ type: ChartSlicePointDto, isArray: true })
  statusDistribution!: ChartSlicePointDto[];

  @ApiProperty({ type: ChartTimeSeriesPointDto, isArray: true })
  interactionsOverTime!: ChartTimeSeriesPointDto[];

  @ApiProperty({ type: ChartSlicePointDto, isArray: true })
  licensesByProduct!: ChartSlicePointDto[];
}
