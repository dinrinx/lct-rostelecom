// Единый источник правды по кодам ошибок API. Формат ответа на ЛЮБУЮ ошибку —
// { code, message, details? } (см. AllExceptionsFilter — он гарантирует эту
// форму даже для ошибок, которые сами по себе не проходили через этот список:
// стандартные исключения Nest, ошибки Prisma, непредвиденные сбои).
//
// Это описание генерируется в Swagger (main.ts/generate-openapi.ts, через
// buildErrorCodesMarkdown) и в docs/backend-plan.md (npm run docs:error-codes,
// см. scripts/generate-error-codes-doc.ts) — правь коды только здесь, не в
// самих контроллерах/сервисах вручную заводи новый code, не добавив его сюда.
export interface ErrorCodeDoc {
  code: string;
  httpStatus: number;
  category: string;
  meaning: string;
  // Заполнено только для кодов, где фронту нужна отдельная реакция в UI
  // (не просто показать message как есть) — пример из задачи: TRANSITION_NOT_ALLOWED.
  uiHint?: string;
}

export const ERROR_CODES: ErrorCodeDoc[] = [
  // --- Общие (глобальный фильтр, любой эндпоинт) --------------------------
  {
    code: 'VALIDATION_ERROR',
    httpStatus: 400,
    category: 'Общие',
    meaning: 'Тело/query не прошли проверку (class-validator) или дата/число в неверном формате',
    uiHint: 'details — массив {field, errors[]} (или {field: "page"/"pageSize"/"from"/"to"} для query) — подсветить конкретное поле формы, а не только показать message',
  },
  { code: 'BAD_REQUEST', httpStatus: 400, category: 'Общие', meaning: 'Некорректный запрос без более специфичного code (fallback стандартных исключений Nest)' },
  { code: 'UNAUTHORIZED', httpStatus: 401, category: 'Общие', meaning: 'Запрос не аутентифицирован (fallback)' },
  { code: 'FORBIDDEN', httpStatus: 403, category: 'Общие', meaning: 'Доступ запрещён без более специфичного code (fallback)' },
  { code: 'NOT_FOUND', httpStatus: 404, category: 'Общие', meaning: 'Запись не найдена — общий код там, где нет отдельного ENTITY_NOT_FOUND (например, каталоги при ошибке Prisma P2025) либо несуществующий путь/метод' },
  { code: 'CONFLICT', httpStatus: 409, category: 'Общие', meaning: 'Конфликт состояния без более специфичного code (fallback)' },
  { code: 'FK_CONSTRAINT', httpStatus: 409, category: 'Общие', meaning: 'Операция нарушает внешний ключ — ссылка на несуществующую запись, либо на запись ссылаются другие данные' },
  { code: 'UNIQUE_CONSTRAINT', httpStatus: 409, category: 'Общие', meaning: 'Запись с такими значениями уникального поля уже существует (Prisma P2002)' },
  { code: 'PAYLOAD_TOO_LARGE', httpStatus: 413, category: 'Общие', meaning: 'Тело запроса/файл превышает лимит (fallback)' },
  { code: 'INTERNAL_ERROR', httpStatus: 500, category: 'Общие', meaning: 'Непредвиденная ошибка сервера. Детали — только в серверном логе, не в ответе', uiHint: 'Показать общий "Что-то пошло не так", детали не выводить пользователю' },
  { code: 'SERVICE_UNAVAILABLE', httpStatus: 503, category: 'Общие', meaning: 'Зависимость недоступна без более специфичного code (fallback)' },
  { code: 'HTTP_ERROR', httpStatus: 0, category: 'Общие', meaning: 'Crash-fallback для статусов без записи в CODE_BY_STATUS — в норме не должен встречаться' },

  // --- Auth / RBAC ----------------------------------------------------------
  { code: 'AUTH_ROLE_HEADER_MISSING', httpStatus: 401, category: 'Auth', meaning: 'AUTH_MODE=dev, но заголовка X-Dev-Role нет' },
  { code: 'AUTH_ROLE_HEADER_INVALID', httpStatus: 401, category: 'Auth', meaning: 'X-Dev-Role содержит значение не из kam|rukovoditel|administrator' },
  { code: 'AUTH_TOKEN_MISSING', httpStatus: 401, category: 'Auth', meaning: 'AUTH_MODE=keycloak, но заголовка Authorization: Bearer нет' },
  { code: 'AUTH_TOKEN_INVALID', httpStatus: 401, category: 'Auth', meaning: 'JWT недействителен, просрочен или выдан не для этого realm/клиента' },
  { code: 'AUTH_TOKEN_NO_ROLE', httpStatus: 401, category: 'Auth', meaning: 'В claim "roles" токена нет ни одной из ожидаемых ролей' },
  { code: 'AUTH_FORBIDDEN_ROLE', httpStatus: 403, category: 'Auth', meaning: 'Роль распознана, но у неё нет доступа к этому эндпоинту (не входит в @Roles)', uiHint: 'Скрывать/дизейблить в UI действия, недоступные текущей роли, а не полагаться только на этот ответ' },
  { code: 'AUTH_USER_NOT_PROVISIONED', httpStatus: 403, category: 'Auth', meaning: 'Роль KAM/RUKOVODITEL распознана, но нет строки User с таким email/X-Dev-User-Id — построчный RBAC не может посчитать зону видимости' },
  { code: 'AUTH_USER_UNKNOWN', httpStatus: 400, category: 'Auth', meaning: 'GET /auth/me: не удалось определить текущего пользователя' },
  { code: 'CATALOG_SCOPE_FORBIDDEN', httpStatus: 403, category: 'Auth', meaning: 'Действие выходит за пределы зоны видимости роли (чужой вуз/КАМ не из своей команды)' },
  { code: 'CURRENT_USER_REQUIRED', httpStatus: 400, category: 'Auth', meaning: 'Действие требует currentUserId (обычно ADMINISTRATOR без X-Dev-User-Id/подходящего email)' },

  // --- Workflow: шаблоны ------------------------------------------------
  { code: 'WORKFLOW_TEMPLATE_NOT_FOUND', httpStatus: 404, category: 'Workflow · шаблоны', meaning: 'Шаблон с таким id не существует' },
  { code: 'WORKFLOW_TEMPLATE_VERSION_NOT_FOUND', httpStatus: 404, category: 'Workflow · шаблоны', meaning: 'Версия шаблона с таким id не существует' },
  { code: 'WORKFLOW_TEMPLATE_EMPTY', httpStatus: 409, category: 'Workflow · шаблоны', meaning: 'Активная версия шаблона не содержит ни одного статуса — создание инстанса невозможно' },
  { code: 'WORKFLOW_NO_ACTIVE_TEMPLATE', httpStatus: 409, category: 'Workflow · шаблоны', meaning: 'Нет ни одной активной версии шаблона workflow' },
  { code: 'WORKFLOW_STATUSES_REQUIRED', httpStatus: 400, category: 'Workflow · шаблоны', meaning: 'В теле запроса нет ни одного статуса (statuses)' },
  { code: 'WORKFLOW_STATUS_ORDER_DUPLICATE', httpStatus: 400, category: 'Workflow · шаблоны', meaning: 'Значения order у статусов повторяются в пределах запроса' },
  { code: 'WORKFLOW_STATUS_DEPENDENCY_INVALID', httpStatus: 400, category: 'Workflow · шаблоны', meaning: 'dependsOnOrders ссылается на order вне statuses этого запроса или на себя' },
  { code: 'WORKFLOW_TRANSITION_UNKNOWN_STATUS', httpStatus: 400, category: 'Workflow · шаблоны', meaning: 'Переход в теле запроса ссылается на order, которого нет среди statuses' },
  { code: 'WORKFLOW_GRAPH_DUPLICATE_STATUS_ID', httpStatus: 400, category: 'Workflow · шаблоны', meaning: 'PUT …/graph: значения id статусов повторяются в пределах запроса' },
  { code: 'WORKFLOW_STATUS_PHASE_REQUIRED', httpStatus: 400, category: 'Workflow · шаблоны', meaning: 'PUT …/graph: у статуса нет валидной привязки к одной из 7 макростадий (phase)' },
  { code: 'WORKFLOW_GRAPH_TRANSITION_UNKNOWN_STATUS', httpStatus: 400, category: 'Workflow · шаблоны', meaning: 'PUT …/graph: переход ссылается на id статуса, которого нет среди statuses этого запроса' },

  // --- Workflow: инстансы ------------------------------------------------
  { code: 'WORKFLOW_INSTANCE_NOT_FOUND', httpStatus: 404, category: 'Workflow · инстансы', meaning: 'Взаимодействие с таким id не существует' },
  { code: 'UNIVERSITY_NOT_FOUND', httpStatus: 404, category: 'Workflow · инстансы', meaning: 'Вуз с таким id не существует (при создании/назначении инстанса)' },
  { code: 'INSTANCE_RESPONSIBLE_REQUIRED', httpStatus: 400, category: 'Workflow · инстансы', meaning: 'responsibleUserId не передан, а у вуза нет University.kamId по умолчанию' },
  {
    code: 'WORKFLOW_TRANSITION_NOT_ALLOWED',
    httpStatus: 400,
    category: 'Workflow · инстансы',
    meaning: 'Переход из текущего статуса в запрошенный не описан WorkflowTransition этой версии шаблона',
    uiHint: 'Показать конкретное сообщение с названиями статусов из ответа, а не общий текст ошибки — это ожидаемый пользовательский сценарий (например, устаревшая кнопка перехода на клиенте), не баг',
  },
  {
    code: 'WORKFLOW_STATE_CONFLICT',
    httpStatus: 409,
    category: 'Workflow · инстансы',
    meaning: 'Статус уже изменился между чтением карточки и отправкой перехода (двойной клик/параллельный запрос — compare-and-swap не прошёл)',
    uiHint: 'Перезапросить карточку инстанса и попросить пользователя повторить действие, не ретраить автоматически с теми же данными',
  },
  { code: 'WORKFLOW_ATTACHMENT_NOT_FOUND', httpStatus: 400, category: 'Workflow · инстансы', meaning: 'attachmentId перехода ссылается на несуществующий файл' },
  { code: 'WORKFLOW_ACTOR_UNKNOWN', httpStatus: 400, category: 'Workflow · инстансы', meaning: 'Не удалось определить пользователя, выполняющего переход (нет currentUserId)' },
  { code: 'WORKFLOW_ASSIGNMENT_EMPTY', httpStatus: 400, category: 'Workflow · инстансы', meaning: 'PATCH …/assignment без universityId и responsibleUserId — нужно хотя бы одно' },
  { code: 'WORKFLOW_PATCH_EMPTY', httpStatus: 400, category: 'Workflow · инстансы', meaning: 'PATCH /workflow/instances/{id} без responsibleUserId, itProductId и note — нужно хотя бы одно' },
  {
    code: 'WORKFLOW_STATUS_VIA_TRANSITION_ONLY',
    httpStatus: 400,
    category: 'Workflow · инстансы',
    meaning: 'PATCH /workflow/instances/{id} попытался передать currentStatusId/toStatusId/workflowTemplateVersionId — статус меняется только через POST …/transition',
    uiHint: 'Признак ошибки интеграции на фронте (не пользовательский сценарий) — использовать transition-эндпоинт для смены статуса',
  },
  { code: 'WORKFLOW_FIELD_NOT_PATCHABLE', httpStatus: 400, category: 'Workflow · инстансы', meaning: 'PATCH /workflow/instances/{id} содержит поле, которое этим эндпоинтом не редактируется (например universityId — для него PATCH …/assignment)' },
  { code: 'WORKFLOW_REASSIGN_FORBIDDEN', httpStatus: 403, category: 'Workflow · инстансы', meaning: 'Ответственного пытается сменить КАМ — это может только Руководитель (в своей команде) или Администратор' },
  { code: 'RESPONSIBLE_MUST_BE_KAM', httpStatus: 400, category: 'Workflow · инстансы', meaning: 'responsibleUserId/kamId ссылается на пользователя не с ролью KAM' },
  { code: 'KAM_NOT_FOUND', httpStatus: 400, category: 'Workflow · инстансы', meaning: 'responsibleUserId/kamId ссылается на несуществующего пользователя' },

  // --- Каталоги ------------------------------------------------------------
  { code: 'IT_PRODUCT_NOT_FOUND', httpStatus: 404, category: 'Каталоги', meaning: 'ИТ-продукт с таким id не существует' },
  { code: 'LICENSE_INVALID_PERIOD', httpStatus: 400, category: 'Каталоги', meaning: 'startDate лицензии не раньше endDate' },
  { code: 'RESPONSIBLE_PERSON_WITHOUT_LINK', httpStatus: 400, category: 'Каталоги', meaning: 'У ответственного лица не указаны ни universityId, ни itProductId — оно не может быть ни к чему не привязано' },

  // --- Импорт вузов ----------------------------------------------------
  { code: 'FILE_REQUIRED', httpStatus: 400, category: 'Импорт', meaning: 'Нужен multipart-файл в поле "file"' },
  { code: 'IMPORT_EMPTY_WORKBOOK', httpStatus: 400, category: 'Импорт', meaning: 'В xlsx-файле нет ни одного листа' },
  { code: 'IMPORT_MAPPING_INVALID', httpStatus: 400, category: 'Импорт', meaning: 'Поле mapping не JSON-строка с массивом {column, field}' },
  { code: 'IMPORT_COLUMN_NOT_FOUND', httpStatus: 400, category: 'Импорт', meaning: 'Колонка из mapping не найдена среди заголовков файла' },
  { code: 'IMPORT_NAME_MAPPING_REQUIRED', httpStatus: 400, category: 'Импорт', meaning: 'В mapping нет колонки для обязательного поля universityName' },
  { code: 'IMPORT_ACTOR_UNKNOWN', httpStatus: 400, category: 'Импорт', meaning: 'Не удалось определить пользователя, инициирующего импорт (нет currentUserId)' },
  { code: 'IMPORT_PREVIEW_NOT_FOUND', httpStatus: 404, category: 'Импорт', meaning: 'previewId не найден или истёк (превью хранится ограниченное время)' },

  // --- Интеграции (LMS/сайт, мок) ---------------------------------------
  { code: 'COURSE_MAPPING_ALREADY_EXISTS', httpStatus: 400, category: 'Интеграции', meaning: 'POST course-mapping на курс, для которого соответствие уже есть — нужен PATCH/PUT' },
  { code: 'COURSE_MAPPING_NOT_FOUND', httpStatus: 404, category: 'Интеграции', meaning: 'PATCH/PUT course-mapping на курс, для которого соответствия ещё нет — нужен POST' },

  // --- Файлы ------------------------------------------------------------
  { code: 'FILE_NOT_FOUND', httpStatus: 404, category: 'Файлы', meaning: 'Файл с таким id не существует' },
  { code: 'FILE_ACTOR_UNKNOWN', httpStatus: 400, category: 'Файлы', meaning: 'Не удалось определить пользователя, загружающего файл (нет currentUserId)' },
  { code: 'STORAGE_UNAVAILABLE', httpStatus: 503, category: 'Файлы', meaning: 'Хранилище файлов (MinIO/S3-совместимое) недоступно' },

  // --- Отчёты и очередь ---------------------------------------------------
  { code: 'REPORT_TYPE_INVALID', httpStatus: 400, category: 'Отчёты', meaning: 'POST /reports/jobs: type не из LICENSE_RADAR|SLA_RADAR|INTERACTIONS_EXPORT' },
  { code: 'REPORT_QUEUE_UNAVAILABLE', httpStatus: 503, category: 'Отчёты', meaning: 'Очередь отчётов (Redis/BullMQ) недоступна' },
  { code: 'REPORT_JOB_NOT_FOUND', httpStatus: 404, category: 'Отчёты', meaning: 'Задание отчёта не найдено (или уже удалено по сроку хранения)' },
  { code: 'REPORT_JOB_FORBIDDEN', httpStatus: 403, category: 'Отчёты', meaning: 'Задание отчёта создано другим пользователем (видит автор и Администратор)' },

  // --- Администрирование пользователей ------------------------------------
  { code: 'USER_NOT_FOUND', httpStatus: 404, category: 'Пользователи', meaning: 'Пользователь с таким id не существует' },
  { code: 'USER_MANAGER_INVALID', httpStatus: 400, category: 'Пользователи', meaning: 'managerId ссылается на самого пользователя' },
];

export function buildErrorCodesMarkdown(): string {
  const byCategory = new Map<string, ErrorCodeDoc[]>();
  for (const entry of ERROR_CODES) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }
  const lines = [
    '## Коды ошибок',
    '',
    'Единый формат ответа на любую ошибку: `{ "code": string, "message": string, "details"?: any }`. ' +
      '`message` — человекочитаемый текст на русском для отображения "как есть". `details` заполнено только у ' +
      '`VALIDATION_ERROR` (массив `{field, errors[]}`). Коды ниже сгруппированы по областям; `uiHint` указан там, где фронту ' +
      'стоит обработать код отдельно, а не просто показать `message`.',
    '',
    '| code | HTTP | Значение | UI |',
    '| --- | --- | --- | --- |',
  ];
  for (const [category, entries] of byCategory) {
    lines.push(`| **${category}** | | | |`);
    for (const e of entries) {
      lines.push(`| \`${e.code}\` | ${e.httpStatus || '—'} | ${e.meaning} | ${e.uiHint ?? '—'} |`);
    }
  }
  return lines.join('\n');
}
