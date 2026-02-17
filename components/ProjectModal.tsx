'use client';

import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  expenseItems: Array<{
    id: string;
    expenseItemTemplateId: string;
    template: { id: string; name: string };
    valueType: string;
    defaultValue: number;
    description: string | null;
  }>;
  commissions: Array<{
    id: string;
    role: string;
    standardPercent: number;
    partnerPercent: number;
  }>;
  accountManagerFees: Array<{
    id: string;
    conditionField: string | null;
    conditionMin: number | null;
    conditionMax: number | null;
    feeAmount: string;
    description: string | null;
  }>;
}

interface ClientOption {
  id: string;
  name: string;
}

interface SiteOption {
  id: string;
  title: string;
  websiteUrl: string | null;
  clientId: string;
}

interface EditProject {
  id: string;
  productId: string;
  siteId: string;
  status: string;
  startDate: string;
  billingType: string;
  prepaymentType: string;
  price: string | null;
  autoRenew: boolean;
  isFromPartner: boolean;
  sellerCommissionPercent: number | null;
  accountManagerCommissionPercent: number | null;
  accountManagerFeeAmount: string | null;
  comment: string | null;
  responsibleUserId: string | null;
  site: {
    id: string;
    title: string;
    clientId: string;
    client: {
      id: string;
      name: string;
      accountManagerId: string | null;
      sellerEmployeeId: string | null;
      agentId: string | null;
    };
  };
  product: { id: string; name: string };
  expenseItems: Array<{
    id: string;
    name: string;
    valueType: string;
    value: number;
    calculatedAmount: string | null;
    template: { id: string; name: string } | null;
  }>;
}

interface User {
  id: string;
  fullName: string;
  roleCode: string;
}

export default function ProjectModal({
  project,
  onClose,
  onSuccess,
  user,
}: {
  project: EditProject | null;
  onClose: () => void;
  onSuccess: () => void;
  user: User | null;
}) {
  const [step, setStep] = useState<'main' | 'newClient' | 'newSite'>('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; fullName: string }>>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [siteSearch, setSiteSearch] = useState('');

  const [formData, setFormData] = useState({
    clientId: '',
    siteId: '',
    productId: '',
    status: 'ACTIVE',
    startDate: new Date().toISOString().split('T')[0],
    billingType: 'MONTHLY',
    prepaymentType: 'POSTPAY',
    price: '',
    autoRenew: false,
    isFromPartner: false,
    responsibleUserId: '',
    comment: '',
  });

  const [newClientName, setNewClientName] = useState('');
  const [newSiteTitle, setNewSiteTitle] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');

  useEffect(() => {
    fetchClients();
    fetchProducts();
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (formData.clientId) {
      fetchSites(formData.clientId);
    } else {
      setSites([]);
    }
  }, [formData.clientId]);

  useEffect(() => {
    if (project) {
      setFormData({
        clientId: project.site.clientId,
        siteId: project.siteId || project.site.id,
        productId: project.productId,
        status: project.status,
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        billingType: project.billingType,
        prepaymentType: project.prepaymentType || 'POSTPAY',
        price: project.price ? (Number(project.price) / 100).toString() : '',
        autoRenew: project.autoRenew,
        isFromPartner: project.isFromPartner,
        responsibleUserId: project.responsibleUserId || '',
        comment: project.comment || '',
      });
    }
  }, [project]);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients?limit=500');
      const data = await res.json();
      setClients(data.clients || []);
    } catch { /* ignore */ }
  };

  const fetchSites = async (clientId: string) => {
    try {
      const res = await fetch(`/api/sites/available?clientId=${clientId}`);
      const data = await res.json();
      setSites(data.sites || []);
    } catch { /* ignore */ }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data.products || []);
    } catch { /* ignore */ }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/users/with-departments');
      const data = await res.json();
      setEmployees(data.users || []);
    } catch { /* ignore */ }
  };

  const selectedProduct = products.find((p) => p.id === formData.productId);

  const getCommission = (role: string) => {
    if (!selectedProduct) return null;
    const comm = selectedProduct.commissions.find((c) => c.role === role);
    if (!comm) return null;
    return formData.isFromPartner ? comm.partnerPercent : comm.standardPercent;
  };

  const sellerPercent = getCommission('SELLER');
  const amPercent = getCommission('ACCOUNT_MANAGER');

  const getAMFee = () => {
    if (!selectedProduct || !formData.price) return null;
    const priceKopecks = parseFloat(formData.price) * 100;
    for (const fee of selectedProduct.accountManagerFees) {
      const min = fee.conditionMin != null ? fee.conditionMin * 100 : -Infinity;
      const max = fee.conditionMax != null ? fee.conditionMax * 100 : Infinity;
      if (priceKopecks >= min && priceKopecks <= max) {
        return Number(fee.feeAmount) / 100;
      }
    }
    if (selectedProduct.accountManagerFees.length > 0) {
      return Number(selectedProduct.accountManagerFees[0].feeAmount) / 100;
    }
    return null;
  };

  const amFee = getAMFee();

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      setError('Введите имя клиента');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка создания клиента');
        return;
      }
      await fetchClients();
      setFormData((prev) => ({ ...prev, clientId: data.client.id }));
      setNewClientName('');
      setStep('main');
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSite = async () => {
    if (!newSiteTitle.trim()) {
      setError('Введите название сайта');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSiteTitle.trim(),
          websiteUrl: newSiteUrl.trim() || null,
          clientId: formData.clientId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка создания сайта');
        return;
      }
      await fetchSites(formData.clientId);
      setFormData((prev) => ({ ...prev, siteId: data.site.id }));
      setNewSiteTitle('');
      setNewSiteUrl('');
      setStep('main');
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.siteId || !formData.productId) {
      setError('Выберите сайт и продукт');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        siteId: formData.siteId,
        productId: formData.productId,
        status: formData.status,
        startDate: formData.startDate,
        billingType: formData.billingType,
        prepaymentType: formData.prepaymentType,
        price: formData.price || null,
        autoRenew: formData.autoRenew,
        isFromPartner: formData.isFromPartner,
        responsibleUserId: formData.responsibleUserId || null,
        comment: formData.comment || null,
      };

      if (sellerPercent != null) payload.sellerCommissionPercent = sellerPercent;
      if (amPercent != null) payload.accountManagerCommissionPercent = amPercent;
      if (amFee != null) payload.accountManagerFeeAmount = Math.round(amFee * 100);

      const url = project ? `/api/services/${project.id}` : '/api/services';
      const method = project ? 'PUT' : 'POST';

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
    } catch {
      setError('Ошибка соединения');
      setLoading(false);
    }
  };

  const filteredClients = clients.filter((c) =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredSites = sites.filter((s) =>
    !siteSearch || s.title.toLowerCase().includes(siteSearch.toLowerCase())
  );

  const isReadOnlyCommission = user && user.roleCode !== 'OWNER' && user.roleCode !== 'CEO';

  if (step === 'newClient') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-bold mb-4">Новый клиент</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Название клиента"
                autoFocus
              />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setStep('main'); setError(''); }} className="px-4 py-2 border rounded-md hover:bg-gray-50">Назад</button>
              <button type="button" onClick={handleCreateClient} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'newSite') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-bold mb-4">Новый сайт</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
              <input
                type="text"
                value={newSiteTitle}
                onChange={(e) => setNewSiteTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Название сайта"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                type="text"
                value={newSiteUrl}
                onChange={(e) => setNewSiteUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://example.com"
              />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setStep('main'); setError(''); }} className="px-4 py-2 border rounded-md hover:bg-gray-50">Назад</button>
              <button type="button" onClick={handleCreateSite} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {project ? 'Редактировать проект' : 'Добавить проект'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Клиент
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Поиск клиента..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-1"
                />
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value, siteId: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  size={Math.min(filteredClients.length + 1, 5)}
                >
                  <option value="">Не выбран</option>
                  {filteredClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setStep('newClient')}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm whitespace-nowrap h-fit"
              >
                + Новый
              </button>
            </div>
          </div>

          {/* Site Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Сайт *
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                {formData.clientId ? (
                  <>
                    <input
                      type="text"
                      value={siteSearch}
                      onChange={(e) => setSiteSearch(e.target.value)}
                      placeholder="Поиск сайта..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-1"
                    />
                    <select
                      value={formData.siteId}
                      onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      size={Math.min(filteredSites.length + 1, 5)}
                    >
                      <option value="">Выберите сайт</option>
                      {filteredSites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} {s.websiteUrl ? `(${s.websiteUrl})` : ''}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 py-2">Сначала выберите клиента</p>
                )}
              </div>
              {formData.clientId && (
                <button
                  type="button"
                  onClick={() => setStep('newSite')}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm whitespace-nowrap h-fit"
                >
                  + Новый
                </button>
              )}
            </div>
          </div>

          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Продукт (Услуга) *
            </label>
            <select
              required
              value={formData.productId}
              onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Выберите продукт</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Цена (руб.)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала *</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Billing & Status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип оплаты</label>
              <select
                value={formData.billingType}
                onChange={(e) => setFormData({ ...formData, billingType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="MONTHLY">Ежемесячная</option>
                <option value="ONE_TIME">Разовая</option>
                <option value="QUARTERLY">Ежеквартальная</option>
                <option value="YEARLY">Ежегодная</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Предоплата</label>
              <select
                value={formData.prepaymentType}
                onChange={(e) => setFormData({ ...formData, prepaymentType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="POSTPAY">Постоплата</option>
                <option value="FULL_PREPAY">Полная предоплата</option>
                <option value="PARTIAL_PREPAY">Частичная предоплата</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="ACTIVE">Активна</option>
                <option value="PAUSED">Приостановлена</option>
                <option value="FINISHED">Завершена</option>
              </select>
            </div>
          </div>

          {/* Partner & AutoRenew */}
          <div className="flex gap-6 items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isFromPartner}
                onChange={(e) => setFormData({ ...formData, isFromPartner: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Лид от партнёра</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoRenew}
                onChange={(e) => setFormData({ ...formData, autoRenew: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Автопродление</span>
            </label>
          </div>

          {/* Responsible */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ответственный</label>
            <select
              value={formData.responsibleUserId}
              onChange={(e) => setFormData({ ...formData, responsibleUserId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Не выбран</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
              ))}
            </select>
          </div>

          {/* Commissions (auto-calculated, read-only for non-owners) */}
          {selectedProduct && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-3">Комиссии (рассчитываются автоматически)</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Продавец:</span>{' '}
                  <span className="font-medium">
                    {sellerPercent != null ? `${sellerPercent}%` : '—'}
                    {formData.isFromPartner && ' (партнёр)'}
                  </span>
                  {sellerPercent != null && formData.price && (
                    <span className="text-xs text-gray-500 ml-1">
                      ≈ {((parseFloat(formData.price) * sellerPercent) / 100).toFixed(0)} руб.
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-600">Аккаунт-менеджер:</span>{' '}
                  <span className="font-medium">
                    {amPercent != null ? `${amPercent}%` : '—'}
                    {formData.isFromPartner && ' (партнёр)'}
                  </span>
                  {amPercent != null && formData.price && (
                    <span className="text-xs text-gray-500 ml-1">
                      ≈ {((parseFloat(formData.price) * amPercent) / 100).toFixed(0)} руб.
                    </span>
                  )}
                </div>
                {amFee != null && (
                  <div className="col-span-2">
                    <span className="text-gray-600">Ведение АМ:</span>{' '}
                    <span className="font-medium">{amFee.toLocaleString('ru-RU')} руб.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expense Items from Product */}
          {selectedProduct && selectedProduct.expenseItems.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Статьи ожидаемых расходов</h3>
              <div className="space-y-2">
                {selectedProduct.expenseItems.map((item) => {
                  const priceVal = formData.price ? parseFloat(formData.price) : 0;
                  const calculated = item.valueType === 'PERCENT'
                    ? (priceVal * item.defaultValue / 100).toFixed(0)
                    : (item.defaultValue / 100).toFixed(0);
                  return (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">{item.template.name}</span>
                      <span className="text-gray-500">
                        {item.valueType === 'PERCENT' ? `${item.defaultValue}%` : `${(item.defaultValue / 100).toFixed(0)} руб.`}
                        {priceVal > 0 && ` ≈ ${Number(calculated).toLocaleString('ru-RU')} руб.`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
              placeholder="Комментарий (необязательно)"
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex justify-end gap-3">
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
