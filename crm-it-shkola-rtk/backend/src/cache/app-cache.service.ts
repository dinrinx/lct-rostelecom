import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { CACHE_NAMESPACES, CACHE_OP_TIMEOUT_MS, CacheNamespace, createNamespacedCache, isCacheReady } from './caches';

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('cache timeout')), CACHE_OP_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Единая точка доступа к Redis-кэшу (cache-manager + Keyv Redis). Все методы
// не бросают исключений: недоступный кэш = промах (get) / no-op (set, invalidate).
@Injectable()
export class AppCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AppCacheService.name);
  private readonly caches: Record<CacheNamespace, Cache>;
  // Пространства, сброс которых не удался (Redis был недоступен): пока флаг стоит,
  // читать из них нельзя — в Redis могли пережить рестарт устаревшие ключи.
  private readonly pendingInvalidation = new Set<CacheNamespace>();

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.caches = Object.fromEntries(
      CACHE_NAMESPACES.map((namespace) => [namespace, createNamespacedCache(namespace, url)]),
    ) as Record<CacheNamespace, Cache>;
  }

  async get<T>(namespace: CacheNamespace, key: string): Promise<T | undefined> {
    try {
      if (!isCacheReady(this.caches[namespace])) return undefined;
      if (this.pendingInvalidation.has(namespace)) {
        await withTimeout(this.caches[namespace].clear());
        this.pendingInvalidation.delete(namespace);
      }
      return (await withTimeout(this.caches[namespace].get<T>(key))) ?? undefined;
    } catch (error) {
      this.logger.warn(`get ${namespace}: ${(error as Error).message}`);
      return undefined;
    }
  }

  async set(namespace: CacheNamespace, key: string, value: unknown, ttlMs: number): Promise<void> {
    try {
      if (!isCacheReady(this.caches[namespace]) || this.pendingInvalidation.has(namespace)) return;
      await withTimeout(this.caches[namespace].set(key, value, ttlMs));
    } catch (error) {
      this.logger.warn(`set ${namespace}: ${(error as Error).message}`);
    }
  }

  // Сброс всего пространства имён — инвалидация по префиксу, а не по точечным ключам.
  async invalidate(...namespaces: CacheNamespace[]): Promise<void> {
    await Promise.all(
      [...new Set(namespaces)].map(async (namespace) => {
        try {
          if (!isCacheReady(this.caches[namespace])) throw new Error('Redis недоступен');
          await withTimeout(this.caches[namespace].clear());
          this.pendingInvalidation.delete(namespace);
        } catch (error) {
          this.pendingInvalidation.add(namespace);
          this.logger.warn(`invalidate ${namespace}: ${(error as Error).message}`);
        }
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Object.values(this.caches).map((cache) =>
        Promise.all(
          cache.stores.map((store) =>
            (store.store as { disconnect?: (force?: boolean) => Promise<void> }).disconnect?.(true).catch(() => undefined),
          ),
        ),
      ),
    );
  }
}
