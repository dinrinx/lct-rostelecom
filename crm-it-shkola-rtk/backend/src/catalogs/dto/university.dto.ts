import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';

export class UniversityDto {
  @ApiProperty({ example: 'a3f0c2f0-2222-4a11-9a11-000000000010' })
  id!: string;

  @ApiProperty({ example: 'СПбГУ (демо)' })
  name!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  inn?: string | null;

  @ApiPropertyOptional({ example: 'демо-регион' })
  region?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  website?: string | null;

  @ApiPropertyOptional({ example: 'a3f0c2f0-7777-4a11-9a11-000000000060', nullable: true })
  kamId?: string | null;
}

export class CreateUniversityDto extends OmitType(UniversityDto, ['id'] as const) {}

export class UpdateUniversityDto extends PartialType(CreateUniversityDto) {}

// ВАЖНО: форма изменена — kamId теперь nullable (было string). null снимает
// ответственного с вуза ("удалить"); нужно было явно поддержать это действие
// в RBAC-задаче (Руководитель может "менять/удалять/назначать" ответственного).
export class ReassignUniversityResponsibleDto {
  @ApiProperty({
    example: 'c0000000-0000-4000-8000-000000000001',
    description: 'Новый КАМ, ответственный за вуз; null — снять ответственного',
    nullable: true,
  })
  kamId!: string | null;
}
