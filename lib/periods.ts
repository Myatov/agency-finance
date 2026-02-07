/**
 * Вычисление ожидаемых периодов работ по дате старта услуги и типу биллинга.
 * Период: с даты старта до (то же число следующего месяца − 1 день).
 * Пример: старт 04.12 → период 04.12–03.01, следующий 04.01–03.02 и т.д.
 *
 * Когда создаётся следующий период:
 * Периоды создаются в БД автоматически при открытии раздела Услуги → [услуга] → Периоды.
 * Горизонт по умолчанию — «сегодня + EXPECTED_PERIODS_MONTHS_AHEAD месяцев» (если у услуги
 * не задана дата окончания). Так период 2026-04-02 — 2026-05-01 появится при открытии
 * списка периодов, когда до него остаётся не более EXPECTED_PERIODS_MONTHS_AHEAD месяцев.
 */

export type BillingType = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

/** На сколько месяцев вперёд строить ожидаемые периоды, если у услуги не задан endDate. */
export const EXPECTED_PERIODS_MONTHS_AHEAD = 3;

function addMonth(d: Date): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + 1);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

/** Конец периода: то же число следующего месяца минус 1 день (04.12 → 03.01). */
function periodEnd(from: Date): Date {
  const next = addMonth(new Date(from));
  next.setDate(next.getDate() - 1);
  return next;
}

/** Один период: dateFrom/dateTo в формате YYYY-MM-DD */
export interface ExpectedPeriod {
  dateFrom: string;
  dateTo: string;
  isInvoicePeriod?: boolean; // для YEARLY: счёт только за год в конце года
}

/**
 * Для MONTHLY: периоды по месяцам от startDate до endLimit (или до сегодня + EXPECTED_PERIODS_MONTHS_AHEAD мес.).
 * Для ONE_TIME: один период (старт → конец первого месяца).
 * Для YEARLY: периоды по месяцам для отчётов/актов; isInvoicePeriod = true только у периода "конец года".
 */
export function getExpectedPeriods(
  startDate: Date,
  billingType: BillingType,
  endLimit?: Date
): ExpectedPeriod[] {
  const end = endLimit || addMonths(new Date(), EXPECTED_PERIODS_MONTHS_AHEAD);
  const periods: ExpectedPeriod[] = [];

  if (billingType === 'ONE_TIME') {
    const from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    const to = periodEnd(from);
    periods.push({
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: to.toISOString().slice(0, 10),
      isInvoicePeriod: true,
    });
    return periods;
  }

  if (billingType === 'MONTHLY') {
    let from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    while (from <= end) {
      const to = periodEnd(from);
      periods.push({
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: to.toISOString().slice(0, 10),
        isInvoicePeriod: true,
      });
      from = addMonth(from);
    }
    return periods;
  }

  if (billingType === 'YEARLY') {
    // Периоды для отчёта/акта — ежемесячно; счёт за год выставляется в конце года
    let from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    while (from <= end) {
      const to = periodEnd(from);
      // Счёт за год только у периода, заканчивающегося в декабре (dateTo в декабре)
      const isEndOfYear = to.getMonth() === 11;
      periods.push({
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: to.toISOString().slice(0, 10),
        isInvoicePeriod: isEndOfYear,
      });
      from = addMonth(from);
    }
    return periods;
  }

  // QUARTERLY — оставляем как ежемесячные для совместимости со старыми данными
  if (billingType === 'QUARTERLY') {
    let from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    while (from <= end) {
      const to = periodEnd(from);
      periods.push({
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: to.toISOString().slice(0, 10),
        isInvoicePeriod: true,
      });
      from = addMonth(from);
    }
    return periods;
  }

  return periods;
}
