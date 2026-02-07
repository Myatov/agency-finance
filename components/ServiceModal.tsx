'use client';

import { useState, useEffect } from 'react';

interface Service {
  id: string;
  productId: string;
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  startDate: Date | string;
  endDate: Date | string | null;
  billingType: 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  prepaymentType?: 'FULL_PREPAY' | 'PARTIAL_PREPAY' | 'POSTPAY';
  price: string | bigint | null;
  autoRenew: boolean;
  responsibleUserId: string | null;
  comment: string | null;
}

interface Product {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
}

interface Site {
  id: string;
  title: string;
}

export default function ServiceModal({
  siteId,
  service,
  onClose,
  onSuccess,
}: {
  siteId?: string;
  service: Service | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    siteId: siteId || '',
    productId: '',
    status: 'ACTIVE' as 'ACTIVE' | 'PAUSED' | 'FINISHED',
    startDate: '',
    endDate: '',
    billingType: 'ONE_TIME' as 'ONE_TIME' | 'MONTHLY' | 'YEARLY',
    prepaymentType: 'POSTPAY' as 'FULL_PREPAY' | 'PARTIAL_PREPAY' | 'POSTPAY',
    price: '',
    autoRenew: false,
    responsibleUserId: '',
    comment: '',
  });
  const [sites, setSites] = useState<Site[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchUsers();
    fetchSites();

    if (service) {
      setFormData({
        siteId: siteId || '',
        productId: service.productId,
        status: service.status,
        startDate: service.startDate ? new Date(service.startDate).toISOString().split('T')[0] : '',
        endDate: service.endDate ? new Date(service.endDate).toISOString().split('T')[0] : '',
        billingType: service.billingType === 'QUARTERLY' ? 'MONTHLY' : service.billingType,
        prepaymentType: (service as any).prepaymentType || 'POSTPAY',
        price: service.price ? (typeof service.price === 'bigint' ? Number(service.price) / 100 : parseFloat(service.price.toString()) / 100).toString() : '',
        autoRenew: service.autoRenew,
        responsibleUserId: service.responsibleUserId || '',
        comment: service.comment || '',
      });
    } else {
      // Set default start date to today and siteId if provided
      setFormData(prev => ({
        ...prev,
        siteId: siteId || prev.siteId,
        startDate: new Date().toISOString().split('T')[0],
      }));
    }
  }, [service, siteId]);

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data.products || []);
  };

  const fetchUsers = async () => {
    const res = await fetch('/api/users/with-departments');
    const data = await res.json();
    setUsers(data.users || []);
  };

  const fetchSites = async () => {
    const res = await fetch('/api/sites/available');
    const data = await res.json();
    setSites(data.sites || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = service ? `/api/services/${service.id}` : '/api/services';
      const method = service ? 'PUT' : 'POST';

      const payload: any = {
        siteId: formData.siteId || siteId,
        productId: formData.productId,
        status: formData.status,
        startDate: formData.startDate,
        endDate: formData.endDate || null,
        billingType: formData.billingType,
        prepaymentType: formData.prepaymentType,
        price: formData.price ? parseFloat(formData.price) : null,
        autoRenew: formData.autoRenew,
        responsibleUserId: formData.responsibleUserId || null,
        comment: formData.comment || null,
      };

      if (!payload.siteId) {
        setError('Выберите сайт');
        setLoading(false);
        return;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка сохранения');
        setLoading(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Ошибка соединения');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {service ? 'Редактировать услугу' : 'Добавить услугу'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!siteId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сайт *
              </label>
              <select
                required
                value={formData.siteId}
                onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Выберите сайт</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Продукт *
            </label>
            <select
              required
              value={formData.productId}
              onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Выберите продукт</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Статус *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="ACTIVE">Активна</option>
              <option value="PAUSED">Приостановлена</option>
              <option value="FINISHED">Завершена</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата старта *
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата окончания
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип биллинга *
            </label>
            <select
              required
              value={formData.billingType}
              onChange={(e) => setFormData({ ...formData, billingType: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="ONE_TIME">Разово</option>
              <option value="MONTHLY">Ежемесячно</option>
              <option value="YEARLY">Ежегодно</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Когда выставлять счёт
            </label>
            <select
              value={formData.prepaymentType}
              onChange={(e) => setFormData({ ...formData, prepaymentType: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="FULL_PREPAY">Полная предоплата</option>
              <option value="PARTIAL_PREPAY">Частичная предоплата</option>
              <option value="POSTPAY">Постоплата</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">Отчёт и закрывающие документы — всегда в конце периода</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Цена (руб.)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ответственный
            </label>
            <select
              value={formData.responsibleUserId}
              onChange={(e) => setFormData({ ...formData, responsibleUserId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Не назначен</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoRenew"
              checked={formData.autoRenew}
              onChange={(e) => setFormData({ ...formData, autoRenew: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="autoRenew" className="ml-2 block text-sm text-gray-900">
              Автопродление
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Комментарий
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
