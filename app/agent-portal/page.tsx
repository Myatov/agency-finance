'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function formatMoney(kopecks: string | number | null | undefined): string {
  if (kopecks == null) return '—';
  const n = Number(kopecks);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(n / 100);
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default function AgentPortalDashboard() {
  const router = useRouter();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [periodFrom, setPeriodFrom] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [periodTo, setPeriodTo] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [earnings, setEarnings] = useState<any>(null);

  useEffect(() => {
    fetchAgent();
  }, []);

  useEffect(() => {
    if (agent) fetchEarnings();
  }, [agent, periodFrom, periodTo]);

  const fetchAgent = async () => {
    try {
      const res = await fetch('/api/agent-portal/me');
      if (res.status === 401) {
        router.push('/agent-portal/enter');
        return;
      }
      const data = await res.json();
      if (res.ok) setAgent(data.agent);
      else setError(data.error || 'Ошибка загрузки');
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = async () => {
    try {
      const params = new URLSearchParams({ periodFrom, periodTo });
      const res = await fetch(`/api/agents/${agent.id}/earnings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEarnings(data);
      }
    } catch { /* ignore */ }
  };

  const handleLogout = async () => {
    document.cookie = 'agentPortal=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/agent-portal/enter');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Загрузка...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!agent) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Кабинет агента</h1>
            <p className="text-sm text-gray-500">{agent.name} {agent.companyName ? `(${agent.companyName})` : ''}</p>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">Выйти</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Agent Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Информация</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Имя:</span> {agent.name}</div>
            <div><span className="text-gray-500">Компания:</span> {agent.companyName || '—'}</div>
            <div><span className="text-gray-500">Телефон:</span> {agent.phone || '—'}</div>
            <div><span className="text-gray-500">Telegram:</span> {agent.telegram || '—'}</div>
            <div><span className="text-gray-500">Комиссия:</span> {agent.desiredCommissionPercent != null ? `${agent.desiredCommissionPercent}%` : '—'}</div>
          </div>
        </div>

        {/* Period Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Период:</span>
            <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="px-3 py-1.5 border rounded-md text-sm" />
            <span>—</span>
            <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="px-3 py-1.5 border rounded-md text-sm" />
          </div>
        </div>

        {/* Earnings Summary */}
        {earnings && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-sm text-gray-500">Комиссия</p>
                <p className="text-2xl font-bold text-blue-600">{earnings.agent?.commissionPercent}%</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-sm text-gray-500">Ожидаемый доход</p>
                <p className="text-2xl font-bold text-green-600">{formatMoney(earnings.totals?.expectedTotal)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-sm text-gray-500">Фактически выплачено</p>
                <p className="text-2xl font-bold text-gray-900">{formatMoney(earnings.totals?.actualPaidTotal)}</p>
              </div>
            </div>

            {/* Per-client breakdown */}
            {earnings.clientEarnings && earnings.clientEarnings.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b">
                  <h2 className="text-lg font-semibold">Проекты по клиентам</h2>
                </div>
                <div className="divide-y">
                  {earnings.clientEarnings.map((ce: any) => (
                    <div key={ce.client.id} className="p-6">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-gray-900">{ce.client.name}</h3>
                        <div className="text-sm">
                          <span className="text-gray-500">Ожидаемо: </span>
                          <span className="font-medium text-green-600">{formatMoney(ce.expectedTotal)}</span>
                          <span className="text-gray-500 ml-3">Выплачено: </span>
                          <span className="font-medium">{formatMoney(ce.actualPaidTotal)}</span>
                        </div>
                      </div>
                      {ce.services && ce.services.length > 0 && (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500 text-xs">
                              <th className="text-left py-1">Сайт</th>
                              <th className="text-left py-1">Услуга</th>
                              <th className="text-right py-1">Стоимость</th>
                              <th className="text-right py-1">Ожидаемая комиссия</th>
                              <th className="text-right py-1">Выплачено</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ce.services.map((s: any) => (
                              <tr key={s.serviceId} className="border-t border-gray-100">
                                <td className="py-2">{s.siteName}</td>
                                <td className="py-2">{s.productName}</td>
                                <td className="py-2 text-right">{formatMoney(s.price)}</td>
                                <td className="py-2 text-right text-green-600">{formatMoney(s.expectedEarning)}</td>
                                <td className="py-2 text-right">{formatMoney(s.actualPaid)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Active Projects */}
        <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="text-lg font-semibold">Активные проекты</h2>
          </div>
          <div className="divide-y">
            {agent.clients?.map((client: any) => (
              <div key={client.id} className="p-4">
                <h3 className="font-medium text-gray-900 mb-2">{client.name}</h3>
                {client.sites?.map((site: any) => (
                  <div key={site.id} className="ml-4 mb-2">
                    <span className="text-sm text-gray-600">{site.title}</span>
                    {site.services?.map((svc: any) => {
                      const lastPeriod = svc.workPeriods?.[0];
                      const paid = lastPeriod?.incomes?.reduce((s: number, i: any) => s + Number(i.amount), 0) || 0;
                      return (
                        <div key={svc.id} className="ml-4 text-sm text-gray-500 flex gap-4">
                          <span>{svc.product.name}</span>
                          <span>{formatMoney(svc.price)}</span>
                          {lastPeriod && (
                            <span>
                              {formatDate(lastPeriod.dateFrom)} — {formatDate(lastPeriod.dateTo)}
                              {paid > 0 && ` (оплачено: ${formatMoney(paid)})`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
            {(!agent.clients || agent.clients.length === 0) && (
              <div className="p-6 text-center text-gray-500">Нет активных проектов</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
