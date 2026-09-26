import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResponsiblePersonDto {
  @ApiProperty({ example: 'a3f0c2f0-1111-4a11-9a11-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Иванов Иван Иванович' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'Менеджер по работе с партнёрами' })
  position?: string | null;

  @ApiPropertyOptional({ example: 'ivanov.ii@example.ru' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+7 (900) 111-22-33' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Почта, Чат в ТГ' })
  contactMethod?: string | null;

  @ApiPropertyOptional({ example: 'a3f0c2f0-2222-4a11-9a11-000000000010' })
  universityId?: string | null;

  @ApiPropertyOptional({ example: 'a3f0c2f0-3333-4a11-9a11-000000000020' })
  itProductId?: string | null;
}
