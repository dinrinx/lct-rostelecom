import { SetMetadata } from '@nestjs/common';
import type { CacheNamespace } from './caches';

export const CACHEABLE_KEY = 'crm:cacheable';

export interface CacheableOptions {
  namespace: CacheNamespace;
  ttlMs: number;
}

// Помечает GET-обработчик (или весь контроллер) как кэшируемый. Метод и
// класс читаются ReadCacheInterceptor'ом; всё, что не помечено, не кэшируется.
export const Cacheable = (namespace: CacheNamespace, ttlMs: number) =>
  SetMetadata(CACHEABLE_KEY, { namespace, ttlMs } satisfies CacheableOptions);
