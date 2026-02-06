'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ContractDoc {
  id: string;
  clientId: string;
  type: string;
  docNumber: string | null;
  docDate: string | null;
  endDate: string | null;
  status: string;
  uploadedAt: string;
  originalName: string;
  client?: { id: string; name: string };
  uploader?: { id: string; fullName: string };
  site?: { id: string; title: string } | null;
}

export default function ContractsList() {
  const [docs, setDocs] = useState<ContractDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchDocs();
  }, [clientId, siteId, status]);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientId) params.set('clientId', clientId);
      if (siteId) params.set('siteId', siteId);
      if (status) params.set('status', status);
      const res = await fetch(`/api/contracts?${params}`);
      const data = await res.json();
      if (res.ok) setDocs(data.contracts || []);
      else setDocs([]);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  const typeLabels: Record<string, string> = {
    CONTRACT: 'Договор',
    ADDENDUM: 'Доп. соглашение',
    NDA: 'NDA',
    OTHER: 'Прочее',
  };
  const statusLabels: Record<string, string> = {
    ACTIVE: 'Активный',
    CLOSED: 'Закрыт',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Договора</h1>
        <Link
          href="/contracts/upload"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Загрузить
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Фильтры</h3>
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Клиент (ID)"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="px-3 py-2 border rounded-md w-48"
          />
          <input
            type="text"
            placeholder="Сайт (ID)"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="px-3 py-2 border rounded-md w-48"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">Все статусы</option>
            <option value="ACTIVE">Активный</option>
            <option value="CLOSED">Закрыт</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : docs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Нет документов. Загрузите договор.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Номер</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата загрузки</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Кто загрузил</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Окончание</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{doc.client?.name ?? doc.clientId}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{typeLabels[doc.type] ?? doc.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{doc.docNumber ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('ru') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{doc.uploader?.fullName ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {doc.endDate ? new Date(doc.endDate).toLocaleDateString('ru') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">{statusLabels[doc.status] ?? doc.status}</td>
                  <td className="px-6 py-4 text-sm">
                    <a href={`/api/contracts/${doc.id}/download`} className="text-blue-600 hover:underline mr-4">Скачать</a>
                    <Link href={`/contracts/${doc.id}`} className="text-blue-600 hover:underline">Карточка</Link>
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
