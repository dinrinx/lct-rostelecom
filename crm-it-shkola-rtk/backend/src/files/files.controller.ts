import { Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { FileAttachmentDto, FileDownloadUrlDto } from './dto/file-attachment.dto';
import { FILE_ATTACHMENT_FIXTURES, FILE_DOWNLOAD_URL_FIXTURE } from './fixtures/files.fixtures';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @ApiOperation({ summary: 'Список файлов, привязанных к взаимодействию или лицензии' })
  @ApiQuery({ name: 'interactionInstanceId', required: false })
  @ApiQuery({ name: 'licenseId', required: false })
  @ApiOkResponse({ type: FileAttachmentDto, isArray: true })
  getFiles(
    @Query('interactionInstanceId') _interactionInstanceId?: string,
    @Query('licenseId') _licenseId?: string,
  ): FileAttachmentDto[] {
    return FILE_ATTACHMENT_FIXTURES;
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Загрузить файл в MinIO и создать вложение' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        interactionInstanceId: { type: 'string', nullable: true },
        licenseId: { type: 'string', nullable: true },
      },
    },
  })
  @ApiOkResponse({ type: FileAttachmentDto })
  uploadFile(@UploadedFile() _file: any): FileAttachmentDto {
    return FILE_ATTACHMENT_FIXTURES[0];
  }

  @Get(':id')
  @ApiOperation({ summary: 'Метаданные файла по идентификатору' })
  @ApiParam({ name: 'id', example: FILE_ATTACHMENT_FIXTURES[0].id })
  @ApiOkResponse({ type: FileAttachmentDto })
  getFileById(@Param('id') id: string): FileAttachmentDto {
    return FILE_ATTACHMENT_FIXTURES.find((file) => file.id === id) ?? FILE_ATTACHMENT_FIXTURES[0];
  }

  @Get(':id/download-url')
  @ApiOperation({ summary: 'Временная presigned-ссылка на скачивание из MinIO' })
  @ApiParam({ name: 'id', example: FILE_ATTACHMENT_FIXTURES[0].id })
  @ApiOkResponse({ type: FileDownloadUrlDto })
  getDownloadUrl(@Param('id') _id: string): FileDownloadUrlDto {
    return FILE_DOWNLOAD_URL_FIXTURE;
  }
}
