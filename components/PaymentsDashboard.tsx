'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';

interface PeriodRow {
  id: string;
  serviceId: string;
  dateFrom: string;
  dateTo: string;
  periodType: string;
  invoiceNotRequired: boolean;
  client: { id: string; name: string };
  site: { id: string; title: string };
  product: { id: string; name: string };
  accountManager: { id: string; fullName: string } | null;
  expectedAmount: string;
  totalInvoiced: string;
  paid: string;
  balance: string;
  hasReport: boolean;
  hasInvoice?: boolean;
  hasCloseoutDoc?: boolean;
  isOverdue: boolean;
  risk: boolean;
  invoicesCount: number;
  isVirtual?: boolean;
}

interface DashboardData {
  periods: PeriodRow[];
  summary: { planTotal: string; factTotal: string; deviation: string };
  viewAllPayments?: boolean;
  currentUserId?: string;
}

interface User { id: string; fullName: string; roleCode: string; }

export default function PaymentsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'overdue' | 'planfact'>('all');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    accountManagerId: '',
    clientId: '',
  });

  const setDatePreset = (preset: 'year' | 'currentYear' | '3months' | 'prevMonth' | 'currentMonth') => {
    const now = new Date();
    let from = '';
    let to = now.toISOString().slice(0, 10);
    if (preset === 'year') {
      const y = new Date(now);
      y.setFullYear(y.getFullYear() - 1);
      from = y.toISOString().slice(0, 10);
    } else if (preset === 'currentYear') {
      from = `${now.getFullYear()}-01-01`;
    } else if (preset === '3months') {
      const m = new Date(now);
      m.setMonth(m.getMonth() - 3);
      from = m.toISOString().slice(0, 10);
    } else if (preset === 'prevMonth') {
      const m = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      from = m.toISOString().slice(0, 10);
      to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    } else if (preset === 'currentMonth') {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }
    setFilters((f) => ({ ...f, dateFrom: from, dateTo: to }));
  };
  const [accountManagers, setAccountManagers] = useState<Array<{ id: string; fullName: string }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [descriptionsExpanded, setDescriptionsExpanded] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, [tab, filters]);

  useEffect(() => {
    fetch('/api/users/account-managers').then((r) => r.json()).then((d) => setAccountManagers(d.accountManagers || []));
    fetch('/api/clients?forPayments=1').then((r) => r.json()).then((d) => setClients(d.clients || []));
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.accountManagerId) params.set('accountManagerId', filters.accountManagerId);
    if (filters.clientId) params.set('clientId', filters.clientId);
    if (tab === 'overdue') params.set('overdueOnly', '1');
    const res = await fetch(`/api/payments-dashboard?${params}`);
    const json = await res.json();
    if (res.ok) {
      setData({
        periods: json.periods,
        summary: json.summary,
        viewAllPayments: json.viewAllPayments,
        currentUserId: json.currentUserId,
      });
      if (json.viewAllPayments === false && json.currentUserId) {
        setFilters((prev) => (!prev.accountManagerId ? { ...prev, accountManagerId: json.currentUserId } : prev));
      }
    } else setData(null);
    setLoading(false);
  };

  const formatRub = (s: string) => formatAmount(s || '0');

  if (loading && !data) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Оплаты</h1>

      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2 font-medium ${tab === 'all' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Ближайшие оплаты
        </button>
        <button
          onClick={() => setTab('overdue')}
          className={`px-4 py-2 font-medium ${tab === 'overdue' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Просрочки
        </button>
        <button
          onClick={() => setTab('planfact')}
          className={`px-4 py-2 font-medium ${tab === 'planfact' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          План vs Факт
        </button>
      </div>

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setDescriptionsExpanded((v) => !v)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
        >
          <span className="text-gray-400">{descriptionsExpanded ? '▼' : '▶'}</span>
          {descriptionsExpanded ? 'Свернуть описание и подсказки' : 'Описание отчёта и подсказки'}
        </button>
        {descriptionsExpanded && (
          <>
            <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700">
              {tab === 'all' && (
                <>
                  <strong>Ближайшие оплаты.</strong> Показаны все периоды работ в выбранном диапазоне дат: и уже созданные в системе, и ожидаемые по активным услугам (считаются от даты старта и типа биллинга — ежемесячно, разово, ежегодно). По каждой строке: клиент, сайт/услуга, аккаунт-менеджер, период, ожидаемая сумма, оплачено, остаток, наличие отчёта. Строки без созданного периода в БД отображают прочерк в колонке «Периоды» — период можно создать в карточке услуги или при добавлении дохода.
                </>
              )}
        {tab === 'overdue' && (
          <>
            <strong>Просрочки.</strong> Периоды с просрочкой по отчёту, счёту, оплате или закрывающему документу. Если просрочек нет — экран пустой.
          </>
        )}
              {tab === 'planfact' && (
                <>
                  <strong>План vs Факт.</strong> Те же периоды за выбранный диапазон; сверху — сводка: ожидаемая выручка (план по периодам), фактически получено (сумма оплат), отклонение (план минус факт). Таблица внизу — детализация по каждому периоду для анализа, где план не совпадает с фактом.
                </>
              )}
            </div>
            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-gray-700">
              <strong>Где вносить счета, отчёты и оплаты по периоду:</strong> Услуги → выберите услугу → Периоды → у нужного периода нажмите «Счета и оплаты». В карточке периода можно добавить счёт, прикрепить отчёт по периоду и внести оплаты. Закрывающие документы — в разделе меню «Закрывающие документы».
            </div>
          </>
        )}
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-sm text-gray-600 mr-1">Быстро:</span>
          <button type="button" onClick={() => setDatePreset('year')} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">За последний год</button>
          <button type="button" onClick={() => setDatePreset('currentYear')} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">Текущий год</button>
          <button type="button" onClick={() => setDatePreset('3months')} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">3 месяца</button>
          <button type="button" onClick={() => setDatePreset('prevMonth')} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">Пред. месяц</button>
          <button type="button" onClick={() => setDatePreset('currentMonth')} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">Текущий месяц</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Период с</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Период по</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Аккаунт</label>
            <select
              value={data?.viewAllPayments === false ? (data.currentUserId ?? '') : filters.accountManagerId}
              onChange={(e) => setFilters({ ...filters, accountManagerId: e.target.value })}
              disabled={data?.viewAllPayments === false}
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Все</option>
              {accountManagers.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
            {data?.viewAllPayments === false && (
              <p className="mt-1 text-xs text-gray-500">Доступ только к своим отчётам</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Клиент</label>
            <select
              value={filters.clientId}
              onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Все</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {data?.summary && tab === 'planfact' && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Ожидаемая выручка</p>
            <p className="text-xl font-semibold">{formatRub(data.summary.planTotal)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Фактически получено</p>
            <p className="text-xl font-semibold">{formatRub(data.summary.factTotal)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Отклонение</p>
            <p className={`text-xl font-semibold ${Number(data.summary.deviation) < 0 ? 'text-red-600' : ''}`}>
              {formatRub(data.summary.deviation)}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : !data?.periods?.length ? (
          <div className="p-8 text-center text-gray-500">Нет данных за выбранный период</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Сайт / Услуга</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">АМ</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Период</th>
                  {tab !== 'overdue' && (
                    <>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ожидаемо</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Оплачено</th>
                    </>
                  )}
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Остаток</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Отчёт</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Счёт</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Акт</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.periods.map((row) => (
                  <tr
                    key={row.id}
                    className={row.risk ? 'bg-amber-50' : ''}
                  >
                    <td className="px-4 py-2 text-sm">{row.client.name}</td>
                    <td className="px-4 py-2 text-sm">
                      {row.site.title} / {row.product.name}
                    </td>
                    <td className="px-4 py-2 text-sm">{row.accountManager?.fullName ?? '—'}</td>
                    <td className="px-4 py-2 text-sm">
                      {row.dateFrom} — {row.dateTo}
                      {row.isOverdue && <span className="ml-1 text-red-600 text-xs">просрочка</span>}
                    </td>
                    {tab !== 'overdue' && (
                      <>
                        <td className="px-4 py-2 text-sm text-right">{formatRub(row.expectedAmount)}</td>
                        <td className="px-4 py-2 text-sm text-right">{formatRub(row.paid)}</td>
                      </>
                    )}
                    <td className="px-4 py-2 text-sm text-right">{formatRub(row.balance)}</td>
                    <td className="px-4 py-2 text-center">
                      {row.hasReport ? <span className="text-green-600">✓</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {(row.hasInvoice ?? row.invoicesCount > 0) ? <span className="text-green-600">✓</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {(row.hasCloseoutDoc ?? false) ? <span className="text-green-600">✓</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {row.isVirtual ? (
                        <span className="text-gray-400 text-sm" title="Период ещё не создан в БД; создайте в карточке услуги → Периоды">—</span>
                      ) : (
                        <Link
                          href={`/services/${row.serviceId}/periods`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Периоды
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
