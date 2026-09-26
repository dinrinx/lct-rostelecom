import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileAttachmentDto {
  @ApiProperty({ example: 'f0000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'dogovor-spbgu-basis-dynamix.pdf' })
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 245_760 })
  size!: number;

  @ApiProperty({ example: 'attachments/2026/09/f0000000-0000-4000-8000-000000000001.pdf' })
  storageKey!: string;

  @ApiProperty({ example: 'c0000000-0000-4000-8000-000000000001' })
  uploadedById!: string;

  @ApiPropertyOptional({ example: 'b3000000-0000-4000-8000-000000000001', nullable: true })
  interactionInstanceId?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  licenseId?: string | null;

  @ApiProperty({ example: '2026-09-20T14:30:00.000Z' })
  createdAt!: string;
}

export class FileDownloadUrlDto {
  @ApiProperty({ example: 'f0000000-0000-4000-8000-000000000001' })
  fileId!: string;

  @ApiProperty({
    example:
      'https://minio.internal/crm-attachments/attachments/2026/09/f0000000-0000-4000-8000-000000000001.pdf?X-Amz-Expires=600&...',
  })
  url!: string;

  @ApiProperty({ example: '2026-09-26T10:10:00.000Z' })
  expiresAt!: string;
}
