import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInteractionStatusDto {
  @ApiProperty({ example: 'b1000000-0000-4000-8000-000000000002' })
  toStatusId!: string;

  @ApiPropertyOptional({ example: 'Договор подписан, переходим к внедрению' })
  comment?: string;
}
