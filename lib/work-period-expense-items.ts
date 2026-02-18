import type { PrismaClient } from '@prisma/client';

/**
 * Копирует статьи ожидаемых расходов с услуги (ServiceExpenseItem) в период (WorkPeriodExpenseItem).
 * Сохраняет ответственных по отделам для каждого периода.
 */
export async function copyServiceExpenseItemsToWorkPeriod(
  prisma: PrismaClient,
  workPeriodId: string,
  serviceId: string,
  periodExpectedAmountKopecks: bigint | null
): Promise<void> {
  const items = await prisma.serviceExpenseItem.findMany({
    where: { serviceId },
    include: { template: true },
  });
  if (items.length === 0) return;

  await prisma.workPeriodExpenseItem.createMany({
    data: items.map((ei) => {
      const value = ei.value ?? 0;
      const valueType = ei.valueType ?? 'PERCENT';
      const calculatedAmount =
        periodExpectedAmountKopecks != null && valueType === 'PERCENT'
          ? BigInt(Math.round(Number(periodExpectedAmountKopecks) * value / 100))
          : valueType === 'FIXED'
            ? BigInt(Math.round(value * 100))
            : null;
      return {
        workPeriodId,
        expenseItemTemplateId: ei.expenseItemTemplateId ?? null,
        responsibleUserId: ei.responsibleUserId ?? null,
        name: ei.name || 'Без названия',
        valueType,
        value,
        calculatedAmount,
      };
    }),
  });
}
