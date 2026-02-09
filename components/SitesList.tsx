'use client';

import { useState, useEffect } from 'react';
import SiteModal from './SiteModal';
import ServicesList from './ServicesList';
import { formatDate } from '@/lib/utils';

interface Site {
  id: string;
  title: string;
  websiteUrl: string | null;
  description: string | null;
  isActive: boolean;
  niche: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    seller: {
      id: string;
      fullName: string;
    };
  };
  accountManagerId: string | null;
  accountManager: {
    id: string;
    fullName: string;
  } | null;
  creator: {
    id: string;
    fullName: string;
  };
  services: Array<{
    id: string;
    product: {
      name: string;
    };
  }>;
  expenses: Array<{
    id: string;
    amount: string | bigint;
    paymentAt: Date | string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  fullName: string;
  roleCode: string;
}

export default function SitesList() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [showServices, setShowServices] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    isActive: '', // по умолчанию "Все" — показываем все сайты
    accountManagerId: '',
    sellerId: '',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    fetchUser();
    fetchSites();
  }, [filters]);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchSites = async () => {
    setLoading(true);
    setSitesError(null);
    const params = new URLSearchParams();
    if (filters.isActive) params.set('isActive', filters.isActive);
    if (filters.accountManagerId) params.set('accountManagerId', filters.accountManagerId);
    if (filters.sellerId) params.set('sellerId', filters.sellerId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    const res = await fetch(`/api/sites?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSitesError(data.error || 'Ошибка загрузки сайтов');
      setSites([]);
    } else {
      setSites(data.sites || []);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingSite(null);
    setShowModal(true);
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setShowModal(true);
  };

  const handleViewServices = (site: Site) => {
    setSelectedSite(site);
    setShowServices(true);
  };

  const handleDelete = async (site: Site) => {
    if (!confirm(`Удалить сайт "${site.title}"?`)) {
      return;
    }

    const res = await fetch(`/api/sites/${site.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchSites();
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  const formatAmount = (amount: bigint | number | string) => {
    const num = typeof amount === 'bigint' ? Number(amount) : typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(num / 100);
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Сайты</h1>
        <button
          onClick={handleAdd}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
        >
          + Добавить сайт
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Статус
            </label>
            <select
              value={filters.isActive}
              onChange={(e) => setFilters({ ...filters, isActive: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Все</option>
              <option value="true">Активные</option>
              <option value="false">Неактивные</option>
            </select>
          </div>
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
          <div className="md:col-span-2 flex items-end">
            <button
              onClick={() => setFilters({
                isActive: '',
                accountManagerId: '',
                sellerId: '',
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

      {/* Sites Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {sitesError && (
          <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 text-amber-800">
            {sitesError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Клиент
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Аккаунт
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Продавец
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ниша
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Услуги
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Последний расход
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sites.map((site) => (
                <tr key={site.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{site.title}</div>
                    {site.websiteUrl && (
                      <div className="text-sm text-gray-500">{site.websiteUrl}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {site.client.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {site.accountManager?.fullName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {site.client.seller.fullName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {site.niche || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {site.services && site.services.length > 0 ? (
                      <div>
                        {site.services.map((s, idx) => (
                          <div key={s.id} className={idx > 0 ? 'mt-1' : ''}>
                            {s.product.name}
                          </div>
                        ))}
                        {site.services.length > 5 && (
                          <div className="text-xs text-gray-400 mt-1">
                            +{site.services.length - 5} еще
                          </div>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {site.expenses && site.expenses.length > 0 ? (
                      <div>
                        <div>{formatAmount(site.expenses[0].amount)}</div>
                        <div className="text-xs text-gray-400">
                          {formatDate(site.expenses[0].paymentAt)}
                        </div>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        site.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {site.isActive ? 'Активен' : 'Не активен'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleViewServices(site)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Услуги
                    </button>
                    <button
                      onClick={() => handleEdit(site)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Редактировать
                    </button>
                    {user && (user.roleCode === 'OWNER' || user.roleCode === 'CEO') && (
                      <button
                        onClick={() => handleDelete(site)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Удалить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sites.length === 0 && !sitesError && (
          <div className="text-center py-8 text-gray-500">Сайты не найдены</div>
        )}
      </div>

      {showModal && (
        <SiteModal
          site={editingSite}
          onClose={() => {
            setShowModal(false);
            setEditingSite(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingSite(null);
            fetchSites();
          }}
        />
      )}

      {showServices && selectedSite && (
        <ServicesList
          siteId={selectedSite.id}
          onClose={() => {
            setShowServices(false);
            setSelectedSite(null);
            fetchSites();
          }}
        />
      )}
    </div>
  );
}
