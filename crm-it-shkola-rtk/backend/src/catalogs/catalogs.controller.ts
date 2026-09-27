import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CatalogsService } from './catalogs.service';
import { CatalogScopeInterceptor, RequestWithCatalogScope } from './catalog-scope.interceptor';
import { UniversityImportService } from './import/university-import.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleDto } from '../auth/dto/user.dto';
import { CreateVendorDto, UpdateVendorDto, VendorDto } from './dto/vendor.dto';
import { CreateItDirectionDto, ItDirectionDto, UpdateItDirectionDto } from './dto/it-direction.dto';
import { CreateItProductDto, ItProductDto, UpdateItProductDto } from './dto/it-product.dto';
import {
  CreateUniversityDto,
  ReassignUniversityResponsibleDto,
  UniversityDto,
  UpdateUniversityDto,
} from './dto/university.dto';
import {
  CreateResponsiblePersonDto,
  ResponsiblePersonDto,
  UpdateResponsiblePersonDto,
} from './dto/responsible-person.dto';
import { CreateLicenseDto, LicenseDto, UpdateLicenseDto } from './dto/license.dto';
import { CommitImportDto, ImportColumnMappingDto, ImportJobDto, ImportPreviewResultDto } from './dto/import-job.dto';

// Пагинация одинакова для всех списков: query-параметры page/pageSize,
// тело ответа остаётся тем же массивом DTO (форма зафиксирована в Swagger
// на шаге 0.4 и фронт уже на неё смотрит), а общее количество записей до
// пагинации передаётся в заголовке ответа X-Total-Count.
const PAGE_QUERY = { name: 'page', required: false, example: 1 } as const;
const PAGE_SIZE_QUERY = { name: 'pageSize', required: false, example: 20 } as const;
const TOTAL_COUNT_HEADER = {
  'X-Total-Count': { description: 'Общее количество записей без учёта пагинации', schema: { type: 'integer' } },
};
const ANY_ROLE = [UserRoleDto.KAM, UserRoleDto.RUKOVODITEL, UserRoleDto.ADMINISTRATOR] as const;

// CatalogScopeInterceptor считает видимость (какие kamId видны текущему
// пользователю) один раз за запрос и кладёт в request.catalogScope — используется
// эндпоинтами вузов/лицензий/ответственных для построчной RBAC-фильтрации.
@ApiTags('catalogs')
@Controller('catalogs')
@UseInterceptors(CatalogScopeInterceptor)
export class CatalogsController {
  constructor(
    private readonly catalogsService: CatalogsService,
    private readonly universityImportService: UniversityImportService,
  ) {}

  // --- Вендоры (глобальный справочник, без построчных ограничений) --------

  @Get('vendors')
  @Roles(...ANY_ROLE)
  @ApiOperation({ summary: 'Список вендоров каталога (с пагинацией)' })
  @ApiQuery(PAGE_QUERY)
  @ApiQuery(PAGE_SIZE_QUERY)
  @ApiOkResponse({ type: VendorDto, isArray: true, headers: TOTAL_COUNT_HEADER })
  async getVendors(
    @Res({ passthrough: true }) res: Response,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<VendorDto[]> {
    const { items, total } = await this.catalogsService.listVendors(page, pageSize);
    res.setHeader('X-Total-Count', String(total));
    return items;
  }

  @Get('vendors/:id')
  @Roles(...ANY_ROLE)
  @ApiOperation({ summary: 'Вендор по идентификатору' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: VendorDto })
  getVendorById(@Param('id') id: string): Promise<VendorDto> {
    return this.catalogsService.getVendorById(id);
  }

  @Post('vendors')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Создать вендора' })
  @ApiBody({ type: CreateVendorDto })
  @ApiOkResponse({ type: VendorDto })
  createVendor(@Body() dto: CreateVendorDto): Promise<VendorDto> {
    return this.catalogsService.createVendor(dto);
  }

  @Put('vendors/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Обновить вендора' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateVendorDto })
  @ApiOkResponse({ type: VendorDto })
  updateVendor(@Param('id') id: string, @Body() dto: UpdateVendorDto): Promise<VendorDto> {
    return this.catalogsService.updateVendor(id, dto);
  }

  @Delete('vendors/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить вендора' })
  @ApiParam({ name: 'id' })
  deleteVendor(@Param('id') id: string): Promise<void> {
    return this.catalogsService.deleteVendor(id);
  }

  // --- ИТ-направления (глобальный справочник) -------------------------------

  @Get('it-directions')
  @Roles(...ANY_ROLE)
  @ApiOperation({ summary: 'Список ИТ-направлений (с пагинацией)' })
  @ApiQuery(PAGE_QUERY)
  @ApiQuery(PAGE_SIZE_QUERY)
  @ApiOkResponse({ type: ItDirectionDto, isArray: true, headers: TOTAL_COUNT_HEADER })
  async getItDirections(
    @Res({ passthrough: true }) res: Response,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ItDirectionDto[]> {
    const { items, total } = await this.catalogsService.listItDirections(page, pageSize);
    res.setHeader('X-Total-Count', String(total));
    return items;
  }

  @Post('it-directions')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Создать ИТ-направление' })
  @ApiBody({ type: CreateItDirectionDto })
  @ApiOkResponse({ type: ItDirectionDto })
  createItDirection(@Body() dto: CreateItDirectionDto): Promise<ItDirectionDto> {
    return this.catalogsService.createItDirection(dto);
  }

  @Put('it-directions/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Обновить ИТ-направление' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateItDirectionDto })
  @ApiOkResponse({ type: ItDirectionDto })
  updateItDirection(@Param('id') id: string, @Body() dto: UpdateItDirectionDto): Promise<ItDirectionDto> {
    return this.catalogsService.updateItDirection(id, dto);
  }

  @Delete('it-directions/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить ИТ-направление' })
  @ApiParam({ name: 'id' })
  deleteItDirection(@Param('id') id: string): Promise<void> {
    return this.catalogsService.deleteItDirection(id);
  }

  // --- ИТ-продукты (глобальный справочник) ------------------------------

  @Get('it-products')
  @Roles(...ANY_ROLE)
  @ApiOperation({ summary: 'Список ИТ-продуктов каталога (с пагинацией и фильтрами)' })
  @ApiQuery(PAGE_QUERY)
  @ApiQuery(PAGE_SIZE_QUERY)
  @ApiQuery({ name: 'itDirectionId', required: false })
  @ApiQuery({ name: 'vendorId', required: false })
  @ApiOkResponse({ type: ItProductDto, isArray: true, headers: TOTAL_COUNT_HEADER })
  async getItProducts(
    @Res({ passthrough: true }) res: Response,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('itDirectionId') itDirectionId?: string,
    @Query('vendorId') vendorId?: string,
  ): Promise<ItProductDto[]> {
    const { items, total } = await this.catalogsService.listItProducts(page, pageSize, itDirectionId, vendorId);
    res.setHeader('X-Total-Count', String(total));
    return items;
  }

  @Post('it-products')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Создать ИТ-продукт' })
  @ApiBody({ type: CreateItProductDto })
  @ApiOkResponse({ type: ItProductDto })
  createItProduct(@Body() dto: CreateItProductDto): Promise<ItProductDto> {
    return this.catalogsService.createItProduct(dto);
  }

  @Put('it-products/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Обновить ИТ-продукт' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateItProductDto })
  @ApiOkResponse({ type: ItProductDto })
  updateItProduct(@Param('id') id: string, @Body() dto: UpdateItProductDto): Promise<ItProductDto> {
    return this.catalogsService.updateItProduct(id, dto);
  }

  @Delete('it-products/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить ИТ-продукт' })
  @ApiParam({ name: 'id' })
  deleteItProduct(@Param('id') id: string): Promise<void> {
    return this.catalogsService.deleteItProduct(id);
  }

  // --- Вузы: построчная видимость по роли ---------------------------------

  @Get('universities')
  @Roles(...ANY_ROLE)
  @ApiOperation({
    summary:
      'Список вузов (с пагинацией). КАМ видит только свои, Руководитель — команду, Администратор — всё',
  })
  @ApiQuery(PAGE_QUERY)
  @ApiQuery(PAGE_SIZE_QUERY)
  @ApiQuery({ name: 'kamId', required: false, description: 'Фильтр по ответственному КАМу' })
  @ApiOkResponse({ type: UniversityDto, isArray: true, headers: TOTAL_COUNT_HEADER })
  async getUniversities(
    @Req() request: RequestWithCatalogScope,
    @Res({ passthrough: true }) res: Response,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('kamId') kamId?: string,
  ): Promise<UniversityDto[]> {
    const { items, total } = await this.catalogsService.listUniversities(request.catalogScope!, page, pageSize, kamId);
    res.setHeader('X-Total-Count', String(total));
    return items;
  }

  @Get('universities/:id')
  @Roles(...ANY_ROLE)
  @ApiOperation({ summary: 'Вуз по идентификатору (403, если вне зоны видимости роли)' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: UniversityDto })
  getUniversityById(@Req() request: RequestWithCatalogScope, @Param('id') id: string): Promise<UniversityDto> {
    return this.catalogsService.getUniversityById(id, request.catalogScope!);
  }

  @Post('universities')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Создать вуз' })
  @ApiBody({ type: CreateUniversityDto })
  @ApiOkResponse({ type: UniversityDto })
  createUniversity(@Body() dto: CreateUniversityDto): Promise<UniversityDto> {
    return this.catalogsService.createUniversity(dto);
  }

  @Put('universities/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Обновить вуз' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateUniversityDto })
  @ApiOkResponse({ type: UniversityDto })
  updateUniversity(@Param('id') id: string, @Body() dto: UpdateUniversityDto): Promise<UniversityDto> {
    return this.catalogsService.updateUniversity(id, dto);
  }

  @Delete('universities/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить вуз' })
  @ApiParam({ name: 'id' })
  deleteUniversity(@Param('id') id: string): Promise<void> {
    return this.catalogsService.deleteUniversity(id);
  }

  @Put('universities/:id/responsible')
  @Roles(UserRoleDto.RUKOVODITEL, UserRoleDto.ADMINISTRATOR)
  @ApiOperation({
    summary:
      'Переназначить/снять КАМа, ответственного за вуз (kamId: null — снять). Руководитель — только в своей команде и по своим вузам',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ReassignUniversityResponsibleDto })
  @ApiOkResponse({ type: UniversityDto })
  reassignUniversityResponsible(
    @Req() request: RequestWithCatalogScope,
    @Param('id') id: string,
    @Body() dto: ReassignUniversityResponsibleDto,
  ): Promise<UniversityDto> {
    return this.catalogsService.reassignUniversityResponsible(id, dto.kamId, request.catalogScope!);
  }

  // --- Ответственные: видимость наследуется от связанного вуза -----------

  @Get('responsible-persons')
  @Roles(...ANY_ROLE)
  @ApiOperation({
    summary:
      'Контактные лица (по вузам и продуктам вендоров). Контакты без вуза видны всем, привязанные к вузу — по видимости роли',
  })
  @ApiQuery(PAGE_QUERY)
  @ApiQuery(PAGE_SIZE_QUERY)
  @ApiQuery({ name: 'universityId', required: false })
  @ApiQuery({ name: 'itProductId', required: false })
  @ApiOkResponse({ type: ResponsiblePersonDto, isArray: true, headers: TOTAL_COUNT_HEADER })
  async getResponsiblePersons(
    @Req() request: RequestWithCatalogScope,
    @Res({ passthrough: true }) res: Response,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('universityId') universityId?: string,
    @Query('itProductId') itProductId?: string,
  ): Promise<ResponsiblePersonDto[]> {
    const { items, total } = await this.catalogsService.listResponsiblePersons(
      request.catalogScope!,
      page,
      pageSize,
      universityId,
      itProductId,
    );
    res.setHeader('X-Total-Count', String(total));
    return items;
  }

  @Get('responsible-persons/:id')
  @Roles(...ANY_ROLE)
  @ApiOperation({ summary: 'Ответственный по идентификатору' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: ResponsiblePersonDto })
  getResponsiblePersonById(
    @Req() request: RequestWithCatalogScope,
    @Param('id') id: string,
  ): Promise<ResponsiblePersonDto> {
    return this.catalogsService.getResponsiblePersonById(id, request.catalogScope!);
  }

  @Post('responsible-persons')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Создать ответственного (контакт вуза и/или продукта вендора)' })
  @ApiBody({ type: CreateResponsiblePersonDto })
  @ApiOkResponse({ type: ResponsiblePersonDto })
  createResponsiblePerson(@Body() dto: CreateResponsiblePersonDto): Promise<ResponsiblePersonDto> {
    return this.catalogsService.createResponsiblePerson(dto);
  }

  @Put('responsible-persons/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Обновить ответственного' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateResponsiblePersonDto })
  @ApiOkResponse({ type: ResponsiblePersonDto })
  updateResponsiblePerson(
    @Param('id') id: string,
    @Body() dto: UpdateResponsiblePersonDto,
  ): Promise<ResponsiblePersonDto> {
    return this.catalogsService.updateResponsiblePerson(id, dto);
  }

  @Delete('responsible-persons/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить ответственного' })
  @ApiParam({ name: 'id' })
  deleteResponsiblePerson(@Param('id') id: string): Promise<void> {
    return this.catalogsService.deleteResponsiblePerson(id);
  }

  // --- Лицензии/договоры: видимость наследуется от вуза -------------------

  @Get('licenses')
  @Roles(...ANY_ROLE)
  @ApiOperation({
    summary:
      'Список лицензий/договоров (источник для радара лицензий и SLA), с пагинацией, фильтрами и видимостью по роли',
  })
  @ApiQuery(PAGE_QUERY)
  @ApiQuery(PAGE_SIZE_QUERY)
  @ApiQuery({ name: 'universityId', required: false })
  @ApiQuery({ name: 'itProductId', required: false })
  @ApiOkResponse({ type: LicenseDto, isArray: true, headers: TOTAL_COUNT_HEADER })
  async getLicenses(
    @Req() request: RequestWithCatalogScope,
    @Res({ passthrough: true }) res: Response,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('universityId') universityId?: string,
    @Query('itProductId') itProductId?: string,
  ): Promise<LicenseDto[]> {
    const { items, total } = await this.catalogsService.listLicenses(
      request.catalogScope!,
      page,
      pageSize,
      universityId,
      itProductId,
    );
    res.setHeader('X-Total-Count', String(total));
    return items;
  }

  @Get('licenses/:id')
  @Roles(...ANY_ROLE)
  @ApiOperation({ summary: 'Лицензия/договор по идентификатору' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: LicenseDto })
  getLicenseById(@Req() request: RequestWithCatalogScope, @Param('id') id: string): Promise<LicenseDto> {
    return this.catalogsService.getLicenseById(id, request.catalogScope!);
  }

  @Post('licenses')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Создать лицензию/договор' })
  @ApiBody({ type: CreateLicenseDto })
  @ApiOkResponse({ type: LicenseDto })
  createLicense(@Body() dto: CreateLicenseDto): Promise<LicenseDto> {
    return this.catalogsService.createLicense(dto);
  }

  @Put('licenses/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @ApiOperation({ summary: 'Обновить лицензию/договор' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateLicenseDto })
  @ApiOkResponse({ type: LicenseDto })
  updateLicense(@Param('id') id: string, @Body() dto: UpdateLicenseDto): Promise<LicenseDto> {
    return this.catalogsService.updateLicense(id, dto);
  }

  @Delete('licenses/:id')
  @Roles(UserRoleDto.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить лицензию/договор' })
  @ApiParam({ name: 'id' })
  deleteLicense(@Param('id') id: string): Promise<void> {
    return this.catalogsService.deleteLicense(id);
  }

  // --- Импорт xlsx вузов с маппингом колонок и дедупом по названию ---

  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Превью xlsx-импорта вузов: маппинг колонок файла на поля University, дедуп/фаззи-матчинг по названию. ' +
      'Без "mapping" в теле — вернёт заголовки колонок файла и предложенный маппинг (rows пустой, ' +
      'isMappingSuggestion=true); с "mapping" — реальный построчный результат: NEW (создастся), ' +
      'DUPLICATE_EXACT (смэтчится), DUPLICATE_FUZZY (похоже, но требует проверки — commit её не применяет).',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'administrator' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        mapping: {
          type: 'string',
          nullable: true,
          description:
            'JSON-массив ImportColumnMappingDto[], например ' +
            '[{"column":"Название вуза","field":"universityName"},{"column":"Регион","field":"region"}]',
        },
      },
    },
  })
  @ApiOkResponse({ type: ImportPreviewResultDto })
  @Roles(UserRoleDto.ADMINISTRATOR)
  previewImport(
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingRaw?: string,
  ): Promise<ImportPreviewResultDto> {
    return this.universityImportService.preview(file, this.parseMapping(mappingRaw));
  }

  @Post('import/commit')
  @ApiOperation({
    summary:
      'Подтвердить и записать результат импорта из preview: NEW создаёт University, DUPLICATE_EXACT ' +
      'обновляет смэтченный, DUPLICATE_FUZZY ("требует проверки") пропускается — не применяется автоматически.',
  })
  @ApiHeader({ name: 'X-Dev-Role', required: false, example: 'administrator' })
  @ApiBody({ type: CommitImportDto })
  @ApiOkResponse({ type: ImportJobDto })
  @Roles(UserRoleDto.ADMINISTRATOR)
  commitImport(@Body() dto: CommitImportDto, @Req() request: RequestWithCatalogScope): Promise<ImportJobDto> {
    if (!request.currentUserId) {
      throw new BadRequestException({
        code: 'IMPORT_ACTOR_UNKNOWN',
        message: 'Не удалось определить пользователя, инициировавшего импорт (нет currentUserId)',
      });
    }
    return this.universityImportService.commit(dto.previewId, request.currentUserId);
  }

  private parseMapping(raw?: string): ImportColumnMappingDto[] | undefined {
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      return parsed as ImportColumnMappingDto[];
    } catch {
      throw new BadRequestException({
        code: 'IMPORT_MAPPING_INVALID',
        message: 'Поле "mapping" должно быть JSON-строкой с массивом {column, field}',
      });
    }
  }
}
