'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
}

interface CloseoutDoc {
  id: string;
  originalName: string;
  docType: string;
  uploadedAt: string | null;
}

interface PeriodRow {
  id: string;
  dateFrom: string;
  dateTo: string;
  client: Client;
  siteTitle: string;
  productName: string;
  serviceId: string;
  closeoutDocuments: CloseoutDoc[];
}

const docTypeLabels: Record<string, string> = {
  ACT: 'Акт',
  INVOICE: 'Счёт',
  SF: 'УПД',
  UPD: 'УКД',
  RECONCILIATION: 'Акт сверки',
  REPORT: 'Отчёт',
  OTHER: 'Прочее',
};

export default function CloseoutList() {
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');

  const fetchClients = async () => {
    const res = await fetch('/api/clients?forCloseout=1');
    const data = await res.json();
    setClients(data.clients || []);
  };

  const fetchPeriods = async () => {
    setLoading(true);
    try {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
      const res = await fetch(`/api/closeout/periods?${params}`);
      const data = await res.json();
      if (res.ok) setPeriods(data.periods || []);
      else setPeriods([]);
    } catch {
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [clientId]);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Закрывающие документы</h1>
      <p className="text-gray-600 mb-4">
        Документы привязываются к периодам в разделе <strong>Услуги → Периоды</strong>. Откройте нужный период и в блоке «Закрывающие документы» прикрепите файлы или скачайте уже загруженные.
      </p>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Фильтр</h3>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="px-3 py-2 border rounded-md min-w-[200px]"
        >
          <option value="">Все клиенты</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : periods.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Нет периодов. Выберите услугу в разделе Услуги → Периоды и прикрепляйте закрывающие документы в карточке периода.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сайт / Услуга</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Период</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Документы</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {periods.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{p.client?.name ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{p.siteTitle} — {p.productName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.dateFrom} — {p.dateTo}</td>
                  <td className="px-6 py-4 text-sm">
                    {p.closeoutDocuments.length > 0 ? (
                      <ul className="space-y-1">
                        {p.closeoutDocuments.map((d) => (
                          <li key={d.id}>
                            <a href={`/api/closeout/documents/${d.id}/download`} className="text-blue-600 hover:underline" download>
                              {d.originalName}
                            </a>
                            <span className="text-gray-500 ml-1">({docTypeLabels[d.docType] ?? d.docType})</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/periods/${p.id}`} className="text-blue-600 hover:underline">
                      Карточка периода
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
