import { FileAttachmentDto, FileDownloadUrlDto } from '../dto/file-attachment.dto';

export const FILE_ATTACHMENT_FIXTURES: FileAttachmentDto[] = [
  {
    id: 'f0000000-0000-4000-8000-000000000001',
    fileName: 'dogovor-spbgu-basis-dynamix.pdf',
    mimeType: 'application/pdf',
    size: 245_760,
    storageKey: 'attachments/2026/09/f0000000-0000-4000-8000-000000000001.pdf',
    uploadedById: 'c0000000-0000-4000-8000-000000000001',
    interactionInstanceId: 'b3000000-0000-4000-8000-000000000001',
    licenseId: null,
    createdAt: '2026-09-20T14:30:00.000Z',
  },
];

export const FILE_DOWNLOAD_URL_FIXTURE: FileDownloadUrlDto = {
  fileId: FILE_ATTACHMENT_FIXTURES[0].id,
  url: 'https://minio.internal/crm-attachments/attachments/2026/09/f0000000-0000-4000-8000-000000000001.pdf?X-Amz-Expires=600&...',
  expiresAt: '2026-09-26T10:10:00.000Z',
};
