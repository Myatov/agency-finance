'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  companyName?: string | null;
  professionalActivity?: string | null;
  phone?: string | null;
  telegram?: string | null;
  position?: string | null;
  commissionOnTop?: boolean;
  commissionInOurAmount?: boolean;
  desiredCommissionPercent?: number | null;
  sellsOnBehalfOfCompany?: boolean;
  transfersForClosingToUs?: boolean;
  description?: string | null;
  source?: string | null;
  status?: string | null;
  _count?: { clients: number };
}

interface ClientInfo {
  id: string;
  name: string;
}

interface ServiceEarning {
  serviceId: string;
  siteName: string;
  productName: string;
  price: string;
  expectedEarning: string;
  actualPaid: string;
}

interface ClientEarning {
  client: ClientInfo;
  services: ServiceEarning[];
  expectedTotal: string;
  actualPaidTotal: string;
}

interface EarningsData {
  agent: {
    id: string;
    name: string;
    commissionPercent: number;
    commissionOnTop: boolean;
    commissionInOurAmount: boolean;
  };
  periodFrom: string | null;
  periodTo: string | null;
  clientEarnings: ClientEarning[];
  totalExpected: string;
  totalActualPaid: string;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Активен',
  PAUSED: 'Пауза',
  ARCHIVED: 'Архив',
};

const SOURCE_LABELS: Record<string, string> = {
  PARTNER: 'Партнёр',
  AGENT: 'Агент',
  REFERRER: 'Рекомендатель',
  EMPLOYEE: 'Сотрудник',
};

function formatCopecks(value: string): string {
  const num = Number(value);
  if (isNaN(num)) return '0';
  return (num / 100).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function AgentDetail({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  const fetchAgent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.agent) {
        setAgent(data.agent);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = useCallback(async () => {
    setEarningsLoading(true);
    try {
      const params = new URLSearchParams();
      if (periodFrom) params.set('periodFrom', periodFrom);
      if (periodTo) params.set('periodTo', periodTo);
      const res = await fetch(`/api/agents/${agentId}/earnings?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setEarnings(data);
      }
    } catch {
      // ignore
    } finally {
      setEarningsLoading(false);
    }
  }, [agentId, periodFrom, periodTo]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const toggleClient = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Загрузка...</div>;
  }

  if (!agent) {
    return <div className="text-center py-8 text-gray-500">Агент не найден</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/agents" className="text-blue-600 hover:underline text-sm">
          &larr; Все агенты
        </Link>
      </div>

      {/* Agent Info Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold text-gray-900">{agent.name}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            agent.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
            agent.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {STATUS_LABELS[agent.status ?? ''] ?? agent.status ?? '—'}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agent.companyName && (
            <div>
              <span className="text-sm text-gray-500">Компания</span>
              <p className="font-medium">{agent.companyName}</p>
            </div>
          )}
          {agent.professionalActivity && (
            <div>
              <span className="text-sm text-gray-500">Деятельность</span>
              <p className="font-medium">{agent.professionalActivity}</p>
            </div>
          )}
          {agent.phone && (
            <div>
              <span className="text-sm text-gray-500">Телефон</span>
              <p className="font-medium">{agent.phone}</p>
            </div>
          )}
          {agent.telegram && (
            <div>
              <span className="text-sm text-gray-500">Telegram</span>
              <p className="font-medium">{agent.telegram}</p>
            </div>
          )}
          {agent.position && (
            <div>
              <span className="text-sm text-gray-500">Должность</span>
              <p className="font-medium">{agent.position}</p>
            </div>
          )}
          {agent.source && (
            <div>
              <span className="text-sm text-gray-500">Источник</span>
              <p className="font-medium">{SOURCE_LABELS[agent.source] ?? agent.source}</p>
            </div>
          )}
          <div>
            <span className="text-sm text-gray-500">Клиентов приведено</span>
            <p className="font-medium">{agent._count?.clients ?? 0}</p>
          </div>
          {agent.desiredCommissionPercent != null && (
            <div>
              <span className="text-sm text-gray-500">Комиссия</span>
              <p className="font-medium">{agent.desiredCommissionPercent}%</p>
            </div>
          )}
        </div>
        {(agent.commissionOnTop || agent.commissionInOurAmount || agent.sellsOnBehalfOfCompany || agent.transfersForClosingToUs) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {agent.commissionOnTop && (
              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">Комиссия сверху</span>
            )}
            {agent.commissionInOurAmount && (
              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">% в нашей сумме</span>
            )}
            {agent.sellsOnBehalfOfCompany && (
              <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">Продаёт от своей компании</span>
            )}
            {agent.transfersForClosingToUs && (
              <span className="px-2 py-1 bg-teal-50 text-teal-700 text-xs rounded-full">Передаёт на закрытие нам</span>
            )}
          </div>
        )}
        {agent.description && (
          <div className="mt-4">
            <span className="text-sm text-gray-500">Описание</span>
            <p className="text-gray-700 mt-1">{agent.description}</p>
          </div>
        )}
      </div>

      {/* Earnings Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Доходы агента</h2>

        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Период с</label>
            <input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Период по</label>
            <input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            onClick={fetchEarnings}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Показать
          </button>
        </div>

        {earningsLoading ? (
          <div className="text-center py-8 text-gray-500">Загрузка...</div>
        ) : earnings ? (
          <>
            {/* Totals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <span className="text-sm text-blue-600">Комиссия агента</span>
                <p className="text-2xl font-bold text-blue-900">{earnings.agent.commissionPercent}%</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <span className="text-sm text-green-600">Ожидаемый доход</span>
                <p className="text-2xl font-bold text-green-900">{formatCopecks(earnings.totalExpected)} &#8381;</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <span className="text-sm text-amber-600">Фактически выплачено</span>
                <p className="text-2xl font-bold text-amber-900">{formatCopecks(earnings.totalActualPaid)} &#8381;</p>
              </div>
            </div>

            {/* Per-client breakdown */}
            {earnings.clientEarnings.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                Нет клиентов с услугами от партнёра
              </div>
            ) : (
              <div className="space-y-3">
                {earnings.clientEarnings.map((ce) => {
                  const isExpanded = expandedClients.has(ce.client.id);
                  return (
                    <div key={ce.client.id} className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleClient(ce.client.id)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <svg
                            className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-medium text-gray-900">{ce.client.name}</span>
                          <span className="text-xs text-gray-400">{ce.services.length} усл.</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-green-700">Ожид: {formatCopecks(ce.expectedTotal)} &#8381;</span>
                          <span className="text-amber-700">Факт: {formatCopecks(ce.actualPaidTotal)} &#8381;</span>
                        </div>
                      </button>
                      {isExpanded && ce.services.length > 0 && (
                        <div className="border-t">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Сайт</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Продукт</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Цена услуги</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ожидаемый доход</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Выплачено</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {ce.services.map((s) => (
                                <tr key={s.serviceId} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-900">{s.siteName}</td>
                                  <td className="px-4 py-2 text-sm text-gray-600">{s.productName}</td>
                                  <td className="px-4 py-2 text-sm text-right text-gray-600">{formatCopecks(s.price)} &#8381;</td>
                                  <td className="px-4 py-2 text-sm text-right text-green-700">{formatCopecks(s.expectedEarning)} &#8381;</td>
                                  <td className="px-4 py-2 text-sm text-right text-amber-700">{formatCopecks(s.actualPaid)} &#8381;</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
