import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRoleDto } from '../dto/user.dto';
import { KeycloakJwtService } from '../keycloak-jwt.service';

const DEV_ROLE_HEADER_MAP: Record<string, UserRoleDto> = {
  kam: UserRoleDto.KAM,
  rukovoditel: UserRoleDto.RUKOVODITEL,
  administrator: UserRoleDto.ADMINISTRATOR,
};

// Канонический dev-пользователь на роль — те же email, что в seed.ts и в старых
// auth-фикстурах. X-Dev-User-Id позволяет подставить другого реального пользователя
// той же роли (например, второго КАМа в команде) для проверки построчной видимости.
const CANONICAL_DEV_EMAIL_BY_ROLE: Record<UserRoleDto, string> = {
  [UserRoleDto.KAM]: 'kam@it-shkola-rtk.ru',
  [UserRoleDto.RUKOVODITEL]: 'rukovoditel@it-shkola-rtk.ru',
  [UserRoleDto.ADMINISTRATOR]: 'admin@it-shkola-rtk.ru',
};

export interface RequestWithDevRole extends Request {
  userRole?: UserRoleDto;
  keycloakSubject?: string;
  // Prisma User.id текущего пользователя. Обязателен для KAM/RUKOVODITEL (без него
  // невозможно построчно фильтровать видимость каталогов), необязателен для
  // ADMINISTRATOR — админ видит всё, идентичность ему для этого не нужна.
  currentUserId?: string;
  // Что именно искали при резолве currentUserId — для точного сообщения об
  // ошибке AUTH_USER_NOT_PROVISIONED (иначе "нужна запись с email" вводит в
  // заблуждение, если на самом деле не нашёлся X-Dev-User-Id).
  identityLookupHint?: string;
}

// Единый переключатель авторизации на весь процесс — AUTH_MODE, без гибридной
// логики на уровне запроса:
//   - AUTH_MODE=dev       -> роль ТОЛЬКО из заголовка X-Dev-Role; даже если в
//     запросе есть Authorization: Bearer, он полностью игнорируется.
//   - AUTH_MODE=<иное>    -> роль ТОЛЬКО из JWT (Keycloak); X-Dev-Role полностью
//     игнорируется, даже если он присутствует.
// X-Dev-Role работает "вместо" Keycloak, а не "в дополнение". Проверка
// требуемых ролей — только для эндпоинтов,
// помеченных @Roles(); остальные проходят без ограничений в обоих режимах.
//
// Помимо роли, guard резолвит currentUserId (Prisma User.id) — нужен построчному
// RBAC в catalogs (см. CatalogScopeInterceptor): "КАМ видит только свои вузы"
// невозможно проверить, зная только роль, без знания КАКОГО именно КАМа.
@Injectable()
export class DevRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly keycloakJwtService: KeycloakJwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRoleDto[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<RequestWithDevRole>();
    const authMode = process.env.AUTH_MODE ?? 'dev';

    const identity =
      authMode === 'dev' ? this.resolveDevRole(request) : await this.resolveKeycloakRole(request);

    if (identity?.role) {
      await this.resolveCurrentUserId(request, identity.role, identity.email);
    }

    if (!requiredRoles?.length) {
      return true;
    }

    if (!identity?.role) {
      throw new UnauthorizedException(
        authMode === 'dev'
          ? { code: 'AUTH_ROLE_HEADER_MISSING', message: 'Требуется заголовок X-Dev-Role (kam|rukovoditel|administrator)' }
          : { code: 'AUTH_TOKEN_MISSING', message: 'Требуется заголовок Authorization: Bearer <JWT от Keycloak>' },
      );
    }

    if (!requiredRoles.includes(identity.role)) {
      throw new ForbiddenException({
        code: 'AUTH_FORBIDDEN_ROLE',
        message: `Роль "${identity.role}" не имеет доступа к этому эндпоинту (нужна одна из: ${requiredRoles.join(', ')})`,
      });
    }

    // KAM/RUKOVODITEL без резолвнутого currentUserId — не с чем строить видимость
    // каталогов, пускать дальше небезопасно (это либо конфигурация без seed-данных,
    // либо неизвестный пользователь). ADMINISTRATOR не нуждается в identity.
    if (identity.role !== UserRoleDto.ADMINISTRATOR && !request.currentUserId) {
      throw new ForbiddenException({
        code: 'AUTH_USER_NOT_PROVISIONED',
        message: `Пользователь с ролью "${identity.role}" не найден в таблице User (искали по ${request.identityLookupHint ?? 'неизвестному идентификатору'})`,
      });
    }

    return true;
  }

  private resolveDevRole(request: RequestWithDevRole): { role?: UserRoleDto; email?: string } {
    const headerValue = request.headers['x-dev-role'];
    const rawRole = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const role = rawRole ? DEV_ROLE_HEADER_MAP[rawRole.toLowerCase()] : undefined;

    if (rawRole && !role) {
      throw new UnauthorizedException({
        code: 'AUTH_ROLE_HEADER_INVALID',
        message: `Заголовок X-Dev-Role содержит неизвестную роль "${rawRole}" (ожидается kam|rukovoditel|administrator)`,
      });
    }

    if (role) {
      request.userRole = role;
    }
    return { role, email: role ? CANONICAL_DEV_EMAIL_BY_ROLE[role] : undefined };
  }

  private async resolveKeycloakRole(request: RequestWithDevRole): Promise<{ role?: UserRoleDto; email?: string }> {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return {};
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_MISSING',
        message: 'Заголовок Authorization должен быть в форме "Bearer <JWT>"',
      });
    }

    const { userRole, subject, email } = await this.keycloakJwtService.verify(token);
    request.userRole = userRole;
    request.keycloakSubject = subject;
    return { role: userRole, email };
  }

  // Dev-режим: X-Dev-User-Id позволяет подставить другого реального пользователя
  // той же роли вместо канонического (например, второго КАМа в команде) — иначе
  // используется email по умолчанию для роли. Keycloak-режим: матчинг по email из токена.
  private async resolveCurrentUserId(request: RequestWithDevRole, role: UserRoleDto, email?: string): Promise<void> {
    const authMode = process.env.AUTH_MODE ?? 'dev';
    const overrideId = authMode === 'dev' ? request.headers['x-dev-user-id'] : undefined;
    const rawOverrideId = Array.isArray(overrideId) ? overrideId[0] : overrideId;

    request.identityLookupHint = rawOverrideId
      ? `X-Dev-User-Id "${rawOverrideId}"`
      : email
        ? `email "${email}"`
        : undefined;

    const user = rawOverrideId
      ? await this.prisma.user.findUnique({ where: { id: rawOverrideId } })
      : email
        ? await this.prisma.user.findUnique({ where: { email } })
        : null;

    if (user) {
      request.currentUserId = user.id;
    }
  }
}
