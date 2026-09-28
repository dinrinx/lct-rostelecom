// Заранее заготовленные шаблоны причин — не свободный текст, а фиксированные
// строки с подстановкой чисел из сработавшего условия. Сборка reasons — это
// просто список результатов этих функций в порядке срабатывания условий.
export const HEALTH_SCORE_REASON_TEMPLATES = {
  licenseExpired: (daysAgo: number) => `Лицензия истекла ${daysAgo} дн. назад`,
  licenseExpiringSoon: (days: number) => `Лицензия истекает через ${days} дн.`,
  slaOverdueCritical: (daysOver: number, thresholdDays: number) =>
    `Критическая просрочка SLA: ${daysOver} дн. сверх норматива ${thresholdDays} дн.`,
  slaOverdue: (daysOver: number, thresholdDays: number) =>
    `Просрочка SLA: ${daysOver} дн. сверх норматива ${thresholdDays} дн.`,
  staleActivity: (days: number) => `Нет активности по вузу ${days} дн.`,
  needsReview: (count: number) => `${count} ${count === 1 ? 'взаимодействие требует' : 'взаимодействий требуют'} проверки (needsReview)`,
} as const;
