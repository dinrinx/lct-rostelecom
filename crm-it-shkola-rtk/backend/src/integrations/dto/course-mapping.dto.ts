import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export enum CourseMappingStatusDto {
  MAPPED = 'MAPPED',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
}

// Таблица соответствий «Курс» (свободный текст из внешней заявки) -> ИТ-направление/ИТ-продукт.
// Курсы без совпадения помечаются NEEDS_REVIEW, пока администратор не проставит маппинг вручную.
export class CourseMappingDto {
  @ApiProperty({ example: 'g0000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Базис Dynamix: администрирование СУБД' })
  course!: string;

  @ApiPropertyOptional({ example: 'a1000000-0000-4000-8000-000000000001', nullable: true })
  itDirectionId?: string | null;

  @ApiPropertyOptional({ example: 'a3000000-0000-4000-8000-000000000001', nullable: true })
  itProductId?: string | null;

  @ApiProperty({ enum: CourseMappingStatusDto, example: CourseMappingStatusDto.MAPPED })
  status!: CourseMappingStatusDto;

  @ApiProperty({ example: '2026-09-26T10:00:00.000Z' })
  updatedAt!: string;
}

export class UpsertCourseMappingDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Базис Dynamix: администрирование СУБД' })
  course!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'a3000000-0000-4000-8000-000000000001' })
  itProductId!: string;
}
