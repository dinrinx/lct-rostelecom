/* CRM ИТ Школа РТК — клиент API + демо-фикстуры.
   Формы данных повторяют DTO из backend/src/(модуль)/dto (Swagger — источник истины).
   Режимы: auto — живой API, при сетевой ошибке фолбэк на фикстуры; api — только API; demo — только фикстуры.
   Справочники (сотрудники, шаблон workflow с SLA/сроками этапов) при старте подтягиваются из API —
   window.CRM появляется после этого, страницы ждут его через waitCRM(). Фикстуры используют те же id,
   что и backend/prisma/seed.ts, поэтому демо-режим и живой API показывают одну картину. */
(function () {
  if (window.CRM) return;
  const DAY = 864e5;
  const NOW = Date.now();
  const ago = (d, h = 10) => new Date(NOW - d * DAY + h * 36e5 - 12 * 36e5).toISOString();
  const ahead = (d) => new Date(NOW + d * DAY).toISOString();
  const id = (p, n) => p + '-0000-4000-8000-' + String(n).padStart(12, '0');
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  // --- справочники UI -------------------------------------------------------
  const PHASES = [
    // Подписи и цвета — компонент «Status / Stage» из макета Figma (01 Контакт … 07 Сопровождение). Ключи — enum phase бэкенда.
    { key: 'INITIATION', num: '01', label: 'Контакт', color: 'rgb(88,93,105)', bg: 'rgb(182,183,192)', badgeBg: 'rgb(238,240,245)', badgeFg: 'rgb(104,112,133)' },
    { key: 'NEGOTIATION', num: '02', label: 'Квалификация', color: 'rgb(46,124,246)', bg: 'rgb(155,192,251)', badgeBg: 'rgb(236,242,255)', badgeFg: 'rgb(40,93,181)' },
    { key: 'CONTRACTING', num: '03', label: 'Согласование', color: 'rgb(119,0,255)', bg: 'rgb(194,153,255)', badgeBg: 'rgb(242,234,254)', badgeFg: 'rgb(89,0,199)' },
    { key: 'IMPLEMENTATION', num: '04', label: 'Договор', color: 'rgb(254,79,19)', bg: 'rgb(255,166,136)', badgeBg: 'rgb(248,234,243)', badgeFg: 'rgb(147,68,119)' },
    { key: 'ACTIVE_USE', num: '05', label: 'Лицензия', color: 'rgb(255,159,10)', bg: 'rgb(255,208,138)', badgeBg: 'rgb(255,245,223)', badgeFg: 'rgb(152,98,11)' },
    { key: 'RENEWAL', num: '06', label: 'Обучение', color: 'rgb(17,202,91)', bg: 'rgb(133,228,174)', badgeBg: 'rgb(232,246,239)', badgeFg: 'rgb(19,119,95)' },
    { key: 'TERMINATION', num: '07', label: 'Сопровождение', color: 'rgb(15,26,40)', bg: 'rgb(231,231,238)', badgeBg: 'rgb(231,245,248)', badgeFg: 'rgb(29,113,132)' },
  ];
  const PHASE = Object.fromEntries(PHASES.map((p) => [p.key, p]));
  const BUCKETS = [
    { key: 'OVERDUE', label: 'Просрочены', short: 'Просрочено', color: 'var(--color-error)', fg: 'var(--color-error-strong)' },
    { key: 'DUE_IN_7_DAYS', label: 'До 7 дней', short: '≤ 7 дней', color: 'var(--color-accent)', fg: 'var(--color-accent-strong)' },
    { key: 'DUE_IN_30_DAYS', label: 'До 30 дней', short: '≤ 30 дней', color: 'var(--color-warning)', fg: 'var(--color-warning-strong)' },
    { key: 'DUE_IN_60_DAYS', label: 'До 60 дней', short: '≤ 60 дней', color: 'var(--color-neutral-muted)', fg: 'var(--color-fg-soft)' },
  ];
  const HEALTH_LEVELS = {
    red: { label: 'Требует внимания', color: 'var(--color-error)', fg: 'var(--color-error-strong)', bg: 'var(--color-error-muted)' },
    yellow: { label: 'Есть риски', color: 'var(--color-warning)', fg: 'var(--color-warning-strong)', bg: 'var(--color-warning-muted)' },
    green: { label: 'Всё в порядке', color: 'var(--color-success)', fg: 'var(--color-success-strong)', bg: 'var(--color-success-muted)' },
  };
  const ROLES = {
    kam: { dto: 'KAM', label: 'КАМ', title: 'Менеджер по вузам', scope: 'Мои вузы' },
    rukovoditel: { dto: 'RUKOVODITEL', label: 'Руководитель', scope: 'Команда' },
    administrator: { dto: 'ADMINISTRATOR', label: 'Администратор', scope: 'Все данные' },
  };
  const FILE_FORMATS = ['png', 'jpeg', 'jpg', 'pdf', 'zip', 'gzip', 'gz', 'rar', 'doc', 'docx', 'xls', 'xlsx'];

  // --- фикстуры в форме DTO ---------------------------------------------------
  const RUK = id('c0000000', 2);
  const USERS = [
    { id: id('c0000000', 1), email: 'kam@it-shkola-rtk.ru', fullName: 'Иванова Мария Сергеевна', role: 'KAM', isActive: true, managerId: RUK },
    { id: RUK, email: 'rukovoditel@it-shkola-rtk.ru', fullName: 'Петров Сергей Николаевич', role: 'RUKOVODITEL', isActive: true, managerId: null },
    { id: id('c0000000', 3), email: 'admin@it-shkola-rtk.ru', fullName: 'Администратор Платформы', role: 'ADMINISTRATOR', isActive: true, managerId: null },
    { id: id('c0000000', 4), email: 'orlov.da@it-shkola-rtk.ru', fullName: 'Орлов Дмитрий Андреевич', role: 'KAM', isActive: true, managerId: RUK },
    { id: id('c0000000', 5), email: 'vasilieva.ai@it-shkola-rtk.ru', fullName: 'Васильева Анна Игоревна', role: 'KAM', isActive: true, managerId: RUK },
    { id: id('c0000000', 6), email: 'gromov.po@it-shkola-rtk.ru', fullName: 'Громов Павел Олегович', role: 'KAM', isActive: true, managerId: RUK },
    { id: id('c0000000', 7), email: 'sidorova.el@it-shkola-rtk.ru', fullName: 'Сидорова Екатерина Львовна', role: 'KAM', isActive: true, managerId: RUK },
    { id: id('c0000000', 8), email: 'fedorov.iv@it-shkola-rtk.ru', fullName: 'Фёдоров Илья Викторович', role: 'KAM', isActive: false, managerId: RUK },
  ];
  const KAMS = USERS.filter((u) => u.role === 'KAM' && u.isActive);
  const K = KAMS.map((u) => u.id);

  const DIRECTIONS = [
    { id: id('a1000000', 1), name: 'DevOps', description: null },
    { id: id('a1000000', 2), name: 'Анализ данных', description: null },
    { id: id('a1000000', 3), name: 'Разработка ПО', description: null },
    { id: id('a1000000', 4), name: 'Инфраструктура и облака', description: null },
    { id: id('a1000000', 5), name: 'Информационная безопасность', description: null },
  ];
  const VENDORS = [
    ['ООО «Базис»', 'Иванов Иван Иванович', '+7 (900) 111-22-33', 'ivanov.ii@example.ru', 'Почта, Чат в ТГ'],
    ['ООО «ТДата»', 'Смирнова Анна Петровна', '+7 (911) 222-33-44', 'smirnova.ap@example.ru', 'Чат в ТГ'],
    ['ПАО «Ростелеком»', 'Кузнецов Дмитрий Сергеевич', '+7 (922) 333-44-55', 'kuznetsov.ds@example.ru', 'Чат в ТГ'],
    ['ООО «РТК ИТ Плюс»', 'Попова Мария Владимировна', '+7 (933) 444-55-66', 'popova.mv@example.ru', 'Чат в ТГ'],
    ['ООО «РТК ИТ»', 'Лебедева Елена Дмитриевна', '+7 (955) 666-77-88', 'lebedeva.ed@example.ru', 'Чат в ТГ'],
  ].map((v, i) => ({ id: id('a2000000', i + 1), name: v[0], contactInfo: null, contactName: v[1], contactPhone: v[2], contactEmail: v[3], contactChannel: v[4], createdAt: ago(40), updatedAt: ago(40) }));
  const PRODUCTS = [
    ['Базис Dynamix', 3, 0], ['RT.DataLake', 1, 1], ['RT.Warehouse', 1, 1], ['RT.DataVision', 1, 2], ['AKOLA', 0, 3],
    ['Яга', 0, 3], ['Web3Gate', 2, 4], ['Аврора SDK', 2, 4], ['Нейрошлюз', 4, 4],
  ].map((p, i) => ({ id: id('a3000000', i + 1), name: p[0], itDirectionId: DIRECTIONS[p[1]].id, vendorId: VENDORS[p[2]].id }));
  const UNIVERSITIES = [
    ['СПбГУ', 'Санкт-Петербург', 0], ['МГТУ им. Н. Э. Баумана', 'Москва', 0], ['НГУ', 'Новосибирская область', 1],
    ['УрФУ', 'Свердловская область', 1], ['Университет ИТМО', 'Санкт-Петербург', 0], ['КФУ', 'Республика Татарстан', 2],
    ['ТГУ', 'Томская область', 2], ['ДВФУ', 'Приморский край', 3], ['СФУ', 'Красноярский край', 3],
    ['МФТИ', 'Московская область', 4], ['ЮФУ', 'Ростовская область', 4], ['ННГУ им. Лобачевского', 'Нижегородская область', null],
  ].map((u, i) => ({ id: id('a5000000', i + 1), name: u[0], inn: null, region: u[1], website: null, kamId: u[2] == null ? null : K[u[2]] }));

  // Статусы workflow. minDays — минимальная длительность этапа (для критического пути),
  // deps — от каких этапов зависит начало (по умолчанию — предыдущий). В API это
  // WorkflowStatusDto.minDays / dependsOnStatusIds / isOptional, норматив SLA — slaDays.
  const VERSION_ID = id('b0000000', 2);
  const STATUS_DEFS = [
    ['Инициация', 'INITIATION', 10, 3],
    ['Переговоры', 'NEGOTIATION', 14, 7],
    ['Оформление партнёрства', 'CONTRACTING', 21, 14],
    ['Передача материалов и лицензий', 'IMPLEMENTATION', 10, 5],
    ['Внедрение продукта', 'IMPLEMENTATION', 30, 14],
    ['Подготовка к запуску обучения', 'ACTIVE_USE', 21, 10, [2]],
    ['Проведение обучения', 'ACTIVE_USE', 120, 30, [4, 5]],
    ['Сопровождение и актуализация', 'RENEWAL', 60, 14],
    ['Завершено', 'TERMINATION', null, 0],
  ];
  const SLA = {};
  const META = {};
  const STATUSES = STATUS_DEFS.map((s, i) => { const st = { id: id('b1000000', i + 1), name: s[0], phase: s[1], order: i + 1, workflowTemplateVersionId: VERSION_ID }; if (s[2]) SLA[st.id] = s[2]; return st; });
  STATUS_DEFS.forEach((s, i) => { META[STATUSES[i].id] = { minDays: s[3], deps: (s[4] || (i ? [i - 1] : [])).map((j) => STATUSES[j].id) }; });
  const TEMPLATE = { id: id('b0000000', 1), name: 'Типовой цикл внедрения ИТ-продукта', description: 'Базовый CLM-шаблон для вузов' };
  const tr = (f, t, name) => ({ id: id('b2000000', f * 100 + t), name, workflowTemplateVersionId: VERSION_ID, fromStatusId: STATUSES[f].id, toStatusId: STATUSES[t].id });
  const TRANSITIONS = [];
  for (let i = 0; i < 8; i++) TRANSITIONS.push(tr(i, i + 1, 'Далее'));
  TRANSITIONS.push(tr(2, 1, 'Вернуть на переговоры'), tr(7, 5, 'Новый учебный поток'));
  let VERSIONS = [
    { id: id('b0000000', 3), versionNumber: 1, isActive: false, workflowTemplateId: TEMPLATE.id, statuses: STATUSES.slice(0, 7), transitions: TRANSITIONS.slice(0, 6) },
    { id: VERSION_ID, versionNumber: 2, isActive: true, workflowTemplateId: TEMPLATE.id, statuses: STATUSES, transitions: TRANSITIONS },
  ];

  const COMMENTS = [
    'Взаимодействие создано', 'Провели встречу, согласовали состав программ', 'Договор о партнёрстве подписан',
    'Лицензии и методички переданы вузу', 'Развернули стенд в лаборатории вуза', 'Программа и расписание утверждены',
    'Стартовал поток на 48 студентов', 'Обновили документацию и материалы', 'Цикл закрыт, отчёт отправлен',
  ];

  // Реестр взаимодействий в форме InteractionReportItemDto
  const INTERACTIONS = [];
  const HISTORY = {};
  const FILES = [];
  const plan = [
    [0, 0, 2, 26], [0, 3, 4, 12], [1, 2, 1, 18], [1, 1, 5, 18], [4, 0, 0, 14], [4, 7, 3, 4], [1, 6, 2, 9], [0, 1, 7, 40],
    [2, 1, 1, 5], [2, 3, 4, 35], [3, 4, 5, 30], [3, 5, 0, 11], [2, 2, 7, 12],
    [5, 6, 3, 14], [5, 7, 1, 2], [6, 8, 6, 36], [6, 6, 0, 4],
    [7, 4, 3, 19], [7, 5, 1, 12], [8, 3, 2, 1], [8, 2, 6, 14], [7, 0, 8, 6],
    [9, 7, 2, 25], [9, 8, 3, 9], [10, 6, 0, 3], [10, 1, 4, 13], [9, 0, 6, 60], [11, 3, 1, 6],
  ];
  plan.forEach(([u, p, s, days], i) => {
    const uni = UNIVERSITIES[u], prod = PRODUCTS[p], st = STATUSES[s];
    const dir = DIRECTIONS.find((d) => d.id === prod.itDirectionId);
    const resp = uni.kamId || K[4];
    const user = USERS.find((x) => x.id === resp);
    const iid = id('b3000000', i + 1);
    const created = days + s * 11 + 4;
    INTERACTIONS.push({
      interactionInstanceId: iid, universityId: uni.id, universityName: uni.name, itDirectionId: dir.id, itDirectionName: dir.name,
      itProductId: prod.id, itProductName: prod.name, currentStatusId: st.id, currentStatusName: st.name, currentPhase: st.phase,
      responsibleUserId: resp, responsibleUserName: user.fullName, createdAt: ago(created), updatedAt: ago(days, 14),
      daysInCurrentStatus: days, isOverdue: !!SLA[st.id] && days > SLA[st.id],
    });
    HISTORY[iid] = [];
    for (let k = 0; k <= s; k++) {
      const d = k === s ? days : days + (s - k) * 11;
      const at = ago(d, 11 + (k % 5));
      HISTORY[iid].push({ id: id('b4000000', i * 20 + k + 1), interactionInstanceId: iid, fromStatusId: k ? STATUSES[k - 1].id : null, toStatusId: STATUSES[k].id,
        toStatusName: STATUSES[k].name, toStatusPhase: STATUSES[k].phase, fromStatusName: k ? STATUSES[k - 1].name : null, attachmentId: null, comment: k === 0 ? 'Взаимодействие создано' : COMMENTS[k], changedById: resp, changedAt: at });
      if (k === 2 || k === 3 || k === 6) {
        const name = k === 3 ? 'paket-dokumentov.zip' : k === 2 ? 'dogovor-' + (i + 1) + '-podpisan.pdf' : 'foto-obucheniya.jpeg';
        FILES.push({ id: id('f0000000', FILES.length + 1), fileName: name, mimeType: k === 3 ? 'application/zip' : k === 2 ? 'application/pdf' : 'image/jpeg', size: k === 3 ? 1843200 : k === 2 ? 245760 : 612000, storageKey: 'attachments/' + name, uploadedById: resp, interactionInstanceId: iid, licenseId: null, createdAt: at });
      }
    }
  });

  const LIC_OFFSETS = [[-12, 0, 0], [-5, 1, 1], [-2, 3, 4], [3, 0, 1], [6, 2, 2], [12, 5, 6], [19, 1, 2], [27, 7, 5], [35, 4, 7], [44, 9, 8], [52, 6, 0], [58, 10, 6], [120, 3, 2], [210, 8, 3], [400, 2, 4]];
  const LICENSES = LIC_OFFSETS.map(([off, u, p], i) => ({
    id: id('a6000000', i + 1), contractNumber: 'ИТШ-' + (2025 + (i % 2)) + '/' + String(117 + i * 7).padStart(4, '0'), status: off < 0 ? 'TERMINATED' : 'ACTIVE', seats: 25 + (i % 4) * 25,
    startDate: ago(365 - off), endDate: ahead(off), universityId: UNIVERSITIES[u].id, itProductId: PRODUCTS[p].id, createdAt: ago(365), updatedAt: ago(20),
  }));

  // --- helpers -----------------------------------------------------------------
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const userName = (uid) => (uid ? (USERS.find((u) => u.id === uid) || {}).fullName || 'Сотрудник' : LABELS.responsible);
  // Взаимодействия из интеграции (POST /integrations/sync, needsReview=true) приходят без вуза,
  // продукта и ответственного (null). Подставляем подписи один раз на уровне данных, чтобы
  // ни один экран (доска, реестр, отчёты, тосты, критический путь) не показывал «null».
  const LABELS = { university: 'Вуз не определён', product: 'Продукт не определён', direction: 'Направление не определено', responsible: 'Не назначен', needsReview: 'Требует проверки' };
  const withLabels = (r) => ({ ...r, universityName: r.universityName || LABELS.university, itProductName: r.itProductName || LABELS.product,
    itDirectionName: r.itDirectionName || LABELS.direction, responsibleUserName: r.responsibleUserName || LABELS.responsible, needsReview: !!r.needsReview });
  const uniById = (uid) => UNIVERSITIES.find((u) => u.id === uid);
  const bucketOf = (end) => { const d = Math.ceil((new Date(end) - NOW) / DAY); return d < 0 ? 'OVERDUE' : d <= 7 ? 'DUE_IN_7_DAYS' : d <= 30 ? 'DUE_IN_30_DAYS' : d <= 60 ? 'DUE_IN_60_DAYS' : null; };
  const scope = (role) => (x) => role === 'kam' ? x.responsibleUserId === K[0] : true;
  const uniScope = (role) => (u) => role === 'kam' ? u.kamId === K[0] : true;

  function fxInteractions(role, q = {}) {
    let r = INTERACTIONS.filter(scope(role));
    if (q.from) r = r.filter((x) => x.updatedAt >= q.from);
    if (q.to) r = r.filter((x) => x.updatedAt.slice(0, 10) <= q.to);
    ['universityId', 'itDirectionId', 'itProductId', 'responsibleUserId'].forEach((k) => { if (q[k]) r = r.filter((x) => x[k] === q[k]); });
    if (q.onlyOverdue) r = r.filter((x) => x.isOverdue);
    return clone(r);
  }
  function fxLicenseRadar(role) {
    const unis = UNIVERSITIES.filter(uniScope(role)).map((u) => u.id);
    return { jobId: id('d0000000', 1), generatedAt: new Date().toISOString(), items: LICENSES.filter((l) => unis.includes(l.universityId)).map((l) => ({ licenseId: l.id, contractNumber: l.contractNumber, universityId: l.universityId, universityName: uniById(l.universityId).name, itProductId: l.itProductId, itProductName: PRODUCTS.find((p) => p.id === l.itProductId).name, endDate: l.endDate, bucket: bucketOf(l.endDate) })).filter((x) => x.bucket) };
  }
  function fxSlaRadar(role) {
    return { generatedAt: new Date().toISOString(), items: INTERACTIONS.filter(scope(role)).filter((x) => x.isOverdue).map((x) => ({ interactionInstanceId: x.interactionInstanceId, universityId: x.universityId, universityName: x.universityName, currentStatusId: x.currentStatusId, currentStatusName: x.currentStatusName, phase: x.currentPhase, responsibleUserId: x.responsibleUserId, responsibleUserName: x.responsibleUserName, statusSince: ago(x.daysInCurrentStatus, 14), daysInStatus: x.daysInCurrentStatus, slaThresholdDays: SLA[x.currentStatusId] })) };
  }
  // Фолбэк для GET /dashboard/health-score — та же формула, что и в
  // backend/src/reports/health-score/health-score.service.ts (значения по
  // умолчанию из healthScoreConfig), чтобы демо-режим не расходился с бэком.
  const HEALTH_CFG = { licenseRed: 7, licenseYellow: 30, slaRedRatio: 2, staleDays: 30 };
  function fxHealthLevel(licenseDays, daysInStatus, slaThreshold, staleDays, needsReviewCount) {
    let score = 100; const reasons = [];
    let licenseLevel = 'green';
    if (licenseDays != null) {
      if (licenseDays < HEALTH_CFG.licenseRed) { licenseLevel = 'red'; score -= 40; reasons.push(licenseDays < 0 ? 'Лицензия истекла ' + -licenseDays + ' дн. назад' : 'Лицензия истекает через ' + licenseDays + ' дн.'); }
      else if (licenseDays < HEALTH_CFG.licenseYellow) { licenseLevel = 'yellow'; score -= 15; reasons.push('Лицензия истекает через ' + licenseDays + ' дн.'); }
    }
    let slaLevel = 'green';
    if (slaThreshold && daysInStatus > slaThreshold) {
      const over = daysInStatus - slaThreshold, ratio = daysInStatus / slaThreshold;
      if (ratio > HEALTH_CFG.slaRedRatio) { slaLevel = 'red'; score -= 35; reasons.push('Критическая просрочка SLA: ' + over + ' дн. сверх норматива ' + slaThreshold + ' дн.'); }
      else { slaLevel = 'yellow'; score -= 15; reasons.push('Просрочка SLA: ' + over + ' дн. сверх норматива ' + slaThreshold + ' дн.'); }
    }
    if (staleDays != null && staleDays >= HEALTH_CFG.staleDays) { score -= 15; reasons.push('Нет активности по вузу ' + staleDays + ' дн.'); }
    if (needsReviewCount > 0) { score -= Math.min(needsReviewCount * 8, 24); reasons.push(needsReviewCount + ' ' + (needsReviewCount === 1 ? 'взаимодействие требует' : 'взаимодействий требуют') + ' проверки (needsReview)'); }
    const level = licenseLevel === 'red' || slaLevel === 'red' ? 'red' : licenseLevel === 'yellow' || slaLevel === 'yellow' ? 'yellow' : 'green';
    return { score: Math.max(0, Math.min(100, Math.round(score))), level, reasons };
  }
  function fxHealthScore(role, limit) {
    const unis = UNIVERSITIES.filter(uniScope(role));
    const items = unis.map((u) => {
      const lics = LICENSES.filter((l) => l.universityId === u.id);
      const licenseDays = lics.length ? Math.min(...lics.map((l) => Math.ceil((new Date(l.endDate) - NOW) / DAY))) : null;
      const rows = INTERACTIONS.filter((x) => x.universityId === u.id);
      let worst = null, staleDays = null;
      rows.forEach((x) => {
        const threshold = SLA[x.currentStatusId] || 0;
        const ratio = threshold ? x.daysInCurrentStatus / threshold : 0;
        if (!worst || ratio > worst.ratio) worst = { daysInStatus: x.daysInCurrentStatus, threshold, ratio };
        staleDays = staleDays == null ? x.daysInCurrentStatus : Math.min(staleDays, x.daysInCurrentStatus);
      });
      const { score, level, reasons } = fxHealthLevel(licenseDays, worst ? worst.daysInStatus : 0, worst ? worst.threshold : null, staleDays, 0);
      return { vuzId: u.id, vuzName: u.name, score, level, reasons };
    });
    items.sort((a, b) => a.score - b.score || a.vuzName.localeCompare(b.vuzName, 'ru'));
    return limit ? items.slice(0, limit) : items;
  }
  function fxCharts(role, q) {
    const r = fxInteractions(role, q);
    const by = (f) => { const m = {}; r.forEach((x) => { const k = f(x); m[k] = (m[k] || 0) + 1; }); return m; };
    const st = by((x) => x.currentStatusName);
    const months = {}; r.forEach((x) => { const k = x.createdAt.slice(0, 7) + '-01'; months[k] = (months[k] || 0) + 1; });
    const lic = {}; LICENSES.forEach((l) => { const n = PRODUCTS.find((p) => p.id === l.itProductId).name; lic[n] = (lic[n] || 0) + 1; });
    return { statusDistribution: Object.entries(st).map(([label, value]) => ({ label, value })), interactionsOverTime: Object.entries(months).sort().map(([date, value]) => ({ date, value })), licensesByProduct: Object.entries(lic).map(([label, value]) => ({ label, value })) };
  }

  // Демо-ответ превью импорта — в той же форме, что и бэкенд (ImportPreviewResultDto).
  const IMPORT_COLUMNS = ['Наименование организации', 'ИНН', 'Регион', 'Сайт', 'Контакт в вузе'];
  function fxImportPreview(file, mapping) {
    const base = { previewId: id('h0000000', 1), fileName: (file && file.name) || 'Реестр вузов.xlsx', availableColumns: IMPORT_COLUMNS, totalRows: 6, skippedRows: 0 };
    if (!mapping) return { ...base, appliedMapping: [{ column: 'Наименование организации', field: 'universityName' }, { column: 'ИНН', field: 'inn' }, { column: 'Регион', field: 'region' }, { column: 'Сайт', field: 'website' }], isMappingSuggestion: true, rows: [], duplicateRows: 0 };
    return { ...base, appliedMapping: mapping, isMappingSuggestion: false, duplicateRows: 3, rows: [
      { rowNumber: 2, universityName: 'СПбГУ им. Петра Великого', match: 'DUPLICATE_FUZZY', matchedUniversityId: UNIVERSITIES[0].id, similarity: 0.82 },
      { rowNumber: 3, universityName: 'МГТУ им. Н. Э. Баумана', match: 'DUPLICATE_EXACT', matchedUniversityId: UNIVERSITIES[1].id },
      { rowNumber: 4, universityName: 'Уральский федеральный университет', match: 'DUPLICATE_FUZZY', matchedUniversityId: UNIVERSITIES[3].id, similarity: 0.78 },
      { rowNumber: 5, universityName: 'Самарский университет', match: 'NEW', matchedUniversityId: null },
      { rowNumber: 6, universityName: 'ПГНИУ', match: 'NEW', matchedUniversityId: null },
      { rowNumber: 7, universityName: 'ВолгГТУ', match: 'NEW', matchedUniversityId: null },
    ] };
  }

  // --- транспорт -----------------------------------------------------------------
  // Локально фронтенд и backend на разных портах (python serve.py:8123 и
  // Nest:3000) — оставляем как раньше. На боевом домене nginx разруливает
  // фронт и /admin|/auth|/... по одному origin (см. infra/nginx/conf.d),
  // поэтому base — пустая строка, и call() ниже бьёт в тот же origin.
  const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);
  const cfg = { base: isLocalHost ? 'http://localhost:3000' : '', role: 'kam', mode: 'auto' };
  // Ссылки на скачивание (files/reports) backend отдаёт относительными путями
  // (/files/{id}/content и т.п.) — presigned-адреса на внутренний Docker-хост
  // хранилища браузеру недоступны. absUrl достраивает их до cfg.base, чтобы
  // компоненты (CrmInteraction/CrmReports) просто открывали d.url как раньше.
  const absUrl = (u) => (u && u.startsWith('/') ? cfg.base + u : u);
  const stats = { total: 0, errors: 0, ms: 0, api: 0, fixtures: 0, last: null };
  const listeners = new Set();
  let lastSource = null;
  const emit = () => listeners.forEach((f) => f({ source: lastSource, stats: { ...stats } }));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let failNext = null;

  class ApiError extends Error { constructor(code, message, details, httpStatus) { super(message); this.code = code; this.details = details; this.httpStatus = httpStatus; } }

  async function call(method, path, { body, form, fallback, query } = {}) {
    const t0 = performance.now();
    stats.total++;
    const qs = query ? '?' + Object.entries(query).filter(([, v]) => v !== '' && v != null && v !== false).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&') : '';
    const finish = (src) => { stats.ms = Math.round(performance.now() - t0); stats.last = method + ' ' + path; lastSource = src; stats[src === 'api' ? 'api' : 'fixtures']++; emit(); };
    try {
      if (failNext) { const f = failNext; failNext = null; await wait(350); throw new ApiError(f.code, f.message, f.details, f.httpStatus); }
      if (cfg.mode !== 'demo') {
        let res;
        try {
          const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 2500);
          const headers = { 'X-Dev-Role': cfg.role };
          if (body) headers['Content-Type'] = 'application/json';
          res = await fetch(cfg.base.replace(/\/$/, '') + path + qs, { method, headers, body: form || (body ? JSON.stringify(body) : undefined), signal: ctl.signal });
          clearTimeout(to);
        } catch (netErr) {
          if (cfg.mode === 'api' || !fallback) throw new ApiError('NETWORK_UNAVAILABLE', 'Сервер недоступен. Проверьте подключение', { base: cfg.base });
          res = null;
        }
        if (res) {
          if (!res.ok) {
            let j = {}; try { j = await res.json(); } catch (e) { }
            throw new ApiError(j.code || 'HTTP_' + res.status, j.message ? String(j.message) : 'Ошибка сервера', j.details, res.status);
          }
          const txt = await res.text();
          finish('api');
          return txt ? JSON.parse(txt) : null;
        }
      }
      await wait(220 + Math.round(rnd() * 380));
      const out = typeof fallback === 'function' ? fallback() : fallback;
      finish('fixtures');
      return clone(out === undefined ? null : out);
    } catch (e) {
      stats.errors++; stats.ms = Math.round(performance.now() - t0); emit();
      throw e instanceof ApiError ? e : new ApiError('UNEXPECTED', e.message || 'Непредвиденная ошибка');
    }
  }

  // Реальные ссылки на скачивание (files/*/content, reports export-status/*/download)
  // защищены тем же DevRoleGuard, что и остальной API — заголовок X-Dev-Role
  // нужен на каждый запрос. Обычная навигация (window.open/<a href>) заголовков
  // не передаёт, поэтому качаем через fetch (как и все остальные вызовы) и
  // отдаём результат браузеру как blob — a.click() на object URL сохраняет
  // файл под нужным именем, как обычная ссылка.
  async function saveAs(url, fileName) {
    if (!url || url === '#') return;
    const res = await fetch(url, { headers: { 'X-Dev-Role': cfg.role } });
    if (!res.ok) throw new ApiError('HTTP_' + res.status, 'Не удалось скачать файл', null, res.status);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl; a.download = fileName || 'file'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
  }

  const api = {
    me: () => call('GET', '/auth/me', { fallback: () => USERS.find((u) => u.role === ROLES[cfg.role].dto) }),
    saveAs,
    interactions: (q) => call('GET', '/reports/interactions', { query: q, fallback: () => fxInteractions(cfg.role, q) }).then((rows) => (rows || []).map(withLabels)),
    licenseRadar: () => call('GET', '/dashboard/license-radar', { fallback: () => fxLicenseRadar(cfg.role) }),
    slaRadar: () => call('GET', '/dashboard/sla-radar', { fallback: () => fxSlaRadar(cfg.role) }).then((r) => ({ ...r, items: (r.items || []).map(withLabels) })),
    healthScore: (limit) => call('GET', '/dashboard/health-score', { query: limit ? { limit } : undefined, fallback: () => fxHealthScore(cfg.role, limit) }),
    interaction: (iid) => call('GET', '/workflow/instances/' + iid, { fallback: () => { const x = INTERACTIONS.find((i) => i.interactionInstanceId === iid); return { id: iid, universityId: x.universityId, itProductId: x.itProductId, workflowTemplateVersionId: VERSION_ID, currentStatusId: x.currentStatusId, responsibleUserId: x.responsibleUserId, createdAt: x.createdAt, updatedAt: x.updatedAt }; } }),
    history: (iid) => call('GET', '/workflow/instances/' + iid + '/history', { fallback: () => HISTORY[iid] || [] }),
    templateVersion: async (vid) => {
      const v = await call('GET', '/workflow/template-versions/' + vid, { fallback: () => (vid === VERSION_ID ? activeVersion() : VERSIONS.find((x) => x.id === vid)) || activeVersion() });
      if (lastSource === 'api' && v) registerStatuses(v.statuses);
      return v;
    },
    files: (iid) => call('GET', '/files', { query: { interactionInstanceId: iid }, fallback: () => FILES.filter((f) => f.interactionInstanceId === iid) }),
    updateStatus: (iid, dto) => call('POST', '/workflow/instances/' + iid + '/transition', { body: dto, fallback: () => {
      const x = INTERACTIONS.find((i) => i.interactionInstanceId === iid); const st = activeVersion().statuses.find((s) => s.id === dto.toStatusId);
      const from = x.currentStatusId, fromName = x.currentStatusName; const at = new Date().toISOString();
      if (!st) throw new ApiError('WORKFLOW_STATUS_NOT_FOUND', 'Статус не найден в шаблоне', null, 404);
      const allowed = activeVersion().transitions.some((t) => t.fromStatusId === x.currentStatusId && t.toStatusId === st.id);
      if (!allowed) throw new ApiError('WORKFLOW_TRANSITION_FORBIDDEN', 'Переход «' + x.currentStatusName + '» → «' + st.name + '» не разрешён шаблоном', null, 409);
      Object.assign(x, { currentStatusId: st.id, currentStatusName: st.name, currentPhase: st.phase, updatedAt: at, daysInCurrentStatus: 0, isOverdue: false });
      (HISTORY[iid] = HISTORY[iid] || []).push({ id: 'local-' + Date.now(), interactionInstanceId: iid, fromStatusId: from, toStatusId: st.id, toStatusName: st.name, toStatusPhase: st.phase, fromStatusName: fromName, attachmentId: null, comment: dto.comment, changedById: userIdForRole(), changedAt: at });
      return { id: iid, universityId: x.universityId, itProductId: x.itProductId, workflowTemplateVersionId: VERSION_ID, currentStatusId: st.id, responsibleUserId: x.responsibleUserId, createdAt: x.createdAt, updatedAt: at };
    } }),
    uploadFile: (file, iid) => { const fd = new FormData(); fd.append('file', file); fd.append('interactionInstanceId', iid); return call('POST', '/files/upload', { form: fd, fallback: () => { const f = { id: 'local-f-' + Date.now(), fileName: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, storageKey: 'attachments/' + file.name, uploadedById: userIdForRole(), interactionInstanceId: iid, licenseId: null, createdAt: new Date().toISOString() }; FILES.push(f); return f; } }); },
    downloadUrl: (fid) => call('GET', '/files/' + fid, { fallback: () => ({ fileId: fid, url: '#', expiresAt: ahead(0.01) }) }).then((d) => ({ ...d, url: absUrl(d.url) })),
    charts: (q) => call('GET', '/reports/charts', { query: q, fallback: () => fxCharts(cfg.role, q) }),
    exportReport: (q, format) => call('GET', '/reports/interactions/export', { query: { ...q, format }, fallback: () => ({ format, fileName: 'reestr-vzaimodeystviy-' + new Date().toISOString().slice(0, 10) + '.' + format, url: '#', generatedAt: new Date().toISOString(), rowCount: fxInteractions(cfg.role, q).length }) }).then((d) => ({ ...d, url: absUrl(d.url) })),
    // params — те же поля, что у CreateReportJobDto (format, from/to и фильтры реестра);
    // асинхронный путь (POST /reports/jobs → GET /reports/export-status/{id}), а не
    // блокирующий exportReport — см. CrmReports.dc.html.
    createJob: (type, params) => call('POST', '/reports/jobs', { body: { type, ...params }, fallback: () => ({ id: 'job-' + Date.now(), type, status: 'QUEUED', requestedById: userIdForRole(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), resultUrl: null }) }),
    exportStatus: (jobId) => call('GET', '/reports/export-status/' + jobId, { fallback: () => ({ id: jobId, type: 'INTERACTIONS_EXPORT', status: 'SUCCESS', requestedById: userIdForRole(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), resultUrl: '#', fileName: 'otchet.xlsx', rowCount: 0 }) }).then((d) => ({ ...d, resultUrl: absUrl(d.resultUrl) })),
    universities: () => call('GET', '/catalogs/universities', { query: PAGE_ALL, fallback: () => UNIVERSITIES.filter(uniScope(cfg.role)) }),
    directions: () => call('GET', '/catalogs/it-directions', { query: PAGE_ALL, fallback: DIRECTIONS }),
    products: () => call('GET', '/catalogs/it-products', { query: PAGE_ALL, fallback: PRODUCTS }),
    vendors: () => call('GET', '/catalogs/vendors', { query: PAGE_ALL, fallback: VENDORS }),
    licenses: () => call('GET', '/catalogs/licenses', { query: PAGE_ALL, fallback: LICENSES }),
    reassign: (uid, kamId) => call('PATCH', '/catalogs/universities/' + uid + '/responsible', { body: { kamId }, fallback: () => { const u = uniById(uid); u.kamId = kamId; INTERACTIONS.filter((x) => x.universityId === uid).forEach((x) => { x.responsibleUserId = kamId; x.responsibleUserName = userName(kamId); }); return u; } }),
    unassign: (uid) => call('PATCH', '/catalogs/universities/' + uid + '/responsible', { body: { kamId: null }, fallback: () => { const u = uniById(uid); u.kamId = null; return u; } }),
    users: () => call('GET', '/admin/users', { fallback: USERS }),
    updateUser: async (uid, dto) => {
      const u = await call('PATCH', '/admin/users/' + uid, { body: dto, fallback: () => Object.assign(USERS.find((x) => x.id === uid), dto) });
      if (lastSource === 'api' && u) { Object.assign(USERS.find((x) => x.id === u.id) || {}, u); syncKams(); }
      return u;
    },
    templates: () => call('GET', '/workflow/templates', { fallback: () => [{ ...TEMPLATE, activeVersion: clone(activeVersion()), versions: VERSIONS.map(({ id, versionNumber, isActive }) => ({ id, versionNumber, isActive })) }] }),
    // Редактор шаблона (Администратор): новая версия, текущие процессы остаются на прежней.
    // Страница отдаёт статусы с id и переходы по id статусов — в API уходит форма с order.
    updateTemplate: async (tid, dto) => {
      if (cfg.mode !== 'demo') {
        try {
          const saved = await call('PUT', '/workflow/templates/' + tid, { body: templateDto(dto.statuses, dto.transitions, false) });
          adoptVersion(saved);
          return saved;
        } catch (e) { if (cfg.mode === 'api' || e.code !== 'NETWORK_UNAVAILABLE') throw e; }
      }
      return call('PUT', '/workflow/templates/' + tid, { fallback: () => { const n = Math.max(...VERSIONS.map((v) => v.versionNumber)) + 1; const a = activeVersion(); const arch = { ...a, id: 'local-arch-' + a.versionNumber, isActive: false, statuses: [...a.statuses], transitions: [...a.transitions] }; VERSIONS.splice(VERSIONS.indexOf(a), 0, arch); a.statuses.splice(0, a.statuses.length, ...dto.statuses.map((x) => ({ ...x, workflowTemplateVersionId: a.id }))); a.transitions = dto.transitions.map((t, i) => ({ id: 'local-tr-' + n + '-' + i, workflowTemplateVersionId: a.id, ...t })); a.versionNumber = n; return { ...clone(a), versionNumber: n }; } });
    },
    // Импорт вузов из xlsx (POST /catalogs/import/preview, multipart): без mapping бэкенд возвращает
    // заголовки файла и предложенный маппинг (isMappingSuggestion=true, rows пустой), с mapping —
    // построчный дедуп: NEW / DUPLICATE_EXACT / DUPLICATE_FUZZY («требует проверки»).
    importPreview: (file, mapping) => {
      const fd = new FormData(); fd.append('file', file);
      if (mapping) fd.append('mapping', JSON.stringify(mapping));
      return call('POST', '/catalogs/import/preview', { form: fd, fallback: () => fxImportPreview(file, mapping) });
    },
    importCommit: (previewId) => call('POST', '/catalogs/import/commit', { body: { previewId }, fallback: { id: id('h1000000', 1), fileName: 'Реестр вузов.xlsx', status: 'SUCCESS', resultSummary: { created: 3, matchedExisting: 1, needsReview: 2, failed: 0 }, initiatedById: USERS[2].id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }),
    health: () => call('GET', '/health', { fallback: () => ({ status: 'ok', db: 'ok', redis: 'ok', minio: 'ok', keycloak: 'ok', uptime: Math.round((Date.now() - NOW) / 1000) + 5421 }) }),
  };
  function activeVersion() { return VERSIONS.find((v) => v.isActive) || VERSIONS[VERSIONS.length - 1]; }
  const PAGE_ALL = { pageSize: 100 };
  const syncKams = () => KAMS.splice(0, KAMS.length, ...USERS.filter((u) => u.role === 'KAM' && u.isActive));
  // SLA и параметры критического пути приходят вместе со статусами версии (WorkflowStatusDto).
  function registerStatuses(statuses) {
    (statuses || []).forEach((st) => {
      if (st.slaDays) SLA[st.id] = st.slaDays; else delete SLA[st.id];
      const deps = st.dependsOnStatusIds || [];
      META[st.id] = { minDays: st.minDays || 0, deps, optional: !!st.isOptional, after: st.isOptional ? deps[0] : undefined };
    });
  }
  // Версия из ответа API становится активной в локальном справочнике.
  function adoptVersion(v) {
    registerStatuses(v.statuses);
    if (v.isActive) VERSIONS.forEach((x) => { x.isActive = false; });
    const i = VERSIONS.findIndex((x) => x.id === v.id);
    if (i >= 0) VERSIONS[i] = clone(v); else VERSIONS.push(clone(v));
    VERSIONS.sort((a, b) => a.versionNumber - b.versionNumber);
  }
  // Статусы/переходы в форме UpdateWorkflowTemplateDto: ссылки между статусами — через order,
  // sourceStatusId — id статуса текущей версии (для переноса процессов при migrateInstances).
  function templateDto(statuses, transitions, migrateInstances) {
    const sorted = [...statuses].sort((a, b) => a.order - b.order);
    const orderOf = Object.fromEntries(sorted.map((st, i) => [st.id, i + 1]));
    const isServerId = (sid) => typeof sid === 'string' && !/^(custom|local|new)-/.test(sid);
    return {
      migrateInstances,
      statuses: sorted.map((st, i) => {
        const m = META[st.id] || { minDays: 0, deps: [] };
        // Пустые зависимости у не-первого статуса (новый или его предшественник удалён) —
        // не отправляем: бэкенд поставит зависимость от предыдущего по order.
        const deps = (m.deps || []).map((d) => orderOf[d]).filter(Boolean);
        return { name: st.name, phase: st.phase, order: i + 1, slaDays: SLA[st.id] || null, minDays: Number(m.minDays) || 0, isOptional: !!m.optional,
          dependsOnOrders: deps.length || i === 0 ? deps : undefined, ...(isServerId(st.id) ? { sourceStatusId: st.id } : {}) };
      }),
      transitions: transitions.filter((t) => orderOf[t.fromStatusId] && orderOf[t.toStatusId])
        .map((t) => ({ name: t.name || undefined, fromStatusOrder: orderOf[t.fromStatusId], toStatusOrder: orderOf[t.toStatusId] })),
    };
  }
  // Справочники из API: сотрудники (ФИО ответственных, список КАМов) и шаблон workflow
  // (активная версия со SLA/сроками этапов + список версий). Без API остаются фикстуры.
  async function hydrate() {
    if (cfg.mode === 'demo') return;
    const get = async (path) => {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 2500);
      try { const r = await fetch(cfg.base.replace(/\/$/, '') + path, { headers: { 'X-Dev-Role': cfg.role }, signal: ctl.signal }); return r.ok ? r.json() : null; } finally { clearTimeout(to); }
    };
    try {
      const [users, templates] = await Promise.all([get('/auth/users'), get('/workflow/templates')]);
      if (users && users.length) { USERS.splice(0, USERS.length, ...users); syncKams(); }
      const t = templates && templates[0];
      if (t && t.activeVersion) {
        TEMPLATE.id = t.id; TEMPLATE.name = t.name; TEMPLATE.description = t.description;
        VERSIONS = (t.versions || []).map((v) => (v.id === t.activeVersion.id ? clone(t.activeVersion) : { ...v, workflowTemplateId: t.id, statuses: [], transitions: [] }));
        if (!VERSIONS.some((v) => v.id === t.activeVersion.id)) VERSIONS.push(clone(t.activeVersion));
        registerStatuses(t.activeVersion.statuses);
      }
    } catch (e) { /* API недоступен — работаем на фикстурах */ }
  }
  // Метод критического пути по оставшимся этапам: прямой проход (ES/EF), обратный (LS/LF), резерв = LS − ES.
  function criticalPath(statuses, currentId, daysIn) {
    const list = [...statuses].sort((a, b) => a.order - b.order);
    const cur = list.find((x) => x.id === currentId) || list[0];
    const meta = (x) => META[x.id] || { minDays: 7, deps: [] };
    const nodes = list.map((x) => { const m = meta(x); const done = x.order < cur.order; const skip = !done && x !== cur && m.optional; return { id: x.id, name: x.name, phase: x.phase, order: x.order, minDays: m.minDays, done, current: x === cur, skip, remaining: !done && !skip }; });
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const rem = nodes.filter((n) => n.remaining);
    rem.forEach((n) => { n.dur = n.current ? (n.minDays ? Math.max(1, n.minDays - (daysIn || 0)) : 0) : n.minDays; });
    const curM = meta(cur);
    rem.forEach((n) => {
      const deps = (META[n.id] ? META[n.id].deps : []).map((d) => byId[d]).filter((d) => d && d.remaining);
      n.preds = deps.map((d) => d.id);
      if (curM.optional && !n.current && (META[n.id] || { deps: [] }).deps.includes(curM.after)) n.preds.push(cur.id);
      n.es = Math.max(0, ...n.preds.map((p) => byId[p].ef)); n.ef = n.es + n.dur;
    });
    const total = Math.max(0, ...rem.map((n) => n.ef));
    [...rem].reverse().forEach((n) => { const succ = rem.filter((x) => x.preds.includes(n.id)); n.lf = succ.length ? Math.min(...succ.map((x) => x.ls)) : total; n.ls = n.lf - n.dur; n.slack = n.ls - n.es; n.critical = n.slack === 0; });
    return { nodes, total, current: cur };
  }
  function userIdForRole() { return (USERS.find((u) => u.role === ROLES[cfg.role].dto) || USERS[0]).id; }

  const CRM = {
    cfg, api, stats, ApiError, PHASES, PHASE, BUCKETS, ROLES, HEALTH_LEVELS, FILE_FORMATS, SLA, KAM_ME: K[0],
    local: { USERS, KAMS, get STATUSES() { return activeVersion().statuses; }, UNIVERSITIES, DIRECTIONS, PRODUCTS, get VERSIONS() { return VERSIONS; }, TEMPLATE, LICENSES },
    userName, LABELS, bucketOf, criticalPath, activeVersion: () => clone(activeVersion()), activeVersionId: () => activeVersion().id, statusMeta: (sid) => META[sid] || null,
    setMinDays: (sid, n) => { META[sid] = { ...(META[sid] || { deps: [] }), minDays: Number(n) || 0 }; },
    configure(o) { const prev = cfg.base + '|' + cfg.mode; Object.assign(cfg, o); if (prev !== cfg.base + '|' + cfg.mode) return hydrate(); },
    refresh: () => hydrate(),
    onStatus(f) { listeners.add(f); return () => listeners.delete(f); },
    get source() { return lastSource; },
    failNext(code, message, httpStatus) { failNext = { code, message, httpStatus }; },
    daysLeft: (end) => Math.ceil((new Date(end) - Date.now()) / DAY),
    fmtDate: (s) => s ? new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—',
    fmtDateTime: (s) => s ? new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
    fmtSize: (b) => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ',
    plural: (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; },
  };
  // Страницы ждут window.CRM (waitCRM) — публикуем клиент после загрузки справочников.
  hydrate().finally(() => { if (!window.CRM) window.CRM = CRM; });
})();
