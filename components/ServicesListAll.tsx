'use client';

import { useState, useEffect } from 'react';
import ServiceModal from './ServiceModal';
import Link from 'next/link';

interface Service {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
  };
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  startDate: Date | string;
  endDate: Date | string | null;
  billingType: 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  price: string | bigint | null;
  autoRenew: boolean;
  responsibleUserId: string | null;
  responsible: {
    id: string;
    fullName: string;
  } | null;
  comment: string | null;
  site: {
    id: string;
    title: string;
    client: {
      id: string;
      name: string;
    };
  };
}

interface User {
  id: string;
  fullName: string;
  roleCode: string;
}

export default function ServicesListAll() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    siteId: '',
  });
  const [sites, setSites] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    fetchUser();
    fetchSites();
    fetchServices();
  }, [filters]);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchSites = async () => {
    const res = await fetch('/api/sites/available');
    const data = await res.json();
    setSites(data.sites || []);
  };

  const fetchServices = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.siteId) params.set('siteId', filters.siteId);

    const res = await fetch(`/api/services?${params}`);
    const data = await res.json();
    setServices(data.services || []);
    setLoading(false);
  };

  const handleAdd = () => {
    // Check if there are available sites
    if (sites.length === 0) {
      alert('Нет доступных сайтов. Сначала создайте сайт.');
      return;
    }
    // Open modal - site can be selected in the modal if not filtered
    setEditingService(null);
    setShowModal(true);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setShowModal(true);
  };

  const handleDelete = async (service: Service) => {
    if (!confirm(`Удалить услугу "${service.product.name}"?`)) {
      return;
    }

    const res = await fetch(`/api/services/${service.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchServices();
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  const formatAmount = (amount: bigint | number | string | null) => {
    if (!amount) return '-';
    const num = typeof amount === 'bigint' ? Number(amount) : typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(num / 100);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ru-RU');
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: 'Активна',
      PAUSED: 'Приостановлена',
      FINISHED: 'Завершена',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      FINISHED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getBillingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ONE_TIME: 'Разово',
      MONTHLY: 'Ежемесячно',
      QUARTERLY: 'Ежеквартально',
      YEARLY: 'Ежегодно',
    };
    return labels[type] || type;
  };

  // Check if user can add/edit/delete services
  // OWNER and CEO have full access (no restrictions)
  const canAdd = user && (user.roleCode === 'OWNER' || user.roleCode === 'CEO' || user.roleCode === 'ACCOUNT_MANAGER' || user.roleCode === 'SELLER');
  const canEdit = user && (user.roleCode === 'OWNER' || user.roleCode === 'CEO' || user.roleCode === 'ACCOUNT_MANAGER' || user.roleCode === 'SELLER');
  // Only OWNER and CEO can delete services
  const canDelete = user && (user.roleCode === 'OWNER' || user.roleCode === 'CEO');

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Услуги</h1>
        {canAdd && (
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
          >
            + Добавить услугу
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Статус
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Все</option>
              <option value="ACTIVE">Активные</option>
              <option value="PAUSED">Приостановленные</option>
              <option value="FINISHED">Завершенные</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Сайт
            </label>
            <select
              value={filters.siteId}
              onChange={(e) => setFilters({ ...filters, siteId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Все сайты</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', siteId: '' })}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Продукт
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сайт
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Клиент
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата старта
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата окончания
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тип биллинга
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Цена
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ответственный
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {service.product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <Link href={`/sites`} className="text-blue-600 hover:text-blue-900">
                      {service.site.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.site.client.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(service.status)}`}
                    >
                      {getStatusLabel(service.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(service.startDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(service.endDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getBillingTypeLabel(service.billingType)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatAmount(service.price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.responsible?.fullName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {canEdit && (
                      <button
                        onClick={() => handleEdit(service)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Редактировать
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(service)}
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
        {services.length === 0 && (
          <div className="text-center py-8 text-gray-500">Услуги не найдены</div>
        )}
      </div>

      {showModal && (
        <ServiceModal
          siteId={editingService?.site.id || filters.siteId || undefined}
          service={editingService}
          onClose={() => {
            setShowModal(false);
            setEditingService(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingService(null);
            fetchServices();
          }}
        />
      )}
    </div>
  );
}
