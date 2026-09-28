// TTL (мс) по типам данных; переопределяются через .env (секунды).
const sec = (name: string, fallback: number) => Number(process.env[name] ?? fallback) * 1000;

// Справочники меняются редко, а при записи кэш и так сбрасывается.
export const CATALOGS_TTL_MS = sec('CACHE_TTL_CATALOGS_SEC', 300);
// Радары зависят от «сегодня» и должны быть почти свежими.
export const DASHBOARD_TTL_MS = sec('CACHE_TTL_DASHBOARD_SEC', 60);
export const CHARTS_TTL_MS = sec('CACHE_TTL_CHARTS_SEC', 180);
