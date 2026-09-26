import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';
import { CreateVendorDto, UpdateVendorDto, VendorDto } from './dto/vendor.dto';
import { CreateItDirectionDto, ItDirectionDto, UpdateItDirectionDto } from './dto/it-direction.dto';
import { CreateItProductDto, ItProductDto, UpdateItProductDto } from './dto/it-product.dto';
import {
  CreateUniversityDto,
  ReassignUniversityResponsibleDto,
  UniversityDto,
  UpdateUniversityDto,
} from './dto/university.dto';
import { ResponsiblePersonDto } from './dto/responsible-person.dto';
import { CreateLicenseDto, LicenseDto, UpdateLicenseDto } from './dto/license.dto';
import { CommitImportDto, ImportJobDto, ImportPreviewResultDto } from './dto/import-job.dto';
import {
  IMPORT_JOB_FIXTURE,
  IMPORT_PREVIEW_FIXTURE,
  IT_DIRECTION_FIXTURES,
  IT_PRODUCT_FIXTURES,
  LICENSE_FIXTURES,
  RESPONSIBLE_PERSON_FIXTURES,
  UNIVERSITY_FIXTURES,
  VENDOR_FIXTURES,
} from './fixtures/catalogs.fixtures';

@ApiTags('catalogs')
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  // --- Вендоры -----------------------------------------------------------

  @Get('vendors')
  @ApiOperation({ summary: 'Список вендоров каталога' })
  @ApiOkResponse({ type: VendorDto, isArray: true })
  getVendors(): VendorDto[] {
    return VENDOR_FIXTURES;
  }

  @Get('vendors/:id')
  @ApiOperation({ summary: 'Вендор по идентификатору' })
  @ApiParam({ name: 'id', example: VENDOR_FIXTURES[0].id })
  @ApiOkResponse({ type: VendorDto })
  getVendorById(@Param('id') id: string): VendorDto {
    return VENDOR_FIXTURES.find((vendor) => vendor.id === id) ?? VENDOR_FIXTURES[0];
  }

  @Post('vendors')
  @ApiOperation({ summary: 'Создать вендора' })
  @ApiBody({ type: CreateVendorDto })
  @ApiOkResponse({ type: VendorDto })
  createVendor(@Body() _dto: CreateVendorDto): VendorDto {
    return VENDOR_FIXTURES[0];
  }

  @Put('vendors/:id')
  @ApiOperation({ summary: 'Обновить вендора' })
  @ApiParam({ name: 'id', example: VENDOR_FIXTURES[0].id })
  @ApiBody({ type: UpdateVendorDto })
  @ApiOkResponse({ type: VendorDto })
  updateVendor(@Param('id') id: string, @Body() _dto: UpdateVendorDto): VendorDto {
    return VENDOR_FIXTURES.find((vendor) => vendor.id === id) ?? VENDOR_FIXTURES[0];
  }

  @Delete('vendors/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить вендора' })
  @ApiParam({ name: 'id', example: VENDOR_FIXTURES[0].id })
  deleteVendor(@Param('id') _id: string): void {
    return undefined;
  }

  // --- ИТ-направления ------------------------------------------------------

  @Get('it-directions')
  @ApiOperation({ summary: 'Список ИТ-направлений' })
  @ApiOkResponse({ type: ItDirectionDto, isArray: true })
  getItDirections(): ItDirectionDto[] {
    return IT_DIRECTION_FIXTURES;
  }

  @Post('it-directions')
  @ApiOperation({ summary: 'Создать ИТ-направление' })
  @ApiBody({ type: CreateItDirectionDto })
  @ApiOkResponse({ type: ItDirectionDto })
  createItDirection(@Body() _dto: CreateItDirectionDto): ItDirectionDto {
    return IT_DIRECTION_FIXTURES[0];
  }

  @Put('it-directions/:id')
  @ApiOperation({ summary: 'Обновить ИТ-направление' })
  @ApiParam({ name: 'id', example: IT_DIRECTION_FIXTURES[0].id })
  @ApiBody({ type: UpdateItDirectionDto })
  @ApiOkResponse({ type: ItDirectionDto })
  updateItDirection(@Param('id') id: string, @Body() _dto: UpdateItDirectionDto): ItDirectionDto {
    return IT_DIRECTION_FIXTURES.find((direction) => direction.id === id) ?? IT_DIRECTION_FIXTURES[0];
  }

  @Delete('it-directions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить ИТ-направление' })
  @ApiParam({ name: 'id', example: IT_DIRECTION_FIXTURES[0].id })
  deleteItDirection(@Param('id') _id: string): void {
    return undefined;
  }

  // --- ИТ-продукты -----------------------------------------------------

  @Get('it-products')
  @ApiOperation({ summary: 'Список ИТ-продуктов каталога' })
  @ApiOkResponse({ type: ItProductDto, isArray: true })
  getItProducts(): ItProductDto[] {
    return IT_PRODUCT_FIXTURES;
  }

  @Post('it-products')
  @ApiOperation({ summary: 'Создать ИТ-продукт' })
  @ApiBody({ type: CreateItProductDto })
  @ApiOkResponse({ type: ItProductDto })
  createItProduct(@Body() _dto: CreateItProductDto): ItProductDto {
    return IT_PRODUCT_FIXTURES[0];
  }

  @Put('it-products/:id')
  @ApiOperation({ summary: 'Обновить ИТ-продукт' })
  @ApiParam({ name: 'id', example: IT_PRODUCT_FIXTURES[0].id })
  @ApiBody({ type: UpdateItProductDto })
  @ApiOkResponse({ type: ItProductDto })
  updateItProduct(@Param('id') id: string, @Body() _dto: UpdateItProductDto): ItProductDto {
    return IT_PRODUCT_FIXTURES.find((product) => product.id === id) ?? IT_PRODUCT_FIXTURES[0];
  }

  @Delete('it-products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить ИТ-продукт' })
  @ApiParam({ name: 'id', example: IT_PRODUCT_FIXTURES[0].id })
  deleteItProduct(@Param('id') _id: string): void {
    return undefined;
  }

  // --- Вузы --------------------------------------------------------------

  @Get('universities')
  @ApiOperation({ summary: 'Список вузов' })
  @ApiOkResponse({ type: UniversityDto, isArray: true })
  getUniversities(): UniversityDto[] {
    return UNIVERSITY_FIXTURES;
  }

  @Get('universities/:id')
  @ApiOperation({ summary: 'Вуз по идентификатору' })
  @ApiParam({ name: 'id', example: UNIVERSITY_FIXTURES[0].id })
  @ApiOkResponse({ type: UniversityDto })
  getUniversityById(@Param('id') id: string): UniversityDto {
    return UNIVERSITY_FIXTURES.find((university) => university.id === id) ?? UNIVERSITY_FIXTURES[0];
  }

  @Post('universities')
  @ApiOperation({ summary: 'Создать вуз' })
  @ApiBody({ type: CreateUniversityDto })
  @ApiOkResponse({ type: UniversityDto })
  createUniversity(@Body() _dto: CreateUniversityDto): UniversityDto {
    return UNIVERSITY_FIXTURES[0];
  }

  @Put('universities/:id')
  @ApiOperation({ summary: 'Обновить вуз' })
  @ApiParam({ name: 'id', example: UNIVERSITY_FIXTURES[0].id })
  @ApiBody({ type: UpdateUniversityDto })
  @ApiOkResponse({ type: UniversityDto })
  updateUniversity(@Param('id') id: string, @Body() _dto: UpdateUniversityDto): UniversityDto {
    return UNIVERSITY_FIXTURES.find((university) => university.id === id) ?? UNIVERSITY_FIXTURES[0];
  }

  @Delete('universities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить вуз' })
  @ApiParam({ name: 'id', example: UNIVERSITY_FIXTURES[0].id })
  deleteUniversity(@Param('id') _id: string): void {
    return undefined;
  }

  @Put('universities/:id/responsible')
  @ApiOperation({ summary: 'Переназначить КАМа, ответственного за вуз' })
  @ApiParam({ name: 'id', example: UNIVERSITY_FIXTURES[0].id })
  @ApiBody({ type: ReassignUniversityResponsibleDto })
  @ApiOkResponse({ type: UniversityDto })
  reassignUniversityResponsible(
    @Param('id') id: string,
    @Body() _dto: ReassignUniversityResponsibleDto,
  ): UniversityDto {
    return UNIVERSITY_FIXTURES.find((university) => university.id === id) ?? UNIVERSITY_FIXTURES[0];
  }

  @Get('responsible-persons')
  @ApiOperation({ summary: 'Контактные лица (по вузам и продуктам вендоров)' })
  @ApiOkResponse({ type: ResponsiblePersonDto, isArray: true })
  getResponsiblePersons(): ResponsiblePersonDto[] {
    return RESPONSIBLE_PERSON_FIXTURES;
  }

  // --- Лицензии/договоры -------------------------------------------------

  @Get('licenses')
  @ApiOperation({ summary: 'Список лицензий/договоров (источник для радара лицензий и SLA)' })
  @ApiOkResponse({ type: LicenseDto, isArray: true })
  getLicenses(): LicenseDto[] {
    return LICENSE_FIXTURES;
  }

  @Get('licenses/:id')
  @ApiOperation({ summary: 'Лицензия/договор по идентификатору' })
  @ApiParam({ name: 'id', example: LICENSE_FIXTURES[0].id })
  @ApiOkResponse({ type: LicenseDto })
  getLicenseById(@Param('id') id: string): LicenseDto {
    return LICENSE_FIXTURES.find((license) => license.id === id) ?? LICENSE_FIXTURES[0];
  }

  @Post('licenses')
  @ApiOperation({ summary: 'Создать лицензию/договор' })
  @ApiBody({ type: CreateLicenseDto })
  @ApiOkResponse({ type: LicenseDto })
  createLicense(@Body() _dto: CreateLicenseDto): LicenseDto {
    return LICENSE_FIXTURES[0];
  }

  @Put('licenses/:id')
  @ApiOperation({ summary: 'Обновить лицензию/договор' })
  @ApiParam({ name: 'id', example: LICENSE_FIXTURES[0].id })
  @ApiBody({ type: UpdateLicenseDto })
  @ApiOkResponse({ type: LicenseDto })
  updateLicense(@Param('id') id: string, @Body() _dto: UpdateLicenseDto): LicenseDto {
    return LICENSE_FIXTURES.find((license) => license.id === id) ?? LICENSE_FIXTURES[0];
  }

  @Delete('licenses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить лицензию/договор' })
  @ApiParam({ name: 'id', example: LICENSE_FIXTURES[0].id })
  deleteLicense(@Param('id') _id: string): void {
    return undefined;
  }

  // --- Импорт xlsx с маппингом и дедупом ----------------------------------

  // Превью не пишет в БД — только показывает построчный маппинг и найденные
  // дубли/фаззи-совпадения по названию вуза, чтобы админ подтвердил перед записью.
  @Post('import/preview')
  @ApiOperation({ summary: 'Превью xlsx-импорта: маппинг полей, дедуп/фаззи-матчинг по вузу' })
  @ApiOkResponse({ type: ImportPreviewResultDto })
  previewImport(): ImportPreviewResultDto {
    return IMPORT_PREVIEW_FIXTURE;
  }

  @Post('import/commit')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Подтвердить и записать результат импорта, полученный в превью' })
  @ApiBody({ type: CommitImportDto })
  @ApiOkResponse({ type: ImportJobDto })
  commitImport(@Body() _dto: CommitImportDto): ImportJobDto {
    return IMPORT_JOB_FIXTURE;
  }
}
