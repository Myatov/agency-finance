'use client';

import { useState, useEffect } from 'react';

interface ExpectedPeriodOption {
  dateFrom: string;
  dateTo: string;
  workPeriodId: string | null;
}

interface Income {
  id: string;
  amount: string;
  serviceId: string;
  workPeriodId?: string | null;
  workPeriod?: WorkPeriodOption | null;
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
    workPeriodId: '',
    legalEntityId: '',
    comment: '',
    incomeDate: '',
  });
  const [services, setServices] = useState<Service[]>([]);
  const [expectedPeriods, setExpectedPeriods] = useState<ExpectedPeriodOption[]>([]);
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
        workPeriodId: income.workPeriodId || '',
        legalEntityId: income.legalEntityId || '',
        comment: income.comment || '',
        incomeDate: incomeDate,
      });
      
      // If editing, fetch services and work periods for this income's service
      if (income.service?.site?.id) {
        setSelectedSiteId(income.service.site.id);
        fetchServices(income.service.site.id).then((loadedServices) => {
          const service = loadedServices.find((s: Service) => s.id === income.serviceId);
          if (service) setSelectedService(service);
        });
        fetchExpectedPeriods(income.serviceId);
      }
    } else {
      setFormData({
        amount: '',
        serviceId: '',
        workPeriodId: '',
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

  const fetchExpectedPeriods = async (serviceId: string) => {
    if (!serviceId) {
      setExpectedPeriods([]);
      return [];
    }
    const res = await fetch(`/api/services/${serviceId}/expected-periods`);
    const data = await res.json();
    const list = (data.periods || []).map((p: any) => ({
      dateFrom: p.dateFrom?.slice(0, 10) || '',
      dateTo: p.dateTo?.slice(0, 10) || '',
      workPeriodId: p.workPeriodId || null,
    }));
    setExpectedPeriods(list);
    return list;
  };

  const handleServiceChange = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
    const periods = await fetchExpectedPeriods(serviceId);
    const incomeDateStr = formData.incomeDate ? formData.incomeDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
    let suggestedId = '';
    let suggestedVirtual: ExpectedPeriodOption | null = null;
    for (const p of periods) {
      if (incomeDateStr >= p.dateFrom && incomeDateStr <= p.dateTo) {
        if (p.workPeriodId) suggestedId = p.workPeriodId;
        else suggestedVirtual = p;
        break;
      }
    }
    if (!suggestedId && periods.length > 0 && !suggestedVirtual) {
      const withId = periods.filter((p: ExpectedPeriodOption) => p.workPeriodId);
      const sorted = [...withId].sort((a, b) => (b.dateTo || '').localeCompare(a.dateTo || ''));
      if (sorted.length > 0) suggestedId = sorted[0].workPeriodId!;
      else suggestedVirtual = periods[periods.length - 1] || null;
    }
    if (suggestedVirtual && !suggestedId) {
      const res = await fetch('/api/work-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, dateFrom: suggestedVirtual.dateFrom, dateTo: suggestedVirtual.dateTo }),
      });
      const data = await res.json();
      if (res.ok && data.workPeriod?.id) suggestedId = data.workPeriod.id;
      fetchExpectedPeriods(serviceId);
    }
    setFormData({ ...formData, serviceId, workPeriodId: suggestedId });
  };

  const handleSiteChange = async (siteId: string) => {
    setSelectedSiteId(siteId);
    await fetchServices(siteId);
    setExpectedPeriods([]);
    setFormData({ ...formData, serviceId: '', workPeriodId: '' });
    setSelectedService(null);
  };

  const handlePeriodChange = async (value: string) => {
    if (!value) {
      setFormData({ ...formData, workPeriodId: '' });
      return;
    }
    if (value.startsWith('virtual:')) {
      const [, dateFrom, dateTo] = value.split(':');
      if (!formData.serviceId || !dateFrom || !dateTo) return;
      const res = await fetch('/api/work-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: formData.serviceId, dateFrom, dateTo }),
      });
      const data = await res.json();
      if (res.ok && data.workPeriod?.id) {
        setFormData({ ...formData, workPeriodId: data.workPeriod.id });
        fetchExpectedPeriods(formData.serviceId);
      }
      return;
    }
    setFormData({ ...formData, workPeriodId: value });
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
        workPeriodId: formData.workPeriodId || null,
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
              Период работ
            </label>
            <select
              value={formData.workPeriodId || ''}
              onChange={(e) => handlePeriodChange(e.target.value)}
              disabled={!formData.serviceId}
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
            >
              <option value="">— Не привязан</option>
              {expectedPeriods.map((p) => {
                const val = p.workPeriodId || `virtual:${p.dateFrom}:${p.dateTo}`;
                return (
                  <option key={val} value={val}>
                    {p.dateFrom} — {p.dateTo}
                    {p.workPeriodId ? '' : ' (создать)'}
                  </option>
                );
              })}
            </select>
            {formData.serviceId && expectedPeriods.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">Периоды считаются от даты старта услуги и типа биллинга</p>
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
