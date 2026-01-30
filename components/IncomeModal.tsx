'use client';

import { useState, useEffect } from 'react';

interface Income {
  id: string;
  amount: string;
  serviceId: string;
  service?: {
    id: string;
    product: {
      name: string;
    };
    site: {
      id: string;
      title: string;
      client: {
        id: string;
        name: string;
      };
    };
  };
  legalEntityId?: string | null;
  comment: string | null;
  incomeDate?: Date | string;
}

interface User {
  id: string;
  roleCode: string;
}

interface Service {
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
    };
  };
}

interface LegalEntity {
  id: string;
  name: string;
  isActive?: boolean;
}

export default function IncomeModal({
  income,
  onClose,
  onSuccess,
  user,
}: {
  income: Income | null;
  onClose: () => void;
  onSuccess: () => void;
  user?: User | null;
}) {
  const [formData, setFormData] = useState({
    amount: '',
    serviceId: '',
    legalEntityId: '',
    comment: '',
    incomeDate: '',
  });
  const [services, setServices] = useState<Service[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [sites, setSites] = useState<Array<{ id: string; title: string; client: { id: string; name: string } }>>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLegalEntities();
    if (!income) {
      fetchSites();
    }

    if (income) {
      const incomeDate = income.incomeDate 
        ? new Date(income.incomeDate).toISOString().slice(0, 16)
        : '';
      setFormData({
        amount: (Number(income.amount) / 100).toString(),
        serviceId: income.serviceId,
        legalEntityId: income.legalEntityId || '',
        comment: income.comment || '',
        incomeDate: incomeDate,
      });
      
      // If editing, fetch services for the site of this income's service
      if (income.service?.site?.id) {
        setSelectedSiteId(income.service.site.id);
        fetchServices(income.service.site.id).then((loadedServices) => {
          // Set selected service after services are loaded
          const service = loadedServices.find((s: Service) => s.id === income.serviceId);
          if (service) {
            setSelectedService(service);
          }
        });
      }
    } else {
      setFormData({
        amount: '',
        serviceId: '',
        legalEntityId: '',
        comment: '',
        incomeDate: new Date().toISOString().slice(0, 16),
      });
    }
  }, [income]);

  const fetchSites = async () => {
    const res = await fetch('/api/sites/available');
    const data = await res.json();
    setSites(data.sites || []);
  };

  const fetchServices = async (siteId?: string) => {
    if (!siteId) {
      setServices([]);
      return [];
    }
    const res = await fetch(`/api/services?siteId=${siteId}&status=ACTIVE`);
    const data = await res.json();
    setServices(data.services || []);
    return data.services || [];
  };

  const fetchLegalEntities = async () => {
    const res = await fetch('/api/legal-entities');
    const data = await res.json();
    setLegalEntities((data.legalEntities || []).filter((le: LegalEntity) => le.isActive !== false));
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
    setFormData({ ...formData, serviceId });
  };

  const handleSiteChange = async (siteId: string) => {
    setSelectedSiteId(siteId);
    await fetchServices(siteId);
    setFormData({ ...formData, serviceId: '' });
    setSelectedService(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.serviceId) {
      setError('Необходимо выбрать услугу');
      return;
    }

    setLoading(true);

    try {
      const url = income ? `/api/incomes/${income.id}` : '/api/incomes';
      const method = income ? 'PUT' : 'POST';

      const payload: any = {
        amount: formData.amount,
        serviceId: formData.serviceId,
        legalEntityId: formData.legalEntityId || null,
        comment: formData.comment || null,
      };

      // Only include incomeDate if user can edit it (OWNER/CEO)
      if (user && (user.roleCode === 'OWNER' || user.roleCode === 'CEO')) {
        payload.incomeDate = formData.incomeDate || undefined;
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
          {income ? 'Редактировать доход' : 'Добавить доход'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {income && income.service && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Клиент
                </label>
                <input
                  type="text"
                  value={income.service.site.client.name}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Сайт
                </label>
                <input
                  type="text"
                  value={income.service.site.title}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
            </>
          )}

          {!income && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Сайт *
                </label>
                <select
                  required
                  value={selectedSiteId}
                  onChange={(e) => handleSiteChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Выберите сайт</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.title} ({site.client.name})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Услуга *
            </label>
            <select
              required
              value={formData.serviceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              disabled={!selectedSiteId && !income}
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
            >
              <option value="">Выберите услугу</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.product.name} - {service.site.title}
                </option>
              ))}
            </select>
            {selectedService && (
              <div className="mt-1 text-sm text-gray-500">
                Продукт: {selectedService.product.name}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Сумма (руб.) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-lg"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Юрлицо
            </label>
            <select
              value={formData.legalEntityId}
              onChange={(e) => setFormData({ ...formData, legalEntityId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Выберите юрлицо</option>
              {legalEntities.map((le) => (
                <option key={le.id} value={le.id}>
                  {le.name}
                </option>
              ))}
            </select>
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

          {user && (user.roleCode === 'OWNER' || user.roleCode === 'CEO') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата дохода
              </label>
              <input
                type="datetime-local"
                value={formData.incomeDate}
                onChange={(e) => setFormData({ ...formData, incomeDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          )}

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
