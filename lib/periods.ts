/**
 * Вычисление ожидаемых периодов работ по дате старта услуги и типу биллинга.
 * Период по умолчанию: с даты старта → 1 месяц → последний день месяца (или -1 день от следующего месяца).
 */

export type BillingType = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

function lastDayOfMonth(d: Date): Date {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return next;
}

function addMonth(d: Date): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + 1);
  return r;
}

/** Один период: dateFrom/dateTo в формате YYYY-MM-DD */
export interface ExpectedPeriod {
  dateFrom: string;
  dateTo: string;
  isInvoicePeriod?: boolean; // для YEARLY: счёт только за год в конце года
}

/**
 * Для MONTHLY: периоды по месяцам от startDate до endLimit (или до сегодня + 1 месяц).
 * Для ONE_TIME: один период (старт → конец первого месяца).
 * Для YEARLY: периоды по месяцам для отчётов/актов; isInvoicePeriod = true только у периода "конец года".
 */
export function getExpectedPeriods(
  startDate: Date,
  billingType: BillingType,
  endLimit?: Date
): ExpectedPeriod[] {
  const end = endLimit || addMonth(new Date());
  const periods: ExpectedPeriod[] = [];

  if (billingType === 'ONE_TIME') {
    const from = new Date(startDate);
    const to = lastDayOfMonth(from);
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
      const to = lastDayOfMonth(from);
      periods.push({
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: to.toISOString().slice(0, 10),
        isInvoicePeriod: true,
      });
      from = addMonth(from);
      from.setDate(1);
    }
    return periods;
  }

  if (billingType === 'YEARLY') {
    // Периоды для отчёта/акта — ежемесячно; счёт за год выставляется в конце года
    let from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    const yearEnd = new Date(from.getFullYear(), 11, 31);
    while (from <= end) {
      const to = lastDayOfMonth(from);
      const isEndOfYear = to.getMonth() === 11 && to.getDate() === 31;
      periods.push({
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: to.toISOString().slice(0, 10),
        isInvoicePeriod: isEndOfYear, // счёт за год только в конце декабря
      });
      from = addMonth(from);
      from.setDate(1);
    }
    return periods;
  }

  // QUARTERLY — оставляем как ежемесячные для совместимости со старыми данными
  if (billingType === 'QUARTERLY') {
    let from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    while (from <= end) {
      const to = lastDayOfMonth(from);
      periods.push({
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: to.toISOString().slice(0, 10),
        isInvoicePeriod: true,
      });
      from = addMonth(from);
      from.setDate(1);
    }
    return periods;
  }

  return periods;
}
