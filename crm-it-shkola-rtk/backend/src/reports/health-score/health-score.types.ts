export type HealthScoreLevel = 'red' | 'yellow' | 'green';

// Агрегированные по вузу данные — функция сама ничего не считает по сырым
// таблицам (никаких дат/StatusHistoryEntry внутри), это заранее посчитанные
// caller'ом (например, будущим GET /dashboard/health-score) числа.
export interface VuzHealthInput {
  // Дней до истечения БЛИЖАЙШЕЙ активной лицензии вуза; null — у вуза нет
  // отслеживаемой лицензии (лицензионный риск в score/reasons не участвует).
  // Отрицательное число — лицензия уже истекла.
  licenseDaysUntilExpiry: number | null;
  // Сколько дней текущий статус взаимодействия не менялся (для расчёта
  // просрочки относительно норматива SLA этого статуса).
  daysInCurrentStatusWithoutChange: number;
  // Норматив SLA (дней) текущего статуса; null — у статуса нет норматива
  // (обычно финальный статус) — SLA-просрочка в этом случае не считается.
  slaThresholdDays: number | null;
  // Дней с момента последней записи StatusHistoryEntry по вузу; null — истории
  // ещё не было (например, только что созданное взаимодействие).
  daysSinceLastActivity: number | null;
  // Сколько InteractionInstance вуза имеют needsReview=true (см. integrations/sync).
  needsReviewCount: number;
}

export interface HealthScoreResult {
  score: number;
  level: HealthScoreLevel;
  reasons: string[];
}
