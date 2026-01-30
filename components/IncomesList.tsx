'use client';

import { useState, useEffect } from 'react';
import IncomeModal from './IncomeModal';
import { formatAmount, formatDate } from '@/lib/utils';

interface Income {
  id: string;
  amount: string;
  serviceId: string;
  service: {
    id: string;
    product: {
      id: string;
      name: string;
    };
    site: {
      id: string;
      title: string;
      client: {
        id: string;
        name: string;
        seller: {
          id: string;
          fullName: string;
        };
      };
      accountManager: {
        id: string;
        fullName: string;
      } | null;
    };
  };
  legalEntityId?: string | null;
  legalEntity?: {
    id: string;
    name: string;
  } | null;
  comment: string | null;
  incomeDate: Date | string;
  creator: {
    id: string;
    fullName: string;
  };
  createdAt: Date | string;
  updatedAt: Date | string | null;
  updater: {
    id: string;
    fullName: string;
  } | null;
}

interface User {
  id: string;
  fullName: string;
  roleCode: string;
}

export default function IncomesList() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [filters, setFilters] = useState({
    siteId: '',
    serviceId: '',
    sellerId: '',
    accountManagerId: '',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    fetchUser();
    fetchIncomes();
  }, [filters]);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchIncomes = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.siteId) params.set('siteId', filters.siteId);
    if (filters.serviceId) params.set('serviceId', filters.serviceId);
    if (filters.sellerId) params.set('sellerId', filters.sellerId);
    if (filters.accountManagerId) params.set('accountManagerId', filters.accountManagerId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    const res = await fetch(`/api/incomes?${params}`);
    const data = await res.json();
    setIncomes(data.incomes || []);
    setLoading(false);
  };

  const [canAdd, setCanAdd] = useState(false);

  useEffect(() => {
    if (user) {
      // Check permissions via API
      fetch('/api/permissions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'incomes', permission: 'create' }),
      })
        .then((r) => r.json())
        .then((data) => {
          setCanAdd(data.hasPermission || false);
        });
    }
  }, [user]);

  const handleAdd = () => {
    setEditingIncome(null);
    setShowModal(true);
  };

  const handleEdit = (income: Income) => {
    setEditingIncome(income);
    setShowModal(true);
  };

  const handleDelete = async (income: Income) => {
    if (!confirm(`Удалить доход на сумму ${formatAmount(income.amount)}?`)) {
      return;
    }

    const res = await fetch(`/api/incomes/${income.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchIncomes();
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
        <h1 className="text-3xl font-bold">Доходы</h1>
        {canAdd && (
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
          >
            + Добавить доход
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <div className="md:col-span-3 flex items-end">
            <button
              onClick={() => setFilters({
                siteId: '',
                serviceId: '',
                sellerId: '',
                accountManagerId: '',
                dateFrom: '',
                dateTo: '',
              })}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      </div>

      {/* Incomes Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сумма
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Клиент
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сайт
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Услуга (Продукт)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Юрлицо
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Продавец
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Аккаунт
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Кто внес
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {incomes.map((income) => (
                <tr key={income.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(income.incomeDate || income.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatAmount(income.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {income.service.site.client.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {income.service.site.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {income.service.product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {income.legalEntity?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {income.service.site.client.seller.fullName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {income.service.site.accountManager?.fullName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {income.creator.fullName}
                    {income.updatedAt && income.updater && (
                      <div className="text-xs text-gray-400">
                        Изменено: {income.updater.fullName} ({formatDate(income.updatedAt)})
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {(user && (user.id === income.creator.id || user.roleCode === 'OWNER' || user.roleCode === 'CEO')) && (
                      <>
                        <button
                          onClick={() => handleEdit(income)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => handleDelete(income)}
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
        {incomes.length === 0 && (
          <div className="text-center py-8 text-gray-500">Доходы не найдены</div>
        )}
      </div>

      {showModal && (
        <IncomeModal
          income={editingIncome}
          user={user}
          onClose={() => {
            setShowModal(false);
            setEditingIncome(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingIncome(null);
            fetchIncomes();
          }}
        />
      )}
    </div>
  );
}
