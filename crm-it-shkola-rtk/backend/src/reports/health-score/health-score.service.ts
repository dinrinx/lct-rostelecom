import { Injectable } from '@nestjs/common';
import { DEFAULT_HEALTH_SCORE_CONFIG, HealthScoreConfig } from './health-score.config';
import { HEALTH_SCORE_REASON_TEMPLATES } from './health-score-reasons';
import { HealthScoreLevel, HealthScoreResult, VuzHealthInput } from './health-score.types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// level — по явному дереву правил из задачи (детерминированно и дословно
// тестируется), а не по банду от score: "лицензия < 7 дней ИЛИ SLA-просрочка
// > 2x порога" обязана давать red независимо от того, как сложится сумма
// штрафов из других сигналов (застой, needsReview). score — отдельная
// 0..100 метрика для сортировки/отображения; она использует ТЕ ЖЕ пороги
// из конфига, так что red/yellow-вузы получаются низким score, но не наоборот.
@Injectable()
export class HealthScoreService {
  calculateHealthScore(vuz: VuzHealthInput, config: HealthScoreConfig = DEFAULT_HEALTH_SCORE_CONFIG): HealthScoreResult {
    const reasons: string[] = [];
    let penalty = 0;

    const { licenseDaysUntilExpiry, daysInCurrentStatusWithoutChange, slaThresholdDays, daysSinceLastActivity, needsReviewCount } = vuz;

    // --- Лицензия ---------------------------------------------------------
    let licenseLevel: HealthScoreLevel = 'green';
    if (licenseDaysUntilExpiry !== null) {
      if (licenseDaysUntilExpiry < config.license.redDays) {
        licenseLevel = 'red';
        penalty += config.license.redPenalty;
        reasons.push(
          licenseDaysUntilExpiry < 0
            ? HEALTH_SCORE_REASON_TEMPLATES.licenseExpired(Math.abs(licenseDaysUntilExpiry))
            : HEALTH_SCORE_REASON_TEMPLATES.licenseExpiringSoon(licenseDaysUntilExpiry),
        );
      } else if (licenseDaysUntilExpiry < config.license.yellowDays) {
        licenseLevel = 'yellow';
        penalty += config.license.yellowPenalty;
        reasons.push(HEALTH_SCORE_REASON_TEMPLATES.licenseExpiringSoon(licenseDaysUntilExpiry));
      }
    }

    // --- SLA-просрочка текущего статуса ------------------------------------
    let slaLevel: HealthScoreLevel = 'green';
    if (slaThresholdDays !== null && slaThresholdDays > 0 && daysInCurrentStatusWithoutChange > slaThresholdDays) {
      const daysOver = daysInCurrentStatusWithoutChange - slaThresholdDays;
      const ratio = daysInCurrentStatusWithoutChange / slaThresholdDays;
      if (ratio > config.sla.redOverdueRatio) {
        slaLevel = 'red';
        penalty += config.sla.redPenalty;
        reasons.push(HEALTH_SCORE_REASON_TEMPLATES.slaOverdueCritical(daysOver, slaThresholdDays));
      } else {
        slaLevel = 'yellow';
        penalty += config.sla.yellowPenalty;
        reasons.push(HEALTH_SCORE_REASON_TEMPLATES.slaOverdue(daysOver, slaThresholdDays));
      }
    }

    // --- Застой активности (сигнал сверх официального SLA, только для score/reasons) ---
    if (daysSinceLastActivity !== null && daysSinceLastActivity >= config.staleness.thresholdDays) {
      penalty += config.staleness.penalty;
      reasons.push(HEALTH_SCORE_REASON_TEMPLATES.staleActivity(daysSinceLastActivity));
    }

    // --- needsReview (заявки из интеграции без разобранного вуза/ответственного) ---
    if (needsReviewCount > 0) {
      penalty += Math.min(needsReviewCount * config.needsReview.penaltyPerInstance, config.needsReview.maxPenalty);
      reasons.push(HEALTH_SCORE_REASON_TEMPLATES.needsReview(needsReviewCount));
    }

    const level: HealthScoreLevel = licenseLevel === 'red' || slaLevel === 'red' ? 'red' : licenseLevel === 'yellow' || slaLevel === 'yellow' ? 'yellow' : 'green';

    return { score: clamp(Math.round(100 - penalty), 0, 100), level, reasons };
  }
}
