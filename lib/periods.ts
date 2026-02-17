/**
 * Вычисление ожидаемых периодов работ по дате старта услуги и типу биллинга.
 * Период: с даты старта до (то же число следующего месяца − 1 день).
 * Пример: старт 04.12 → период 04.12–03.01, следующий 04.01–03.02 и т.д.
 */

export type BillingType = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

function addMonth(d: Date): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + 1);
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
  periodType?: 'STANDARD' | 'EXTENDED';
}

/** Existing period from the database (used to handle EXTENDED periods). */
export interface ExistingPeriod {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  periodType: string;
}

/**
 * Для MONTHLY: периоды по месяцам от startDate до endLimit (или до сегодня + 1 месяц).
 * Для ONE_TIME: один период (старт → конец первого месяца).
 * Для YEARLY: периоды по месяцам для отчётов/актов; isInvoicePeriod = true только у периода "конец года".
 *
 * If existingPeriods is provided, EXTENDED periods shift the start of subsequent generated periods
 * so they begin the day after the extended period ends.
 */
export function getExpectedPeriods(
  startDate: Date,
  billingType: BillingType,
  endLimit?: Date,
  existingPeriods?: ExistingPeriod[]
): ExpectedPeriod[] {
  const end = endLimit || addMonth(new Date());
  const periods: ExpectedPeriod[] = [];

  // Build a sorted list of EXTENDED periods for shift calculations
  const extendedPeriods = (existingPeriods || [])
    .filter((p) => p.periodType === 'EXTENDED')
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));

  /**
   * Given a generated dateFrom, check if an EXTENDED period overlaps or precedes it
   * and return the adjusted dateFrom (day after the extended dateTo) if so.
   */
  function adjustStartForExtended(dateFromStr: string): string {
    for (const ext of extendedPeriods) {
      // If the expected period starts within or right after an extended period's original range,
      // shift it to the day after the extended dateTo
      if (ext.dateFrom <= dateFromStr && ext.dateTo >= dateFromStr) {
        const shifted = new Date(ext.dateTo + 'T00:00:00.000Z');
        shifted.setDate(shifted.getDate() + 1);
        return shifted.toISOString().slice(0, 10);
      }
    }
    return dateFromStr;
  }

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
      const standardTo = periodEnd(from);
      const fromStr = from.toISOString().slice(0, 10);
      const adjustedFromStr = adjustStartForExtended(fromStr);

      if (adjustedFromStr !== fromStr) {
        // This period's start was shifted by an EXTENDED period — use the adjusted start
        const adjustedFrom = new Date(adjustedFromStr + 'T00:00:00.000Z');
        const adjustedTo = periodEnd(adjustedFrom);
        periods.push({
          dateFrom: adjustedFromStr,
          dateTo: adjustedTo.toISOString().slice(0, 10),
          isInvoicePeriod: true,
        });
        from = addMonth(adjustedFrom);
      } else {
        periods.push({
          dateFrom: fromStr,
          dateTo: standardTo.toISOString().slice(0, 10),
          isInvoicePeriod: true,
        });
        from = addMonth(from);
      }
    }
    return periods;
  }

  if (billingType === 'YEARLY') {
    let from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    while (from <= end) {
      const to = periodEnd(from);
      const fromStr = from.toISOString().slice(0, 10);
      const adjustedFromStr = adjustStartForExtended(fromStr);

      if (adjustedFromStr !== fromStr) {
        const adjustedFrom = new Date(adjustedFromStr + 'T00:00:00.000Z');
        const adjustedTo = periodEnd(adjustedFrom);
        const isEndOfYear = adjustedTo.getMonth() === 11;
        periods.push({
          dateFrom: adjustedFromStr,
          dateTo: adjustedTo.toISOString().slice(0, 10),
          isInvoicePeriod: isEndOfYear,
        });
        from = addMonth(adjustedFrom);
      } else {
        const isEndOfYear = to.getMonth() === 11;
        periods.push({
          dateFrom: fromStr,
          dateTo: to.toISOString().slice(0, 10),
          isInvoicePeriod: isEndOfYear,
        });
        from = addMonth(from);
      }
    }
    return periods;
  }

  // QUARTERLY — оставляем как ежемесячные для совместимости со старыми данными
  if (billingType === 'QUARTERLY') {
    let from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    while (from <= end) {
      const to = periodEnd(from);
      const fromStr = from.toISOString().slice(0, 10);
      const adjustedFromStr = adjustStartForExtended(fromStr);

      if (adjustedFromStr !== fromStr) {
        const adjustedFrom = new Date(adjustedFromStr + 'T00:00:00.000Z');
        const adjustedTo = periodEnd(adjustedFrom);
        periods.push({
          dateFrom: adjustedFromStr,
          dateTo: adjustedTo.toISOString().slice(0, 10),
          isInvoicePeriod: true,
        });
        from = addMonth(adjustedFrom);
      } else {
        periods.push({
          dateFrom: fromStr,
          dateTo: to.toISOString().slice(0, 10),
          isInvoicePeriod: true,
        });
        from = addMonth(from);
      }
    }
    return periods;
  }

  return periods;
}
