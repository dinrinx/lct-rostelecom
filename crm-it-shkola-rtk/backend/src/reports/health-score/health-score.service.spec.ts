import { HealthScoreService } from './health-score.service';
import { DEFAULT_HEALTH_SCORE_CONFIG } from './health-score.config';
import type { VuzHealthInput } from './health-score.types';

const OK: VuzHealthInput = {
  licenseDaysUntilExpiry: 180,
  daysInCurrentStatusWithoutChange: 3,
  slaThresholdDays: 14,
  daysSinceLastActivity: 2,
  needsReviewCount: 0,
};

describe('HealthScoreService.calculateHealthScore', () => {
  const service = new HealthScoreService();

  it('всё хорошо: лицензия далеко, SLA в норме, нет застоя/needsReview -> green, score 100, без reasons', () => {
    const result = service.calculateHealthScore(OK);
    expect(result).toEqual({ score: 100, level: 'green', reasons: [] });
  });

  it('горит только лицензия (< 7 дней) -> red, единственная причина про лицензию', () => {
    const result = service.calculateHealthScore({ ...OK, licenseDaysUntilExpiry: 5 });
    expect(result.level).toBe('red');
    expect(result.reasons).toEqual(['Лицензия истекает через 5 дн.']);
    expect(result.score).toBeLessThan(100);
  });

  it('лицензия уже истекла -> red, причина про истёкшую (не "истекает через отрицательное число")', () => {
    const result = service.calculateHealthScore({ ...OK, licenseDaysUntilExpiry: -4 });
    expect(result.level).toBe('red');
    expect(result.reasons).toEqual(['Лицензия истекла 4 дн. назад']);
  });

  it('только SLA, просрочка > 2x норматива -> red, единственная причина про SLA', () => {
    // норматив 14, просрочка втрое: 42 дня в статусе -> ratio 3
    const result = service.calculateHealthScore({ ...OK, daysInCurrentStatusWithoutChange: 42 });
    expect(result.level).toBe('red');
    expect(result.reasons).toEqual(['Критическая просрочка SLA: 28 дн. сверх норматива 14 дн.']);
  });

  it('SLA-просрочка есть, но не критическая (ratio 1..2) -> yellow, а не red', () => {
    // норматив 14, 20 дней в статусе -> ratio ~1.43, просрочка есть, но не x2
    const result = service.calculateHealthScore({ ...OK, daysInCurrentStatusWithoutChange: 20 });
    expect(result.level).toBe('yellow');
    expect(result.reasons).toEqual(['Просрочка SLA: 6 дн. сверх норматива 14 дн.']);
  });

  it('лицензия в диапазоне "скоро" (< 30, но не < 7) -> yellow', () => {
    const result = service.calculateHealthScore({ ...OK, licenseDaysUntilExpiry: 20 });
    expect(result.level).toBe('yellow');
    expect(result.reasons).toEqual(['Лицензия истекает через 20 дн.']);
  });

  it('оба сразу: лицензия горит (red) и SLA критически просрочен (red) -> red, обе причины в reasons через запятую по порядку', () => {
    const result = service.calculateHealthScore({
      ...OK,
      licenseDaysUntilExpiry: 3,
      daysInCurrentStatusWithoutChange: 50,
    });
    expect(result.level).toBe('red');
    expect(result.reasons).toEqual([
      'Лицензия истекает через 3 дн.',
      'Критическая просрочка SLA: 36 дн. сверх норматива 14 дн.',
    ]);
    expect(result.reasons.join(', ')).toBe(
      'Лицензия истекает через 3 дн., Критическая просрочка SLA: 36 дн. сверх норматива 14 дн.',
    );
  });

  it('итоговый level — это худший из лицензии/SLA: yellow-лицензия + red-SLA даёт red', () => {
    const result = service.calculateHealthScore({ ...OK, licenseDaysUntilExpiry: 20, daysInCurrentStatusWithoutChange: 42 });
    expect(result.level).toBe('red');
  });

  it('застой активности и needsReview снижают score и зелёного уровня, но level остаётся green (не входят в правило уровня)', () => {
    const result = service.calculateHealthScore({
      ...OK,
      daysSinceLastActivity: 45,
      needsReviewCount: 2,
    });
    expect(result.level).toBe('green');
    expect(result.score).toBeLessThan(100);
    expect(result.reasons).toEqual([
      'Нет активности по вузу 45 дн.',
      '2 взаимодействий требуют проверки (needsReview)',
    ]);
  });

  it('needsReview: штраф ограничен потолком из конфига даже при большом количестве заявок', () => {
    const many = service.calculateHealthScore({ ...OK, needsReviewCount: 50 });
    const few = service.calculateHealthScore({ ...OK, needsReviewCount: 2 });
    expect(100 - many.score).toBe(DEFAULT_HEALTH_SCORE_CONFIG.needsReview.maxPenalty);
    expect(100 - few.score).toBeLessThan(DEFAULT_HEALTH_SCORE_CONFIG.needsReview.maxPenalty);
  });

  it('needsReviewCount=1 использует единственное число в тексте причины', () => {
    const result = service.calculateHealthScore({ ...OK, needsReviewCount: 1 });
    expect(result.reasons).toEqual(['1 взаимодействие требует проверки (needsReview)']);
  });

  it('null-поля (нет лицензии / нет норматива SLA / истории ещё не было) не дают ложных срабатываний', () => {
    const result = service.calculateHealthScore({
      licenseDaysUntilExpiry: null,
      daysInCurrentStatusWithoutChange: 999,
      slaThresholdDays: null,
      daysSinceLastActivity: null,
      needsReviewCount: 0,
    });
    expect(result).toEqual({ score: 100, level: 'green', reasons: [] });
  });

  it('score никогда не уходит ниже 0 и не выше 100 даже при экстремальных входных данных', () => {
    const worst = service.calculateHealthScore({
      licenseDaysUntilExpiry: -100,
      daysInCurrentStatusWithoutChange: 1000,
      slaThresholdDays: 5,
      daysSinceLastActivity: 500,
      needsReviewCount: 100,
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
    expect(worst.level).toBe('red');
  });

  it('функция чистая: один и тот же вход всегда даёт один и тот же результат, вход не мутируется', () => {
    const input: VuzHealthInput = { ...OK, licenseDaysUntilExpiry: 3 };
    const frozen = { ...input };
    const first = service.calculateHealthScore(input);
    const second = service.calculateHealthScore(input);
    expect(first).toEqual(second);
    expect(input).toEqual(frozen);
  });

  it('конфиг можно передать явно (например, подкрученный перед демо) — переопределяет дефолтный', () => {
    const strict = {
      ...DEFAULT_HEALTH_SCORE_CONFIG,
      license: { ...DEFAULT_HEALTH_SCORE_CONFIG.license, redDays: 60 },
    };
    const result = service.calculateHealthScore({ ...OK, licenseDaysUntilExpiry: 40 }, strict);
    expect(result.level).toBe('red');
  });
});
