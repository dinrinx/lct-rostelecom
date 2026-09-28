import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, catchError, from, mergeMap, throwError } from 'rxjs';
import { AppCacheService } from './app-cache.service';
import type { CacheNamespace } from './caches';

// Какие кэшированные данные затрагивает запись в модуль (по первому сегменту пути).
// Дашборд и графики (namespace reports) строятся из вузов, лицензий и
// взаимодействий, поэтому запись в catalogs/workflow/integrations сбрасывает и их.
// admin (роль, руководитель, isActive) меняет видимость и имена везде.
// files, reports/jobs, auth/dev-login кэшируемых данных не меняют.
const INVALIDATES: Record<string, CacheNamespace[]> = {
  catalogs: ['catalogs', 'reports'],
  workflow: ['reports'],
  integrations: ['reports'],
  admin: ['catalogs', 'reports'],
};

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Глобальный: сброс происходит ДО ответа клиенту (ждём), иначе следующий GET
// сразу после записи мог бы получить ещё не сброшенный кэш. Сбрасываем и при
// ошибке записи — частично применённая операция не должна оставлять старый кэш.
@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  constructor(private readonly cache: AppCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!MUTATING.has(request.method)) return next.handle();

    const namespaces = INVALIDATES[request.path.split('/')[1] ?? ''];
    if (!namespaces) return next.handle();

    return next.handle().pipe(
      mergeMap((value) => from(this.cache.invalidate(...namespaces).then(() => value))),
      catchError((error) => from(this.cache.invalidate(...namespaces)).pipe(mergeMap(() => throwError(() => error)))),
    );
  }
}
