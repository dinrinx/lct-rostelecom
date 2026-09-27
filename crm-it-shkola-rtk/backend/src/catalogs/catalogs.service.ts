import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type {
  ItDirection,
  ItProduct,
  License,
  ResponsiblePerson,
  University,
  Vendor,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRoleDto } from '../auth/dto/user.dto';
import type { CatalogScope } from './catalog-scope.interceptor';
import { VendorDto, CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { ItDirectionDto, CreateItDirectionDto, UpdateItDirectionDto } from './dto/it-direction.dto';
import { ItProductDto, CreateItProductDto, UpdateItProductDto } from './dto/it-product.dto';
import { UniversityDto, CreateUniversityDto, UpdateUniversityDto } from './dto/university.dto';
import {
  ResponsiblePersonDto,
  CreateResponsiblePersonDto,
  UpdateResponsiblePersonDto,
} from './dto/responsible-person.dto';
import { LicenseDto, LicenseStatusDto, CreateLicenseDto, UpdateLicenseDto } from './dto/license.dto';
import { mapPrismaWriteError } from './catalogs.errors';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface Paginated<T> {
  items: T[];
  total: number;
}

// Пагинация одинакова для всех списков каталога: page (с 1), pageSize
// (ограничен MAX_PAGE_SIZE, чтобы не увести один запрос в full-scan).
function normalizePagination(page?: string, pageSize?: string) {
  const parsedPage = Number.parseInt(page ?? '', 10);
  const parsedPageSize = Number.parseInt(pageSize ?? '', 10);

  const normalizedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const normalizedPageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize > 0
      ? Math.min(parsedPageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return {
    skip: (normalizedPage - 1) * normalizedPageSize,
    take: normalizedPageSize,
  };
}

// Построчная видимость вузов (и всего, что к ним привязано — лицензии, ответственные):
// КАМ видит только свои (visibleKamIds = [свой id]), Руководитель — команду
// (visibleKamIds = [id всех его КАМов] + свой), Администратор — всё (null = без
// ограничений). Считается один раз за запрос в CatalogScopeInterceptor.
export function universityWhereForScope(scope: CatalogScope) {
  if (scope.visibleKamIds === null) {
    return {};
  }
  if (scope.includeUnassigned) {
    return { OR: [{ kamId: { in: scope.visibleKamIds } }, { kamId: null }] };
  }
  return { kamId: { in: scope.visibleKamIds } };
}

export function assertUniversityVisible(university: { kamId: string | null }, scope: CatalogScope): void {
  if (scope.visibleKamIds === null) {
    return;
  }
  if (university.kamId && scope.visibleKamIds.includes(university.kamId)) {
    return;
  }
  if (!university.kamId && scope.includeUnassigned) {
    return;
  }
  throw new ForbiddenException({
    code: 'CATALOG_SCOPE_FORBIDDEN',
    message: 'Этот вуз не входит в зону видимости вашей роли',
  });
}

// Для InteractionInstance без вуза вообще (needsReview=true, из интеграции —
// см. integrations/sync): та же политика видимости, что и для University без
// kamId — КАМ не видит (нечего делать без своего вуза), Руководитель/Админ видят
// и разбирают вручную.
export function assertUniversityOrUnassignedVisible(
  university: { kamId: string | null } | null,
  scope: CatalogScope,
): void {
  if (!university) {
    if (scope.visibleKamIds === null || scope.includeUnassigned) {
      return;
    }
    throw new ForbiddenException({
      code: 'CATALOG_SCOPE_FORBIDDEN',
      message: 'Это взаимодействие без назначенного вуза не входит в зону видимости вашей роли',
    });
  }
  assertUniversityVisible(university, scope);
}

// kamId/responsibleUserId — это "ответственный КАМ" по контракту (см. комментарий
// в schema.prisma над University.kamId и InteractionInstance.responsibleUserId);
// без этой проверки ADMINISTRATOR/RUKOVODITEL мог молча назначить ответственным
// пользователя с ролью RUKOVODITEL/ADMINISTRATOR, что ломает семантику построчного
// RBAC (CatalogScopeInterceptor: только КАМы имеют "свои вузы"). Общая для
// University.kamId (catalogs) и InteractionInstance.responsibleUserId (workflow).
export async function assertUserHasKamRole(prisma: PrismaService, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) {
    throw new BadRequestException({
      code: 'KAM_NOT_FOUND',
      message: `Пользователь с id "${userId}" не найден`,
    });
  }
  if (user.role !== UserRoleDto.KAM) {
    throw new BadRequestException({
      code: 'RESPONSIBLE_MUST_BE_KAM',
      message: `Ответственным может быть только пользователь с ролью KAM (у "${userId}" роль ${user.role})`,
    });
  }
}

function toVendorDto(vendor: Vendor): VendorDto {
  return {
    id: vendor.id,
    name: vendor.name,
    contactInfo: vendor.contactInfo,
    contactName: vendor.contactName,
    contactPhone: vendor.contactPhone,
    contactEmail: vendor.contactEmail,
    contactChannel: vendor.contactChannel,
    createdAt: vendor.createdAt.toISOString(),
    updatedAt: vendor.updatedAt.toISOString(),
  };
}

function toItDirectionDto(direction: ItDirection): ItDirectionDto {
  return {
    id: direction.id,
    name: direction.name,
    description: direction.description,
  };
}

function toItProductDto(product: ItProduct): ItProductDto {
  return {
    id: product.id,
    name: product.name,
    itDirectionId: product.itDirectionId,
    vendorId: product.vendorId,
  };
}

function toUniversityDto(university: University): UniversityDto {
  return {
    id: university.id,
    name: university.name,
    inn: university.inn,
    region: university.region,
    website: university.website,
    kamId: university.kamId,
  };
}

function toResponsiblePersonDto(person: ResponsiblePerson): ResponsiblePersonDto {
  return {
    id: person.id,
    fullName: person.fullName,
    position: person.position,
    email: person.email,
    phone: person.phone,
    contactMethod: person.contactMethod,
    universityId: person.universityId,
    itProductId: person.itProductId,
  };
}

function toLicenseDto(license: License): LicenseDto {
  return {
    id: license.id,
    contractNumber: license.contractNumber,
    status: license.status as unknown as LicenseStatusDto,
    seats: license.seats,
    startDate: license.startDate.toISOString(),
    endDate: license.endDate.toISOString(),
    universityId: license.universityId,
    itProductId: license.itProductId,
    createdAt: license.createdAt.toISOString(),
    updatedAt: license.updatedAt.toISOString(),
  };
}

@Injectable()
export class CatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Вендоры -------------------------------------------------------------

  async listVendors(page?: string, pageSize?: string): Promise<Paginated<VendorDto>> {
    const { skip, take } = normalizePagination(page, pageSize);
    const [rows, total] = await Promise.all([
      this.prisma.vendor.findMany({ skip, take, orderBy: { name: 'asc' } }),
      this.prisma.vendor.count(),
    ]);
    return { items: rows.map(toVendorDto), total };
  }

  async getVendorById(id: string): Promise<VendorDto> {
    const vendor = await this.prisma.vendor.findUniqueOrThrow({ where: { id } }).catch((error) => {
      mapPrismaWriteError(error, `Вендор с id "${id}" не найден`);
    });
    return toVendorDto(vendor);
  }

  async createVendor(dto: CreateVendorDto): Promise<VendorDto> {
    const vendor = await this.prisma.vendor.create({ data: dto });
    return toVendorDto(vendor);
  }

  async updateVendor(id: string, dto: UpdateVendorDto): Promise<VendorDto> {
    const vendor = await this.prisma.vendor
      .update({ where: { id }, data: dto })
      .catch((error) => mapPrismaWriteError(error, `Вендор с id "${id}" не найден`));
    return toVendorDto(vendor);
  }

  async deleteVendor(id: string): Promise<void> {
    await this.prisma.vendor
      .delete({ where: { id } })
      .catch((error) => mapPrismaWriteError(error, `Вендор с id "${id}" не найден`));
  }

  // --- ИТ-направления --------------------------------------------------------

  async listItDirections(page?: string, pageSize?: string): Promise<Paginated<ItDirectionDto>> {
    const { skip, take } = normalizePagination(page, pageSize);
    const [rows, total] = await Promise.all([
      this.prisma.itDirection.findMany({ skip, take, orderBy: { name: 'asc' } }),
      this.prisma.itDirection.count(),
    ]);
    return { items: rows.map(toItDirectionDto), total };
  }

  async createItDirection(dto: CreateItDirectionDto): Promise<ItDirectionDto> {
    const direction = await this.prisma.itDirection.create({ data: dto });
    return toItDirectionDto(direction);
  }

  async updateItDirection(id: string, dto: UpdateItDirectionDto): Promise<ItDirectionDto> {
    const direction = await this.prisma.itDirection
      .update({ where: { id }, data: dto })
      .catch((error) => mapPrismaWriteError(error, `ИТ-направление с id "${id}" не найдено`));
    return toItDirectionDto(direction);
  }

  async deleteItDirection(id: string): Promise<void> {
    await this.prisma.itDirection
      .delete({ where: { id } })
      .catch((error) => mapPrismaWriteError(error, `ИТ-направление с id "${id}" не найдено`));
  }

  // --- ИТ-продукты -----------------------------------------------------------

  async listItProducts(
    page?: string,
    pageSize?: string,
    itDirectionId?: string,
    vendorId?: string,
  ): Promise<Paginated<ItProductDto>> {
    const { skip, take } = normalizePagination(page, pageSize);
    const where = {
      ...(itDirectionId ? { itDirectionId } : {}),
      ...(vendorId ? { vendorId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.itProduct.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.prisma.itProduct.count({ where }),
    ]);
    return { items: rows.map(toItProductDto), total };
  }

  async createItProduct(dto: CreateItProductDto): Promise<ItProductDto> {
    const product = await this.prisma.itProduct.create({ data: dto });
    return toItProductDto(product);
  }

  async updateItProduct(id: string, dto: UpdateItProductDto): Promise<ItProductDto> {
    const product = await this.prisma.itProduct
      .update({ where: { id }, data: dto })
      .catch((error) => mapPrismaWriteError(error, `ИТ-продукт с id "${id}" не найден`));
    return toItProductDto(product);
  }

  async deleteItProduct(id: string): Promise<void> {
    await this.prisma.itProduct
      .delete({ where: { id } })
      .catch((error) => mapPrismaWriteError(error, `ИТ-продукт с id "${id}" не найден`));
  }

  // --- Вузы ------------------------------------------------------------------

  async listUniversities(
    scope: CatalogScope,
    page?: string,
    pageSize?: string,
    kamId?: string,
  ): Promise<Paginated<UniversityDto>> {
    const { skip, take } = normalizePagination(page, pageSize);
    // Явный фильтр ?kamId= и видимость роли объединяются через AND: если КАМ
    // передаст чужой kamId, результат просто пустой, а не 403 — это фильтр
    // выдачи, а не отдельный ресурс с проверкой доступа.
    const where = { ...universityWhereForScope(scope), ...(kamId ? { kamId } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.university.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.prisma.university.count({ where }),
    ]);
    return { items: rows.map(toUniversityDto), total };
  }

  async getUniversityById(id: string, scope: CatalogScope): Promise<UniversityDto> {
    const university = await this.prisma.university
      .findUniqueOrThrow({ where: { id } })
      .catch((error) => mapPrismaWriteError(error, `Вуз с id "${id}" не найден`));
    assertUniversityVisible(university, scope);
    return toUniversityDto(university);
  }

  async createUniversity(dto: CreateUniversityDto): Promise<UniversityDto> {
    if (dto.kamId) {
      await this.assertUserHasKamRole(dto.kamId);
    }
    const university = await this.prisma.university.create({ data: dto });
    return toUniversityDto(university);
  }

  async updateUniversity(id: string, dto: UpdateUniversityDto): Promise<UniversityDto> {
    if (dto.kamId) {
      await this.assertUserHasKamRole(dto.kamId);
    }
    const university = await this.prisma.university
      .update({ where: { id }, data: dto })
      .catch((error) => mapPrismaWriteError(error, `Вуз с id "${id}" не найден`));
    return toUniversityDto(university);
  }

  async deleteUniversity(id: string): Promise<void> {
    await this.prisma.university
      .delete({ where: { id } })
      .catch((error) => mapPrismaWriteError(error, `Вуз с id "${id}" не найден`));
  }

  // kamId = null снимает ответственного ("удалить"); Руководитель может назначать
  // только на себя/своих КАМов (visibleKamIds), Администратор — без ограничений.
  async reassignUniversityResponsible(id: string, kamId: string | null, scope: CatalogScope): Promise<UniversityDto> {
    const existing = await this.prisma.university
      .findUniqueOrThrow({ where: { id } })
      .catch((error) => mapPrismaWriteError(error, `Вуз с id "${id}" не найден`));
    assertUniversityVisible(existing, scope);

    if (kamId && scope.role === UserRoleDto.RUKOVODITEL && !scope.visibleKamIds?.includes(kamId)) {
      throw new ForbiddenException({
        code: 'CATALOG_SCOPE_FORBIDDEN',
        message: 'Руководитель может назначать ответственным только КАМа из своей команды',
      });
    }

    if (kamId) {
      await this.assertUserHasKamRole(kamId);
    }

    const university = await this.prisma.university
      .update({ where: { id }, data: { kamId } })
      .catch((error) => mapPrismaWriteError(error, `Вуз с id "${id}" не найден`));
    return toUniversityDto(university);
  }

  private async assertUserHasKamRole(userId: string): Promise<void> {
    return assertUserHasKamRole(this.prisma, userId);
  }

  // --- Ответственные -----------------------------------------------------

  async listResponsiblePersons(
    scope: CatalogScope,
    page?: string,
    pageSize?: string,
    universityId?: string,
    itProductId?: string,
  ): Promise<Paginated<ResponsiblePersonDto>> {
    const { skip, take } = normalizePagination(page, pageSize);
    // Контакт без universityId (сторона вендора/продукта) виден всем — видимость
    // по роли действует только для контактов, привязанных к конкретному вузу.
    const scopeWhere =
      scope.visibleKamIds === null
        ? {}
        : { OR: [{ universityId: null }, { university: universityWhereForScope(scope) }] };
    const where = {
      ...scopeWhere,
      ...(universityId ? { universityId } : {}),
      ...(itProductId ? { itProductId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.responsiblePerson.findMany({ where, skip, take, orderBy: { fullName: 'asc' } }),
      this.prisma.responsiblePerson.count({ where }),
    ]);
    return { items: rows.map(toResponsiblePersonDto), total };
  }

  async getResponsiblePersonById(id: string, scope: CatalogScope): Promise<ResponsiblePersonDto> {
    const person = await this.prisma.responsiblePerson
      .findUniqueOrThrow({ where: { id }, include: { university: { select: { kamId: true } } } })
      .catch((error) => mapPrismaWriteError(error, `Ответственный с id "${id}" не найден`));

    if (person.universityId && person.university) {
      assertUniversityVisible(person.university, scope);
    }

    return toResponsiblePersonDto(person);
  }

  async createResponsiblePerson(dto: CreateResponsiblePersonDto): Promise<ResponsiblePersonDto> {
    // Инвариант из schema.prisma: контакт привязан к вузу и/или продукту вендора,
    // хотя бы одна связь обязательна — иначе запись «повисает в воздухе».
    if (!dto.universityId && !dto.itProductId) {
      throw new BadRequestException({
        code: 'RESPONSIBLE_PERSON_WITHOUT_LINK',
        message: 'Нужно указать universityId и/или itProductId — ответственный не может быть ни к чему не привязан',
      });
    }
    const person = await this.prisma.responsiblePerson.create({ data: dto });
    return toResponsiblePersonDto(person);
  }

  async updateResponsiblePerson(id: string, dto: UpdateResponsiblePersonDto): Promise<ResponsiblePersonDto> {
    const person = await this.prisma.responsiblePerson
      .update({ where: { id }, data: dto })
      .catch((error) => mapPrismaWriteError(error, `Ответственный с id "${id}" не найден`));
    return toResponsiblePersonDto(person);
  }

  async deleteResponsiblePerson(id: string): Promise<void> {
    await this.prisma.responsiblePerson
      .delete({ where: { id } })
      .catch((error) => mapPrismaWriteError(error, `Ответственный с id "${id}" не найден`));
  }

  // --- Лицензии/договоры -----------------------------------------------------

  async listLicenses(
    scope: CatalogScope,
    page?: string,
    pageSize?: string,
    universityId?: string,
    itProductId?: string,
  ): Promise<Paginated<LicenseDto>> {
    const { skip, take } = normalizePagination(page, pageSize);
    const scopeWhere = scope.visibleKamIds === null ? {} : { university: universityWhereForScope(scope) };
    const where = {
      ...scopeWhere,
      ...(universityId ? { universityId } : {}),
      ...(itProductId ? { itProductId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.license.findMany({ where, skip, take, orderBy: { endDate: 'asc' } }),
      this.prisma.license.count({ where }),
    ]);
    return { items: rows.map(toLicenseDto), total };
  }

  async getLicenseById(id: string, scope: CatalogScope): Promise<LicenseDto> {
    const license = await this.prisma.license
      .findUniqueOrThrow({ where: { id }, include: { university: { select: { kamId: true } } } })
      .catch((error) => mapPrismaWriteError(error, `Лицензия с id "${id}" не найдена`));
    assertUniversityVisible(license.university, scope);
    return toLicenseDto(license);
  }

  async createLicense(dto: CreateLicenseDto): Promise<LicenseDto> {
    this.assertLicensePeriodValid(dto.startDate, dto.endDate);
    const license = await this.prisma.license.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
    return toLicenseDto(license);
  }

  async updateLicense(id: string, dto: UpdateLicenseDto): Promise<LicenseDto> {
    if (dto.startDate && dto.endDate) {
      this.assertLicensePeriodValid(dto.startDate, dto.endDate);
    }
    const license = await this.prisma.license
      .update({
        where: { id },
        data: {
          ...dto,
          ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
          ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
        },
      })
      .catch((error) => mapPrismaWriteError(error, `Лицензия с id "${id}" не найдена`));
    return toLicenseDto(license);
  }

  async deleteLicense(id: string): Promise<void> {
    await this.prisma.license
      .delete({ where: { id } })
      .catch((error) => mapPrismaWriteError(error, `Лицензия с id "${id}" не найдена`));
  }

  private assertLicensePeriodValid(startDate: string, endDate: string): void {
    if (new Date(startDate).getTime() >= new Date(endDate).getTime()) {
      throw new BadRequestException({
        code: 'LICENSE_INVALID_PERIOD',
        message: 'startDate должен быть раньше endDate',
      });
    }
  }
}
