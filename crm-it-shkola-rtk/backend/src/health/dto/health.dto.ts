import { ApiProperty } from '@nestjs/swagger';

export enum HealthStatusDto {
  OK = 'ok',
  DEGRADED = 'degraded',
}

export enum ConnectionStatusDto {
  OK = 'ok',
  ERROR = 'error',
}

export class HealthDto {
  @ApiProperty({ enum: HealthStatusDto, example: HealthStatusDto.OK })
  status!: HealthStatusDto;

  @ApiProperty({ enum: ConnectionStatusDto, example: ConnectionStatusDto.OK, description: 'Соединение с Postgres (Prisma)' })
  db!: ConnectionStatusDto;

  @ApiProperty({ enum: ConnectionStatusDto, example: ConnectionStatusDto.OK, description: 'Соединение с Redis' })
  redis!: ConnectionStatusDto;

  @ApiProperty({ example: 128.42, description: 'Время работы процесса, секунды' })
  uptime!: number;
}
