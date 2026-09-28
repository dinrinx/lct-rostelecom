// Веса и пороги для HealthScoreService — вынесены из формулы намеренно: перед
// демо может понадобиться быстро подкрутить баланс, если увидим, что все вузы
// попадают в один цвет (см. задачу), а не искать магические числа в коде сервиса.
export interface HealthScoreConfig {
  license: {
    // "лицензия < 7 дней" — сюда же попадает уже истёкшая (отрицательное значение).
    redDays: number;
    // "лицензия < 30 дней"
    yellowDays: number;
    redPenalty: number;
    yellowPenalty: number;
  };
  sla: {
    // "SLA-просрочка > 2x порога" — отношение (дней в статусе / норматив SLA статуса).
    redOverdueRatio: number;
    redPenalty: number;
    // "SLA-просрочка есть" — ratio > 1, т.е. дней в статусе больше норматива.
    yellowPenalty: number;
  };
  staleness: {
    // Дней с последней записи StatusHistoryEntry, после которых это считается
    // тревожным сигналом застоя (за рамками официального SLA-норматива статуса).
    thresholdDays: number;
    penalty: number;
  };
  needsReview: {
    // За каждый инстанс с needsReview=true (см. integrations/sync) — до потолка,
    // чтобы один вуз с кучей неразобранных заявок не обнулял score единолично.
    penaltyPerInstance: number;
    maxPenalty: number;
  };
}

export const DEFAULT_HEALTH_SCORE_CONFIG: HealthScoreConfig = {
  license: {
    redDays: 7,
    yellowDays: 30,
    redPenalty: 40,
    yellowPenalty: 15,
  },
  sla: {
    redOverdueRatio: 2,
    redPenalty: 35,
    yellowPenalty: 15,
  },
  staleness: {
    thresholdDays: 30,
    penalty: 15,
  },
  needsReview: {
    penaltyPerInstance: 8,
    maxPenalty: 24,
  },
};
