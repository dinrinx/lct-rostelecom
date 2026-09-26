import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { UserRoleDto } from '../auth/dto/user.dto';
import type { RequestWithDevRole } from '../auth/guards/dev-role.guard';

export interface CatalogScope {
  role?: UserRoleDto;
  currentUserId?: string;
  // Список id КАМов, чьи вузы видны текущему пользователю.
  // null = без ограничений (ADMINISTRATOR — видит всё).
  visibleKamIds: string[] | null;
  // Только для RUKOVODITEL: видит и может "подобрать" вузы без ответственного —
  // иначе после снятия ответственного (kamId=null) вуз становится невидим даже
  // тому, кто им управляет, и переназначить его сможет только ADMINISTRATOR.
  includeUnassigned: boolean;
}

export interface RequestWithCatalogScope extends RequestWithDevRole {
  catalogScope?: CatalogScope;
}

// Считает scope один раз за запрос (а не в каждом методе CatalogsService) —
// в частности, тянет команду Руководителя (managerId = currentUserId) одним
// запросом к БД. DevRoleGuard уже отработал раньше (порядок в Nest: Guards ->
// Interceptors), так что userRole/currentUserId в request уже выставлены.
// Фактическая фильтрация (Prisma where) остаётся в CatalogsService — это
// намеренно: interceptor, постфильтрующий уже полученную страницу результатов,
// сломал бы пагинацию и X-Total-Count (можно было бы получить страницу с
// частью строк, отфильтрованных задним числом).
@Injectable()
export class CatalogScopeInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<RequestWithCatalogScope>();
    request.catalogScope = await this.buildScope(request);
    return next.handle();
  }

  private async buildScope(request: RequestWithDevRole): Promise<CatalogScope> {
    const { userRole, currentUserId } = request;

    if (userRole === UserRoleDto.ADMINISTRATOR) {
      return { role: userRole, currentUserId, visibleKamIds: null, includeUnassigned: false };
    }

    if (userRole === UserRoleDto.KAM) {
      return {
        role: userRole,
        currentUserId,
        visibleKamIds: currentUserId ? [currentUserId] : [],
        includeUnassigned: false,
      };
    }

    if (userRole === UserRoleDto.RUKOVODITEL) {
      const team = currentUserId
        ? await this.prisma.user.findMany({ where: { managerId: currentUserId }, select: { id: true } })
        : [];
      // Плюс сам currentUserId — на случай, если руководителю тоже назначен вуз напрямую.
      const visibleKamIds = currentUserId ? [...team.map((u) => u.id), currentUserId] : [];
      return { role: userRole, currentUserId, visibleKamIds, includeUnassigned: true };
    }

    return { role: userRole, currentUserId, visibleKamIds: null, includeUnassigned: false };
  }
}
