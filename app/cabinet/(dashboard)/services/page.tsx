'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';

interface Service {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  billingType: string;
  price: number | null;
  productName: string;
  siteId: string;
  siteTitle: string;
}

const statusLabel: Record<string, string> = {
  ACTIVE: 'Активна',
  PAUSED: 'Приостановлена',
  FINISHED: 'Завершена',
};

const billingLabel: Record<string, string> = {
  ONE_TIME: 'Разовая',
  MONTHLY: 'Ежемесячно',
  QUARTERLY: 'Ежеквартально',
  YEARLY: 'Ежегодно',
};

export default function CabinetServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client-portal/services', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setServices(d.services ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Загрузка...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Услуги</h2>
      {services.length === 0 ? (
        <p className="text-slate-500">Нет услуг</p>
      ) : (
        <ul className="space-y-3">
          {services.map((s) => (
            <li
              key={s.id}
              className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
            >
              <div className="font-medium text-slate-800">{s.productName}</div>
              <div className="text-sm text-slate-500">Сайт: {s.siteTitle}</div>
              <div className="flex flex-wrap gap-2 mt-2 text-sm">
                <span className="px-2 py-1 rounded bg-slate-100 text-slate-600">
                  {statusLabel[s.status] ?? s.status}
                </span>
                <span className="px-2 py-1 rounded bg-slate-100 text-slate-600">
                  {billingLabel[s.billingType] ?? s.billingType}
                </span>
                {s.price != null && (
                  <span className="text-slate-700">
                    {(s.price / 100).toLocaleString('ru-RU')} ₽
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Период: с {formatDate(s.startDate)}
                {s.endDate ? ` по ${formatDate(s.endDate)}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
