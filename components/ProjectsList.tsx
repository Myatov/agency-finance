'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ProjectModal from './ProjectModal';

interface Project {
  id: string;
  productId: string;
  status: string;
  startDate: string;
  price: string | null;
  billingType: string;
  isFromPartner: boolean;
  sellerCommissionPercent: number | null;
  sellerCommissionAmount: string | null;
  accountManagerCommissionPercent: number | null;
  accountManagerCommissionAmount: string | null;
  accountManagerFeeAmount: string | null;
  product: { id: string; name: string };
  site: {
    id: string;
    title: string;
    websiteUrl: string | null;
    client: {
      id: string;
      name: string;
      isSystem: boolean;
      seller: { id: string; fullName: string } | null;
      accountManager: { id: string; fullName: string } | null;
      agent: { id: string; name: string } | null;
      legalEntity: { id: string; name: string } | null;
    };
  };
  responsible: { id: string; fullName: string } | null;
  workPeriods: Array<{
    id: string;
    dateFrom: string;
    dateTo: string;
    expectedAmount: string | null;
    incomes: Array<{ amount: string }>;
  }>;
  expenseItems: Array<{
    id: string;
    name: string;
    valueType: string;
    value: number;
    calculatedAmount: string | null;
    template: { id: string; name: string } | null;
  }>;
}

interface UnassignedClient {
  id: string;
  name: string;
  seller: { id: string; fullName: string } | null;
  sites: Array<{
    id: string;
    title: string;
    services: Array<{ id: string; product: { name: string }; status: string }>;
  }>;
}

interface AccountManager {
  id: string;
  fullName: string;
}

interface User {
  id: string;
  fullName: string;
  roleCode: string;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Активна',
  PAUSED: 'Приостановлена',
  FINISHED: 'Завершена',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
  FINISHED: 'bg-gray-100 text-gray-800',
};

const BILLING_LABELS: Record<string, string> = {
  ONE_TIME: 'Разовая',
  MONTHLY: 'Ежемесячная',
  QUARTERLY: 'Ежеквартальная',
  YEARLY: 'Ежегодная',
};

function formatMoney(kopecks: string | number | null | undefined): string {
  if (kopecks == null) return '—';
  const n = Number(kopecks);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(n / 100);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU');
}

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [unassignedClients, setUnassignedClients] = useState<UnassignedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accountManagers, setAccountManagers] = useState<AccountManager[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    accountManagerId: '',
    sellerId: '',
    productId: '',
    search: '',
    activeOnly: true,
  });
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [assigningClient, setAssigningClient] = useState<string | null>(null);
  const [assignAMId, setAssignAMId] = useState('');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  useEffect(() => {
    fetchUser();
    fetchProjects();
    fetchAccountManagers();
  }, []);

  useEffect(() => {
    if (user && (user.roleCode === 'OWNER' || user.roleCode === 'CEO')) {
      fetchUnassignedClients();
    }
  }, [user]);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) setUser(data.user);
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.accountManagerId) params.set('accountManagerId', filters.accountManagerId);
      if (filters.sellerId) params.set('sellerId', filters.sellerId);
      if (filters.productId) params.set('productId', filters.productId);
      if (filters.activeOnly) params.set('activeOnly', 'true');

      const res = await fetch(`/api/projects?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setProjects(data.projects || []);
      else setError(data.error || 'Ошибка загрузки');
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedClients = async () => {
    try {
      const res = await fetch('/api/projects/unassigned');
      const data = await res.json();
      if (res.ok) setUnassignedClients(data.clients || []);
    } catch { /* ignore */ }
  };

  const fetchAccountManagers = async () => {
    try {
      const res = await fetch('/api/users/account-managers');
      const data = await res.json();
      if (res.ok) setAccountManagers(data.accountManagers || []);
    } catch { /* ignore */ }
  };

  const handleAssignAM = async (clientId: string) => {
    if (!assignAMId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountManagerId: assignAMId }),
      });
      if (res.ok) {
        setAssigningClient(null);
        setAssignAMId('');
        fetchUnassignedClients();
        fetchProjects();
      } else {
        const data = await res.json();
        alert(data.error || 'Ошибка назначения');
      }
    } catch {
      alert('Ошибка соединения');
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setShowModal(true);
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    if (!confirm(`Удалить проект "${projectName}"? Это действие нельзя отменить.`)) return;
    try {
      const res = await fetch(`/api/services/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProjects();
      } else {
        const data = await res.json();
        alert(data.error || 'Ошибка удаления');
      }
    } catch {
      alert('Ошибка соединения');
    }
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    setEditingProject(null);
    fetchProjects();
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchProjects(), 300);
    return () => clearTimeout(timer);
  }, [filters.status, filters.accountManagerId, filters.sellerId, filters.productId, filters.activeOnly]);

  const isOwner = user && (user.roleCode === 'OWNER' || user.roleCode === 'CEO');

  const filteredProjects = projects.filter((p) => {
    if (!filters.search) return true;
    const s = filters.search.toLowerCase();
    return (
      p.site.title.toLowerCase().includes(s) ||
      p.site.client.name.toLowerCase().includes(s) ||
      p.product.name.toLowerCase().includes(s) ||
      (p.site.websiteUrl && p.site.websiteUrl.toLowerCase().includes(s))
    );
  });

  // Get unique products for filter
  const productOptions = Array.from(new Set(projects.map((p) => p.product.id))).map((id) => {
    const prod = projects.find((p) => p.product.id === id)?.product;
    return prod ? { id: prod.id, name: prod.name } : null;
  }).filter(Boolean) as Array<{ id: string; name: string }>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Проекты</h1>
        <button
          onClick={() => { setEditingProject(null); setShowModal(true); }}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
        >
          + Добавить проект
        </button>
      </div>

      {/* Unassigned clients warning */}
      {isOwner && unassignedClients.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-amber-800">
              Нераспределённые клиенты ({unassignedClients.length})
            </h2>
            <button
              onClick={() => setShowUnassigned(!showUnassigned)}
              className="text-amber-700 hover:text-amber-900 text-sm font-medium"
            >
              {showUnassigned ? 'Скрыть' : 'Показать'}
            </button>
          </div>
          {showUnassigned && (
            <div className="space-y-3 mt-3">
              {unassignedClients.map((client) => (
                <div key={client.id} className="bg-white rounded-md p-3 border border-amber-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">{client.name}</span>
                      {client.seller && (
                        <span className="text-sm text-gray-500 ml-2">
                          Продавец: {client.seller.fullName}
                        </span>
                      )}
                      {client.sites.length > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          Сайты: {client.sites.map((s) => s.title).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {assigningClient === client.id ? (
                        <>
                          <select
                            value={assignAMId}
                            onChange={(e) => setAssignAMId(e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="">Выберите АМ</option>
                            {accountManagers.map((am) => (
                              <option key={am.id} value={am.id}>{am.fullName}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAssignAM(client.id)}
                            disabled={!assignAMId}
                            className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            Назначить
                          </button>
                          <button
                            onClick={() => setAssigningClient(null)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                          >
                            Отмена
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setAssigningClient(client.id); setAssignAMId(''); }}
                          className="text-sm bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700"
                        >
                          Назначить АМ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Поиск</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Сайт, клиент, продукт..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Статус</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Все</option>
              <option value="ACTIVE">Активные</option>
              <option value="PAUSED">Приостановленные</option>
              <option value="FINISHED">Завершённые</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Продукт</label>
            <select
              value={filters.productId}
              onChange={(e) => handleFilterChange('productId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Все</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Аккаунт-менеджер</label>
            <select
              value={filters.accountManagerId}
              onChange={(e) => handleFilterChange('accountManagerId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Все</option>
              {accountManagers.map((am) => (
                <option key={am.id} value={am.id}>{am.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Продавец</label>
            <select
              value={filters.sellerId}
              onChange={(e) => handleFilterChange('sellerId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Все</option>
              {accountManagers.map((am) => (
                <option key={am.id} value={am.id}>{am.fullName}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.activeOnly}
              onChange={(e) => setFilters((prev) => ({ ...prev, activeOnly: e.target.checked }))}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Только активные клиенты</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => { setError(''); fetchProjects(); }} className="ml-4 text-red-800 underline">Повторить</button>
        </div>
      )}

      {/* Projects table */}
      {loading ? (
        <div className="text-center py-8">Загрузка...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сайт</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент / Юрлицо</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Услуга</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Цена</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Период</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Оплата</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">АМ / Продавец</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProjects.map((p) => {
                  const lastPeriod = p.workPeriods[0];
                  const periodPaid = lastPeriod
                    ? lastPeriod.incomes.reduce((sum, inc) => sum + Number(inc.amount), 0)
                    : 0;
                  const periodExpected = lastPeriod?.expectedAmount ? Number(lastPeriod.expectedAmount) : (p.price ? Number(p.price) : 0);

                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{p.site.title}</div>
                        {p.site.websiteUrl && (
                          <a href={p.site.websiteUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                            {p.site.websiteUrl}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-gray-900">{p.site.client.isSystem ? '—' : p.site.client.name}</div>
                        {p.site.client.legalEntity && (
                          <div className="text-xs text-gray-500">{p.site.client.legalEntity.name}</div>
                        )}
                        {p.isFromPartner && p.site.client.agent && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                            Партнёр: {p.site.client.agent.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium">{p.product.name}</span>
                        <div className="text-xs text-gray-500">{BILLING_LABELS[p.billingType] || p.billingType}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{formatMoney(p.price)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100'}`}>
                          {STATUS_LABELS[p.status] || p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {lastPeriod ? (
                          <div>
                            <div className="text-xs">{formatDate(lastPeriod.dateFrom)} — {formatDate(lastPeriod.dateTo)}</div>
                            <div className="text-xs text-gray-500">Ожидание: {formatMoney(periodExpected)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Нет периодов</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {lastPeriod ? (
                          <div>
                            <div className={`font-medium ${periodPaid >= periodExpected ? 'text-green-600' : 'text-red-600'}`}>
                              {formatMoney(periodPaid)}
                            </div>
                            {periodPaid < periodExpected && (
                              <div className="text-xs text-red-500">
                                Долг: {formatMoney(periodExpected - periodPaid)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {p.site.client.accountManager && (
                          <div className="text-xs">АМ: {p.site.client.accountManager.fullName}</div>
                        )}
                        {p.site.client.seller && (
                          <div className="text-xs text-gray-500">Прод: {p.site.client.seller.fullName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col gap-1">
                          <Link
                            href={`/services/${p.id}/periods`}
                            className="text-blue-600 hover:text-blue-900 text-xs"
                          >
                            Периоды
                          </Link>
                          <button
                            onClick={() => handleEdit(p)}
                            className="text-blue-600 hover:text-blue-900 text-xs text-left"
                          >
                            Редактировать
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, `${p.site.title} — ${p.product.name}`)}
                            className="text-red-600 hover:text-red-900 text-xs text-left"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredProjects.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              {projects.length === 0 ? 'Проекты не найдены' : 'Нет проектов по заданным фильтрам'}
            </div>
          )}
          <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500">
            Всего: {filteredProjects.length} проект(ов)
          </div>
        </div>
      )}

      {showModal && (
        <ProjectModal
          project={editingProject}
          onClose={() => { setShowModal(false); setEditingProject(null); }}
          onSuccess={handleModalSuccess}
          user={user}
        />
      )}
    </div>
  );
}
