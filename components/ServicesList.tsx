'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ServiceModal from './ServiceModal';
import { formatDate } from '@/lib/utils';

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

export default function ServicesList({
  siteId,
  onClose,
}: {
  siteId: string;
  onClose: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [site, setSite] = useState<any>(null);
  const [canAdd, setCanAdd] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchSite = async () => {
    const res = await fetch(`/api/sites/${siteId}`);
    const data = await res.json();
    if (data.site) {
      setSite(data.site);
    }
  };

  const fetchServices = async () => {
    setLoading(true);
    const res = await fetch(`/api/services?siteId=${siteId}`);
    const data = await res.json();
    setServices(data.services || []);
    setLoading(false);
  };

  const checkPermissions = async () => {
    if (!user || !site) return;

    // OWNER and CEO have full access
    if (user.roleCode === 'OWNER' || user.roleCode === 'CEO') {
      setCanAdd(true);
      setCanEdit(true);
      setCanDelete(true);
      return;
    }

    // Check permissions via API
    try {
      const [createRes, editRes, deleteRes] = await Promise.all([
        fetch('/api/permissions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'services', permission: 'create' }),
        }),
        fetch('/api/permissions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'services', permission: 'edit' }),
        }),
        fetch('/api/permissions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'services', permission: 'delete' }),
        }),
      ]);

      const createData = await createRes.json();
      const editData = await editRes.json();
      const deleteData = await deleteRes.json();

      // Additional checks for ACCOUNT_MANAGER and SELLER
      let canAddService = createData.hasPermission || false;
      let canEditService = editData.hasPermission || false;
      let canDeleteService = deleteData.hasPermission || false;

      if (user.roleCode === 'ACCOUNT_MANAGER') {
        // Can only add/edit services for clients they manage
        canAddService = canAddService && site.client?.accountManagerId === user.id;
        canEditService = canEditService && site.client?.accountManagerId === user.id;
        canDeleteService = canDeleteService && site.client?.accountManagerId === user.id;
      } else if (user.roleCode === 'SELLER') {
        // Can only add/edit services for sites of their clients
        canAddService = canAddService && site.client?.sellerEmployeeId === user.id;
        canEditService = canEditService && site.client?.sellerEmployeeId === user.id;
        canDeleteService = canDeleteService && site.client?.sellerEmployeeId === user.id;
      }

      setCanAdd(canAddService);
      setCanEdit(canEditService);
      setCanDelete(canDeleteService);
    } catch (error) {
      console.error('Error checking permissions:', error);
      setCanAdd(false);
      setCanEdit(false);
      setCanDelete(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchSite();
    fetchServices();
  }, [siteId]);

  useEffect(() => {
    if (user && site) {
      checkPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, site]);

  const handleAdd = () => {
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="text-center py-8">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">
              Услуги сайта: {site?.title}
            </h2>
            {site?.client && (
              <p className="text-sm text-gray-500 mt-1">
                Клиент: {site.client.name}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {canAdd && (
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Добавить услугу
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Закрыть
            </button>
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
                      {service.endDate ? formatDate(service.endDate) : '—'}
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
                      <Link
                        href={`/services/${service.id}/periods`}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Периоды
                      </Link>
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
            siteId={siteId}
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
    </div>
  );
}
