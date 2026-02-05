'use client';

import { useState, useEffect } from 'react';

interface Expense {
  id: string;
  amount: string;
  costItemId: string;
  employeeId: string | null;
  siteId: string | null;
  serviceId: string | null;
  paymentAt: Date | string;
  comment: string | null;
}

interface CostItem {
  id: string;
  title: string;
  sortOrder: number;
  costCategoryId: string;
  costCategory: { id: string; name: string; sortOrder: number };
}

interface Employee {
  id: string;
  fullName: string;
}

interface Site {
  id: string;
  title: string;
  client: {
    name: string;
  };
}

interface Service {
  id: string;
  product: {
    name: string;
  };
  site: {
    id: string;
    title: string;
  };
}

interface User {
  id: string;
  roleCode: string;
}

export default function ExpenseModal({
  expense,
  onClose,
  onSuccess,
  user,
}: {
  expense: Expense | null;
  onClose: () => void;
  onSuccess: () => void;
  user?: User | null;
}) {
  const [formData, setFormData] = useState({
    amount: '',
    costItemId: '',
    employeeId: '',
    siteId: '',
    serviceId: '',
    paymentAt: new Date().toISOString().slice(0, 16),
    comment: '',
  });
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCostItems();
    fetchEmployees();
    fetchSites();

    if (expense) {
      const paymentDate = expense.paymentAt
        ? new Date(expense.paymentAt).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16);
      setFormData({
        amount: (Number(expense.amount) / 100).toString(),
        costItemId: expense.costItemId,
        employeeId: expense.employeeId || '',
        siteId: expense.siteId || '',
        serviceId: expense.serviceId || '',
        paymentAt: paymentDate,
        comment: expense.comment || '',
      });
      
      // If editing and has siteId, fetch services for that site
      if (expense.siteId) {
        fetchServices(expense.siteId);
      }
    } else {
      setFormData({
        amount: '',
        costItemId: '',
        employeeId: '',
        siteId: '',
        serviceId: '',
        paymentAt: new Date().toISOString().slice(0, 16),
        comment: '',
      });
    }
  }, [expense]);

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

  const fetchServices = async (siteId: string) => {
    if (!siteId) {
      setServices([]);
      return;
    }
    const res = await fetch(`/api/services?siteId=${siteId}&status=ACTIVE`);
    const data = await res.json();
    setServices(data.services || []);
  };

  const handleSiteChange = async (siteId: string) => {
    setFormData({ ...formData, siteId, serviceId: '' });
    await fetchServices(siteId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = expense ? `/api/expenses/${expense.id}` : '/api/expenses';
      const method = expense ? 'PUT' : 'POST';

      const payload: any = {
        amount: formData.amount,
        costItemId: formData.costItemId,
        employeeId: formData.employeeId || null,
        siteId: formData.siteId || null,
        serviceId: formData.serviceId || null,
        paymentAt: formData.paymentAt,
        comment: formData.comment && formData.comment.trim() ? formData.comment.trim() : null,
      };

      // Only OWNER and CEO can change paymentAt date when editing
      if (expense && user && (user.roleCode === 'OWNER' || user.roleCode === 'CEO')) {
        payload.paymentAt = formData.paymentAt;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || 'Ошибка сохранения';
        const details = data.details ? `: ${data.details}` : '';
        setError(`${errorMsg}${details}`);
        setLoading(false);
        console.error('Error saving expense:', data);
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
          {expense ? 'Редактировать расход' : 'Добавить расход'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              Тип расхода *
            </label>
            <select
              required
              value={formData.costItemId}
              onChange={(e) => setFormData({ ...formData, costItemId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Выберите тип расхода</option>
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
                    items: items.slice().sort((a, b) => a.sortOrder - b.sortOrder),
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Сотрудник
            </label>
            <select
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Не выбран</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Сайт
            </label>
            <select
              value={formData.siteId}
              onChange={(e) => handleSiteChange(e.target.value)}
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
              value={formData.serviceId}
              onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
              disabled={!formData.siteId}
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
            >
              <option value="">Не выбрана</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.product.name} - {service.site.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Расход может быть общим (без привязки к услуге) или привязанным к конкретной услуге
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата платежа *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.paymentAt}
              onChange={(e) => setFormData({ ...formData, paymentAt: e.target.value })}
              disabled={!!(expense && user && user.roleCode !== 'OWNER' && user.roleCode !== 'CEO')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
            />
            {expense && user && user.roleCode !== 'OWNER' && user.roleCode !== 'CEO' && (
              <p className="mt-1 text-xs text-gray-500">
                Только OWNER и CEO могут изменять дату платежа
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Комментарий
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Введите комментарий (необязательно)"
              rows={3}
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
