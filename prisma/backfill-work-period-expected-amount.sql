-- Один раз заполняем expectedAmount у периодов, где он NULL, из текущей цены услуги.
-- После этого при изменении цены услуги старые периоды сохранят свою сумму.
UPDATE "WorkPeriod" wp
SET "expectedAmount" = s."price"
FROM "Service" s
WHERE wp."serviceId" = s.id
  AND wp."expectedAmount" IS NULL
  AND s."price" IS NOT NULL;
