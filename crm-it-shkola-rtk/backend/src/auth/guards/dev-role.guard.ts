import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRoleDto } from '../dto/user.dto';

const DEV_ROLE_HEADER_MAP: Record<string, UserRoleDto> = {
  kam: UserRoleDto.KAM,
  rukovoditel: UserRoleDto.RUKOVODITEL,
  administrator: UserRoleDto.ADMINISTRATOR,
};

export interface RequestWithDevRole extends Request {
  userRole?: UserRoleDto;
}

// Dev-авторизация (CLAUDE.md): при AUTH_MODE=dev роль читается из заголовка
// X-Dev-Role вместо реального Keycloak-редиректа. Проверка требуемых ролей —
// только для эндпоинтов, помеченных @Roles(); остальные проходят без ограничений.
@Injectable()
export class DevRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRoleDto[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<RequestWithDevRole>();
    const authMode = process.env.AUTH_MODE ?? 'dev';

    if (authMode !== 'dev') {
      if (!requiredRoles?.length) {
        return true;
      }
      // Реальная интеграция с Keycloak ещё не реализована (Шаг 1 плана) —
      // без dev-режима нечем проверить требуемую роль.
      throw new UnauthorizedException({
        code: 'AUTH_MODE_NOT_SUPPORTED',
        message: 'AUTH_MODE отличен от "dev", а интеграция с Keycloak ещё не реализована',
      });
    }

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

    if (!requiredRoles?.length) {
      return true;
    }

    if (!role) {
      throw new UnauthorizedException({
        code: 'AUTH_ROLE_HEADER_MISSING',
        message: 'Требуется заголовок X-Dev-Role (kam|rukovoditel|administrator)',
      });
    }

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException({
        code: 'AUTH_FORBIDDEN_ROLE',
        message: `Роль "${role}" не имеет доступа к этому эндпоинту (нужна одна из: ${requiredRoles.join(', ')})`,
      });
    }

    return true;
  }
}
