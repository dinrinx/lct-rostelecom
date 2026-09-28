import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';
import type { RequestWithDevRole } from '../auth/guards/dev-role.guard';

// Эндпоинты, которые опрашивают мониторинг каждые несколько секунд, — в лог не пишем.
const QUIET_PATHS = new Set(['/health', '/metrics']);

const pathOf = (req: IncomingMessage) => (req.url ?? '').split('?')[0];

// Структурированные JSON-логи (pino). 152-ФЗ: в лог попадают ТОЛЬКО метаданные
// запроса — метод, путь без query-строки, статус, время, id запроса, роль и
// id пользователя. Тело запроса, заголовки (в т.ч. Authorization/Cookie) и
// query не логируются вовсе: в них бывают ФИО, телефон, email (импорт, вендоры,
// ответственные лица), поэтому whitelist-сериализаторы вместо чёрного списка.
export const loggerParams: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: { ignore: (req) => QUIET_PATHS.has(pathOf(req)) },
    customLogLevel: (_req, res: ServerResponse, error) =>
      error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    customSuccessMessage: (req, res) => `${req.method} ${pathOf(req)} ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${pathOf(req)} ${res.statusCode}`,
    // Роль и пользователь проставляются DevRoleGuard уже после создания
    // логгера запроса, поэтому читаем их в момент записи строки (на finish).
    customProps: (req) => {
      const { userRole, currentUserId } = req as unknown as RequestWithDevRole;
      return { userRole: userRole ?? null, userId: currentUserId ?? null };
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, path: pathOf(req) }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    // Ключи по умолчанию (`req`, `res`, `responseTime`) сохраняем — это и есть
    // метод/путь/статус/время в каждой строке.
  },
};
