'use client';

import { useState, useEffect } from 'react';
import { formatAmount, formatDate, formatDateTime } from '@/lib/utils';
import ExpenseModal from './ExpenseModal';

interface Expense {
  id: string;
  amount: string;
  costItemId: string;
  costItem: {
    id: string;
    title: string;
    costCategory: { id: string; name: string } | null;
  };
  employeeId: string | null;
  employee: {
    id: string;
    fullName: string;
    department: {
      id: string;
      name: string;
    };
  } | null;
  siteId: string | null;
  site: {
    id: string;
    title: string;
    client: {
      id: string;
      name: string;
    };
  } | null;
  serviceId: string | null;
  service: {
    id: string;
    product: {
      id: string;
      name: string;
    };
  } | null;
  legalEntityId: string | null;
  legalEntity: { id: string; name: string } | null;
  comment: string | null;
  creator: {
    id: string;
    fullName: string;
  };
  paymentAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string | null;
  updater: {
    id: string;
    fullName: string;
  } | null;
}

interface CostItem {
  id: string;
  title: string;
  sortOrder: number;
  costCategoryId: string;
  costCategory: { id: string; name: string; sortOrder: number };
}

interface User {
  id: string;
  roleCode: string;
}

interface Employee {
  id: string;
  fullName: string;
  department: {
    id: string;
    name: string;
  } | null;
}

interface Site {
  id: string;
  title: string;
  client: {
    id: string;
    name: string;
  };
}

interface LegalEntity {
  id: string;
  name: string;
}

interface ServiceOption {
  id: string;
  product: { name: string };
}

export default function ExpensesList() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [quickAddServices, setQuickAddServices] = useState<ServiceOption[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [canAdd, setCanAdd] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const defaultLegalEntityId = legalEntities.find((e) => e.name === 'ИП Мятов Сбербанк')?.id ?? legalEntities[0]?.id ?? '';
  const [quickAdd, setQuickAdd] = useState({
    amount: '',
    costItemId: '',
    employeeId: '',
    siteId: '',
    serviceId: '',
    legalEntityId: '',
    paymentAt: new Date().toISOString().slice(0, 16),
    comment: '',
  });
  const [filters, setFilters] = useState({
    dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    category: '',
    costItemId: '',
    departmentId: '',
    employeeId: '',
    siteId: '',
    serviceId: '',
    clientId: '',
  });

  useEffect(() => {
    fetchUser();
    fetchCostItems();
    fetchEmployees();
    fetchSites();
    fetchLegalEntities();
    fetchExpenses();
  }, [filters]);

  useEffect(() => {
    if (legalEntities.length && !quickAdd.legalEntityId) {
      const defaultId = legalEntities.find((e) => e.name === 'ИП Мятов Сбербанк')?.id ?? legalEntities[0]?.id ?? '';
      if (defaultId) setQuickAdd((prev) => ({ ...prev, legalEntityId: defaultId }));
    }
  }, [legalEntities]);

  useEffect(() => {
    if (user) {
      // Check permissions via API
      fetch('/api/permissions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'expenses', permission: 'create' }),
      })
        .then((r) => r.json())
        .then((data) => {
          setCanAdd(data.hasPermission || false);
        });
    }
  }, [user]);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchCostItems = async () => {
    const res = await fetch('/api/cost-items');
    const data = await res.json();
    setCostItems(data.costItems || []);
  };

  const fetchEmployees = async () => {
    const res = await fetch('/api/users/with-departments');
    const data = await res.json();
    setEmployees(data.users || []);
  };

  const fetchSites = async () => {
    const res = await fetch('/api/sites/available');
    const data = await res.json();
    setSites(data.sites || []);
  };

  const fetchLegalEntities = async () => {
    const res = await fetch('/api/legal-entities');
    const data = await res.json();
    setLegalEntities(data.legalEntities || []);
  };

  const fetchQuickAddServices = async (siteId: string) => {
    if (!siteId) {
      setQuickAddServices([]);
      return;
    }
    const res = await fetch(`/api/services?siteId=${siteId}&status=ACTIVE`);
    const data = await res.json();
    setQuickAddServices(data.services || []);
  };

  const handleQuickAddSiteChange = (siteId: string) => {
    setQuickAdd({ ...quickAdd, siteId, serviceId: '' });
    fetchQuickAddServices(siteId);
  };

  const fetchExpenses = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    const res = await fetch(`/api/expenses?${params}`);
    const data = await res.json();
    setExpenses(data.expenses || []);
    setLoading(false);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAdd.amount || !quickAdd.costItemId) {
      alert('Заполните сумму и тип расхода');
      return;
    }

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: quickAdd.amount,
          costItemId: quickAdd.costItemId,
          employeeId: quickAdd.employeeId || null,
          siteId: quickAdd.siteId || null,
          serviceId: quickAdd.serviceId || null,
          legalEntityId: quickAdd.legalEntityId || null,
          paymentAt: quickAdd.paymentAt,
          comment: quickAdd.comment && quickAdd.comment.trim() ? quickAdd.comment.trim() : null,
        }),
      });

      if (res.ok) {
        setQuickAdd({
          amount: '',
          legalEntityId: defaultLegalEntityId || quickAdd.legalEntityId,
          costItemId: '',
          employeeId: '',
          siteId: '',
          serviceId: '',
          paymentAt: new Date().toISOString().slice(0, 16),
          comment: '',
        });
        fetchExpenses();
      } else {
        let errorMsg = 'Ошибка добавления';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
          const details = data.details ? `: ${data.details}` : '';
          console.error('Error adding expense:', data);
          alert(`${errorMsg}${details}`);
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          alert(`${errorMsg} (HTTP ${res.status})`);
        }
      }
    } catch (error) {
      console.error('Network error adding expense:', error);
      alert('Ошибка соединения с сервером. Проверьте, что сервер запущен и доступен.');
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setShowModal(true);
  };

  const handleDelete = async (expense: Expense) => {
    if (!confirm(`Удалить расход на сумму ${formatAmount(expense.amount)}?`)) {
      return;
    }

    const res = await fetch(`/api/expenses/${expense.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchExpenses();
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Расходы</h1>
        {canAdd && (
          <button
            onClick={() => document.getElementById('quick-add-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
          >
            + Добавить расход
          </button>
        )}
      </div>

      {/* Quick Add Form */}
      {canAdd && (
        <div id="quick-add-form" className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Быстрое добавление расхода</h2>
        <form onSubmit={handleQuickAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сумма (руб.) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={quickAdd.amount}
                onChange={(e) => setQuickAdd({ ...quickAdd, amount: e.target.value })}
                className="w-full px-3 py-3 border border-gray-300 rounded-md text-xl"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тип расхода *
              </label>
              <select
                required
                value={quickAdd.costItemId}
                onChange={(e) => setQuickAdd({ ...quickAdd, costItemId: e.target.value })}
                className="w-full px-3 py-3 border border-gray-300 rounded-md"
              >
                <option value="">Выберите</option>
                {(() => {
                  const byCategory = new Map<string, CostItem[]>();
                  for (const item of costItems) {
                    const catId = item.costCategory?.id ?? '';
                    if (!byCategory.has(catId)) byCategory.set(catId, []);
                    byCategory.get(catId)!.push(item);
                  }
                  const categories = Array.from(byCategory.entries())
                    .map(([catId, items]) => ({
                      id: catId,
                      name: items[0]?.costCategory?.name ?? '',
                      sortOrder: items[0]?.costCategory?.sortOrder ?? 0,
                      items,
                    }))
                    .sort((a, b) => a.sortOrder - b.sortOrder);
                  return categories.map((cat) => (
                    <optgroup key={cat.id} label={cat.name}>
                      {cat.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </optgroup>
                  ));
                })()}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сотрудник (опционально)
              </label>
              <select
                value={quickAdd.employeeId}
                onChange={(e) => setQuickAdd({ ...quickAdd, employeeId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Не выбран</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} {emp.department ? `(${emp.department.name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сайт (опционально)
              </label>
              <select
                value={quickAdd.siteId}
                onChange={(e) => handleQuickAddSiteChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Не выбран</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.title} ({site.client.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Услуга (опционально)
              </label>
              <select
                value={quickAdd.serviceId}
                onChange={(e) => setQuickAdd({ ...quickAdd, serviceId: e.target.value })}
                disabled={!quickAdd.siteId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Не выбрана</option>
                {quickAddServices.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.product.name}
                  </option>
                ))}
              </select>
              <p className="mt-0.5 text-xs text-gray-500">По выбранному сайту</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Юрлицо
              </label>
              <select
                value={quickAdd.legalEntityId || defaultLegalEntityId}
                onChange={(e) => setQuickAdd({ ...quickAdd, legalEntityId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Не выбрано</option>
                {legalEntities.map((le) => (
                  <option key={le.id} value={le.id}>
                    {le.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата платежа
              </label>
              <input
                type="datetime-local"
                value={quickAdd.paymentAt}
                onChange={(e) => setQuickAdd({ ...quickAdd, paymentAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Комментарий
            </label>
            <textarea
              value={quickAdd.comment}
              onChange={(e) => setQuickAdd({ ...quickAdd, comment: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Введите комментарий (необязательно)"
              rows={2}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
            >
              ОК
            </button>
          </div>
        </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата от
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата до
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Категория
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Все</option>
              {(() => {
                const seen = new Set<string>();
                const list: { id: string; name: string; sortOrder: number }[] = [];
                for (const item of costItems) {
                  const cat = item.costCategory;
                  if (cat && !seen.has(cat.id)) {
                    seen.add(cat.id);
                    list.push({ id: cat.id, name: cat.name, sortOrder: cat.sortOrder });
                  }
                }
                list.sort((a, b) => a.sortOrder - b.sortOrder);
                return list.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ));
              })()}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                dateTo: new Date().toISOString().split('T')[0],
                category: '',
                costItemId: '',
                departmentId: '',
                employeeId: '',
                siteId: '',
    serviceId: '',
                clientId: '',
              })}
              className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата платежа
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сумма
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Категория
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тип расхода
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сотрудник
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Отдел
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сайт
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Юрлицо
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Услуга
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Клиент
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Кто внес
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Комментарий
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(expense.paymentAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatAmount(expense.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {expense.costItem?.costCategory?.name ?? '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {expense.costItem?.title ?? '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {expense.employee?.fullName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {expense.employee?.department?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {expense.site?.title || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {expense.legalEntity?.name ?? '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {expense.service?.product?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {expense.site?.client?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {expense.creator?.fullName ?? '-'}
                    {expense.updatedAt && expense.updater && (
                      <div className="text-xs text-gray-400">
                        Изменено: {expense.updater?.fullName ?? '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    {expense.comment || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {(user && (user.id === expense.creator?.id || user.roleCode === 'OWNER' || user.roleCode === 'CEO')) && (
                      <>
                        {(user.roleCode === 'OWNER' || user.roleCode === 'CEO') && (
                          <button
                            onClick={() => handleEdit(expense)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Редактировать
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(expense)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {expenses.length === 0 && (
          <div className="text-center py-8 text-gray-500">Расходы не найдены</div>
        )}
      </div>

      {showModal && (
        <ExpenseModal
          expense={editingExpense}
          user={user}
          onClose={() => {
            setShowModal(false);
            setEditingExpense(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingExpense(null);
            fetchExpenses();
          }}
        />
      )}
    </div>
  );
}
