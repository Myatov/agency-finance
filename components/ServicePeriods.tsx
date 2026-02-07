'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';

interface WorkPeriod {
  id: string;
  dateFrom: string;
  dateTo: string;
  periodType: string;
  invoiceNotRequired: boolean;
  invoices: Array<{
    id: string;
    amount: string;
    invoiceNumber: string | null;
    legalEntity: { id: string; name: string };
    payments: Array<{ id: string; amount: string; paidAt: string }>;
  }>;
  periodReport: { id: string; paymentType: string; originalName: string } | null;
}

interface Service {
  id: string;
  site: { id: string; title: string; client: { id: string; name: string } };
  product: { id: string; name: string };
  price: string | null;
}

const PERIOD_TYPES: Record<string, string> = {
  STANDARD: 'Стандартный',
  EXTENDED: 'Продлённый',
  BONUS: 'Бонусный',
  COMPENSATION: 'Компенсационный',
};

export default function ServicePeriods({ serviceId }: { serviceId: string }) {
  const [service, setService] = useState<Service | null>(null);
  const [periods, setPeriods] = useState<WorkPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([
        fetch(`/api/services/${serviceId}`),
        fetch(`/api/work-periods?serviceId=${serviceId}`),
      ]);
      const sData = await sRes.json();
      const pData = await pRes.json();
      if (sRes.ok && sData.service) setService(sData.service);
      if (pRes.ok && pData.workPeriods) setPeriods(pData.workPeriods);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [serviceId]);

  const handleAddPeriod = async () => {
    const res = await fetch(`/api/work-periods/suggest?serviceId=${serviceId}`);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Ошибка');
      return;
    }
    const createRes = await fetch('/api/work-periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId,
        dateFrom: data.suggested.dateFrom,
        dateTo: data.suggested.dateTo,
      }),
    });
    if (createRes.ok) load();
    else {
      const err = await createRes.json();
      alert(err.error || 'Ошибка создания периода');
    }
  };

  if (loading && !service) return <div className="py-8 text-center">Загрузка...</div>;
  if (!service) return <div className="py-8 text-center">Услуга не найдена</div>;

  return (
    <div>
      <div className="mb-4">
        <Link href="/payments" className="text-blue-600 hover:underline text-sm">← Оплаты</Link>
      </div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Периоды работ: {service.site.client.name} — {service.site.title} — {service.product.name}
        </h1>
        <button
          onClick={handleAddPeriod}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Добавить период
        </button>
      </div>

      <p className="text-gray-600 mb-4">
        Ожидаемая сумма за период: {service.price != null ? formatAmount(service.price) : '—'}
      </p>

      <div className="space-y-6">
        {periods.length === 0 ? (
          <p className="text-gray-500">Периодов пока нет. Нажмите «Добавить период».</p>
        ) : (
          periods.map((p) => {
            const totalInvoiced = p.invoices.reduce((s, i) => s + Number(i.amount), 0);
            const totalPaid = p.invoices.reduce((s, i) => s + i.payments.reduce((s2, pay) => s2 + Number(pay.amount), 0), 0);
            return (
              <div key={p.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">
                      {p.dateFrom} — {p.dateTo}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      {PERIOD_TYPES[p.periodType] || p.periodType}
                      {p.invoiceNotRequired && ' · Счёт не требуется'}
                    </span>
                  </div>
                  <div className="text-sm text-right">
                    <span className="text-gray-500">Выставлено: </span>{formatAmount(String(totalInvoiced))}
                    <span className="text-gray-500 ml-2">Оплачено: </span>{formatAmount(String(totalPaid))}
                    <span className="ml-2">Остаток: {formatAmount(String(totalInvoiced - totalPaid))}</span>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Отчёт: {p.periodReport ? (
                    <a href={`/api/period-reports/${p.periodReport.id}/download`} className="text-blue-600 hover:underline" download>
                      {p.periodReport.originalName}
                    </a>
                  ) : 'не прикреплён'}
                </div>
                {p.invoices.length > 0 && (
                  <ul className="mt-2 list-disc list-inside text-sm">
                    {p.invoices.map((inv) => {
                      const paid = inv.payments.reduce((s, pay) => s + Number(pay.amount), 0);
                      return (
                        <li key={inv.id}>
                          Счёт {inv.invoiceNumber || inv.id.slice(0, 8)} — {inv.legalEntity.name}: {formatAmount(inv.amount)}, оплачено {formatAmount(String(paid))}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="mt-2 flex gap-2 text-sm">
                  <Link href={`/periods/${p.id}`} className="text-blue-600 hover:underline">
                    Счета и оплаты →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
