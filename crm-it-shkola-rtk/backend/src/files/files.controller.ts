import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { FileAttachmentDto, FileDownloadUrlDto } from './dto/file-attachment.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleDto } from '../auth/dto/user.dto';
import type { RequestWithDevRole } from '../auth/guards/dev-role.guard';

const ANY_ROLE = [UserRoleDto.KAM, UserRoleDto.RUKOVODITEL, UserRoleDto.ADMINISTRATOR] as const;

// См. requireActorId в workflow.controller.ts — тот же случай: DevRoleGuard
// в норме резолвит currentUserId для любой распознанной роли (включая
// ADMINISTRATOR, через email канонического dev-пользователя), но guard формально
// не требует identity именно для ADMINISTRATOR, так что явная проверка нужна.
function requireActorId(request: RequestWithDevRole): string {
  if (!request.currentUserId) {
    throw new BadRequestException({
      code: 'FILE_ACTOR_UNKNOWN',
      message: 'Не удалось определить пользователя, загружающего файл (нет currentUserId)',
    });
  }
  return request.currentUserId;
}

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @ApiOperation({ summary: 'Список файлов, привязанных к взаимодействию или лицензии' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiQuery({ name: 'interactionInstanceId', required: false })
  @ApiQuery({ name: 'licenseId', required: false })
  @ApiOkResponse({ type: FileAttachmentDto, isArray: true })
  @Roles(...ANY_ROLE)
  getFiles(
    @Query('interactionInstanceId') interactionInstanceId?: string,
    @Query('licenseId') licenseId?: string,
  ): Promise<FileAttachmentDto[]> {
    return this.filesService.listFiles(interactionInstanceId, licenseId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Загрузить файл в MinIO (бакет из .env) и создать вложение, вернуть его id' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
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
  @Roles(...ANY_ROLE)
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('interactionInstanceId') interactionInstanceId: string | undefined,
    @Body('licenseId') licenseId: string | undefined,
    @Req() request: RequestWithDevRole,
  ): Promise<FileAttachmentDto> {
    return this.filesService.uploadFile(file, requireActorId(request), interactionInstanceId, licenseId);
  }

  // Отдаёт ссылку на скачивание (относительный путь на сам backend), а не
  // метаданные — для метаданных (fileName/size/mimeType) есть GET /files.
  @Get(':id')
  @ApiOperation({ summary: 'Ссылка на скачивание файла — GET /files/{id}/content' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiParam({ name: 'id', example: 'f0000000-0000-4000-8000-000000000001' })
  @ApiOkResponse({ type: FileDownloadUrlDto })
  @Roles(...ANY_ROLE)
  getFileById(@Param('id') id: string): Promise<FileDownloadUrlDto> {
    return this.filesService.getDownloadUrl(id);
  }

  // Содержимое стримится через backend (не presigned-ссылкой на Garage
  // напрямую — её внутренний Docker-хост недостижим из браузера, см.
  // MinioService.getObjectStream).
  @Get(':id/content')
  @ApiOperation({ summary: 'Содержимое файла' })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'kam' })
  @ApiParam({ name: 'id', example: 'f0000000-0000-4000-8000-000000000001' })
  @ApiProduces('application/octet-stream')
  @Roles(...ANY_ROLE)
  async downloadFileContent(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { stream, size, fileName, mimeType } = await this.filesService.streamFile(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    stream.pipe(res);
  }
}
