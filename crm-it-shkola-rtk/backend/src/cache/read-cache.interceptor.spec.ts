import { lastValueFrom, of } from 'rxjs';
import { UserRoleDto } from '../auth/dto/user.dto';
import { cacheKey, ReadCacheInterceptor } from './read-cache.interceptor';

function requestOf(role: UserRoleDto | undefined, userId: string | undefined, url = '/catalogs/universities?page=1') {
  return { method: 'GET', originalUrl: url, userRole: role, currentUserId: userId } as any;
}

describe('cacheKey — изоляция по роли и пользователю', () => {
  it('КАМ и Руководитель получают разные ключи на один и тот же URL', () => {
    const kam = cacheKey(requestOf(UserRoleDto.KAM, 'u1'));
    const ruk = cacheKey(requestOf(UserRoleDto.RUKOVODITEL, 'u1'));
    const admin = cacheKey(requestOf(UserRoleDto.ADMINISTRATOR, 'u1'));
    expect(new Set([kam, ruk, admin]).size).toBe(3);
  });

  it('два разных КАМа не делят ключ', () => {
    expect(cacheKey(requestOf(UserRoleDto.KAM, 'u1'))).not.toBe(cacheKey(requestOf(UserRoleDto.KAM, 'u2')));
  });

  it('разные query-параметры дают разные ключи', () => {
    expect(cacheKey(requestOf(UserRoleDto.KAM, 'u1', '/x?page=1'))).not.toBe(
      cacheKey(requestOf(UserRoleDto.KAM, 'u1', '/x?page=2')),
    );
  });

  it('без роли или без пользователя (кроме админа) не кэшируем', () => {
    expect(cacheKey(requestOf(undefined, undefined))).toBeUndefined();
    expect(cacheKey(requestOf(UserRoleDto.KAM, undefined))).toBeUndefined();
    expect(cacheKey(requestOf(UserRoleDto.ADMINISTRATOR, undefined))).toBeDefined();
  });
});

describe('ReadCacheInterceptor', () => {
  function setup(stored: unknown) {
    const headers: Record<string, string> = {};
    const response = { setHeader: (k: string, v: string) => (headers[k] = v), getHeader: (k: string) => headers[k] };
    const request = requestOf(UserRoleDto.KAM, 'u1');
    const context: any = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
      getHandler: () => undefined,
      getClass: () => undefined,
    };
    const reflector: any = { getAllAndOverride: () => ({ namespace: 'catalogs', ttlMs: 1000 }) };
    const cache: any = { get: jest.fn().mockResolvedValue(stored), set: jest.fn().mockResolvedValue(undefined) };
    return { headers, response, context, cache, interceptor: new ReadCacheInterceptor(reflector, cache) };
  }

  it('на попадании отдаёт кэш и восстанавливает X-Total-Count, обработчик не вызывается', async () => {
    const { interceptor, context, headers } = setup({ body: [{ id: 1 }], totalCount: '12' });
    const next = { handle: jest.fn() };
    const result = await lastValueFrom(await interceptor.intercept(context, next as any));
    expect(result).toEqual([{ id: 1 }]);
    expect(next.handle).not.toHaveBeenCalled();
    expect(headers['X-Total-Count']).toBe('12');
    expect(headers['X-Cache']).toBe('HIT');
  });

  it('на промахе вызывает обработчик и кладёт тело вместе с X-Total-Count', async () => {
    const { interceptor, context, cache, headers } = setup(undefined);
    const next = {
      handle: () => {
        headers['X-Total-Count'] = '7';
        return of([{ id: 2 }]);
      },
    };
    await lastValueFrom(await interceptor.intercept(context, next as any));
    expect(headers['X-Cache']).toBe('MISS');
    expect(cache.set).toHaveBeenCalledWith('catalogs', expect.stringContaining('KAM:u1:'), { body: [{ id: 2 }], totalCount: '7' }, 1000);
  });
});
