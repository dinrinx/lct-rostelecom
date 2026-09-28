import { createCache, type Cache } from 'cache-manager';
import { createKeyv } from '@keyv/redis';

// Два пространства имён = два модуля инвалидации. Ключи в Redis имеют вид
// "crm:<namespace>::<key>", clear() пространства удаляет ровно его ключи
// (SCAN по префиксу + UNLINK внутри @keyv/redis), остальное не трогает.
export type CacheNamespace = 'catalogs' | 'reports';
export const CACHE_NAMESPACES: CacheNamespace[] = ['catalogs', 'reports'];

// Кэш не должен замедлять или ронять API: любая операция ограничена таймаутом,
// а при недоступном Redis запрос просто идёт мимо кэша (см. AppCacheService).
export const CACHE_OP_TIMEOUT_MS = 300;

export function createNamespacedCache(namespace: CacheNamespace, redisUrl: string): Cache {
  const keyv = createKeyv(redisUrl, { namespace: `crm:${namespace}` });
  // Без офлайн-очереди команды при упавшем Redis отклоняются сразу, а не копятся
  // до переподключения; сам reconnect остаётся включённым.
  const client = (
    keyv.store as {
      client?: { options?: { disableOfflineQueue?: boolean }; isOpen?: boolean; connect?: () => Promise<unknown> };
    }
  ).client;
  if (client?.options) client.options.disableOfflineQueue = true;
  // @keyv/redis подключается лениво, при первой операции; мы читаем кэш только
  // при isReady, поэтому подключаемся сразу (переподключения ведёт сам клиент).
  if (client && !client.isOpen) void client.connect?.().catch(() => undefined);
  // Keyv по умолчанию глотает ошибки Redis: без throwOnErrors неудавшаяся
  // инвалидация выглядела бы успешной и оставляла устаревшие ключи.
  keyv.throwOnErrors = true;
  (keyv.store as { throwOnErrors?: boolean }).throwOnErrors = true;
  keyv.on('error', () => undefined);
  return createCache({ stores: [keyv] });
}

// clear() в @keyv/redis при отключённом клиенте не бросает, а тихо «успешно»
// ничего не делает — поэтому надёжный признак доступности Redis это состояние
// соединения, а не отсутствие исключения.
export function isCacheReady(cache: Cache): boolean {
  const store = cache.stores[0]?.store as { client?: { isReady?: boolean } } | undefined;
  return store?.client?.isReady === true;
}

// Для одноразовых скриптов (seed): клиент подключается асинхронно, а clear()
// до готовности молча ничего не делает — ждём соединение, но не дольше timeoutMs.
export async function waitUntilCacheReady(cache: Cache, timeoutMs = 2000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!isCacheReady(cache)) {
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return true;
}
