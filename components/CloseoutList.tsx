'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
}

interface CloseoutPackage {
  id: string;
  clientId: string;
  period: string;
  periodType: string;
  status: string;
  amount: string | null;
  client?: { name: string };
}

export default function CloseoutList() {
  const [packages, setPackages] = useState<CloseoutPackage[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPeriod, setCreatePeriod] = useState('');
  const [createClientId, setCreateClientId] = useState('');
  const [createAmount, setCreateAmount] = useState('');
  const [createStatus, setCreateStatus] = useState('PREPARING');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [clientId, period, status]);

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    const data = await res.json();
    setClients(data.clients || []);
  };

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientId) params.set('clientId', clientId);
      if (period) params.set('period', period);
      if (status) params.set('status', status);
      const res = await fetch(`/api/closeout/packages?${params}`);
      const data = await res.json();
      if (res.ok) {
        setPackages((data.packages || []).map((p: any) => ({ ...p, amount: p.amount?.toString?.() ?? p.amount })));
      } else setPackages([]);
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!createClientId || !createPeriod.trim()) {
      setCreateError('Клиент и период обязательны');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/closeout/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: createClientId,
          period: createPeriod.trim(),
          periodType: 'MONTH',
          amount: createAmount ? Number(createAmount) : null,
          status: createStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Ошибка создания');
        setCreating(false);
        return;
      }
      setShowCreateModal(false);
      setCreatePeriod('');
      setCreateAmount('');
      setCreateClientId('');
      setCreateStatus('PREPARING');
      fetchPackages();
    } catch {
      setCreateError('Ошибка соединения');
    } finally {
      setCreating(false);
    }
  };

  const statusLabels: Record<string, string> = {
    PREPARING: 'Готовится',
    SENT: 'Отправлено',
    SIGNED: 'Подписано',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Закрывающие документы</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Создать пакет периода
          </button>
          <Link
            href="/closeout/upload"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Загрузить документ
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Фильтры</h3>
        <div className="flex flex-wrap gap-4">
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
          <input
            type="text"
            placeholder="Период (напр. 2026-02)"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border rounded-md w-40"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">Все статусы</option>
            <option value="PREPARING">Готовится</option>
            <option value="SENT">Отправлено</option>
            <option value="SIGNED">Подписано</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : packages.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Нет пакетов закрытия. Создайте пакет периода или загрузите документ.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Период</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сумма</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {packages.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{p.client?.name ?? p.clientId}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.period}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{statusLabels[p.status] ?? p.status}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.amount ?? '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/closeout/packages/${p.id}`} className="text-blue-600 hover:underline">Документы пакета</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Создать пакет периода</h2>
            <form onSubmit={handleCreatePackage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Клиент *</label>
                <select
                  required
                  value={createClientId}
                  onChange={(e) => setCreateClientId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Выберите клиента</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Период *</label>
                <input
                  type="text"
                  required
                  value={createPeriod}
                  onChange={(e) => setCreatePeriod(e.target.value)}
                  placeholder="2026-02"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Сумма</label>
                <input
                  type="number"
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                <select value={createStatus} onChange={(e) => setCreateStatus(e.target.value)} className="w-full px-3 py-2 border rounded-md">
                  <option value="PREPARING">Готовится</option>
                  <option value="SENT">Отправлено</option>
                  <option value="SIGNED">Подписано</option>
                </select>
              </div>
              {createError && <div className="text-red-600 text-sm">{createError}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded-md hover:bg-gray-50">Отмена</button>
                <button type="submit" disabled={creating} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
