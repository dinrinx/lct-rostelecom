import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { Observable, mergeMap, of } from 'rxjs';
import { UserRoleDto } from '../auth/dto/user.dto';
import type { RequestWithDevRole } from '../auth/guards/dev-role.guard';
import { AppCacheService } from './app-cache.service';
import { CACHEABLE_KEY, CacheableOptions } from './cacheable.decorator';

// Что лежит в кэше: тело ответа + заголовок пагинации. Без X-Total-Count на
// попадании в кэш фронт терял бы общее число записей каталога.
interface CachedEntry {
  body: unknown;
  totalCount?: string;
}

// Ключ ВСЕГДА включает роль и пользователя: видимость данных зависит от роли
// (КАМ — свои вузы, Руководитель — команда), общий ключ отдал бы КАМу ответ
// администратора. Администратор видит всё одинаково — ключ общий на всех админов.
export function cacheKey(request: RequestWithDevRole): string | undefined {
  const { userRole, currentUserId } = request;
  if (!userRole) return undefined;
  const who = userRole === UserRoleDto.ADMINISTRATOR ? '*' : currentUserId;
  if (!who) return undefined;
  return `${userRole}:${who}:${request.originalUrl}`;
}

// Стоит в цепочке ПЕРЕД CatalogScopeInterceptor: на попадании в кэш scope
// (запрос к БД за командой руководителя) не считается вообще.
@Injectable()
export class ReadCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: AppCacheService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithDevRole>();
    const options = this.reflector.getAllAndOverride<CacheableOptions | undefined>(CACHEABLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const key = cacheKey(request);
    if (!options || request.method !== 'GET' || !key) {
      return next.handle();
    }

    const response = http.getResponse<Response>();
    const hit = await this.cache.get<CachedEntry>(options.namespace, key);
    if (hit) {
      response.setHeader('X-Cache', 'HIT');
      if (hit.totalCount !== undefined) response.setHeader('X-Total-Count', hit.totalCount);
      return of(hit.body);
    }

    response.setHeader('X-Cache', 'MISS');
    return next.handle().pipe(
      mergeMap(async (body) => {
        const totalCount = response.getHeader('X-Total-Count');
        await this.cache.set(
          options.namespace,
          key,
          { body, totalCount: totalCount === undefined ? undefined : String(totalCount) } satisfies CachedEntry,
          options.ttlMs,
        );
        return body;
      }),
    );
  }
}
