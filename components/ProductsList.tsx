'use client';

import { useState, useEffect, useCallback } from 'react';

interface Department {
  id: string;
  name: string;
}

interface ExpenseItemTemplate {
  id: string;
  name: string;
  sortOrder: number;
  departmentId: string | null;
  department: Department | null;
}

interface ProductExpenseItem {
  id: string;
  expenseItemTemplateId: string;
  valueType: 'PERCENT' | 'FIXED';
  defaultValue: number;
  description: string | null;
  sortOrder: number;
  template: ExpenseItemTemplate;
}

interface ProductCommission {
  id: string;
  role: 'SELLER' | 'ACCOUNT_MANAGER';
  standardPercent: number;
  partnerPercent: number;
  calculationBase: string | null;
  description: string | null;
}

interface ProductAccountManagerFee {
  id: string;
  conditionField: string | null;
  conditionMin: number | null;
  conditionMax: number | null;
  feeAmount: string; // BigInt serialized as string
  description: string | null;
  sortOrder: number;
}

interface Product {
  id: string;
  name: string;
  sortOrder: number;
  expenseItems: ProductExpenseItem[];
  commissions: ProductCommission[];
  accountManagerFees: ProductAccountManagerFee[];
}

interface User {
  roleCode: string;
}

export default function ProductsList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [error, setError] = useState('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ExpenseItemTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExpenseItemTemplate | null>(null);
  const [templateFormName, setTemplateFormName] = useState('');
  const [templateFormDepartmentId, setTemplateFormDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsProduct, setSettingsProduct] = useState<Product | null>(null);
  const [settingsForm, setSettingsForm] = useState<{
    expenseItems: Array<{
      expenseItemTemplateId: string;
      valueType: 'PERCENT' | 'FIXED';
      defaultValue: number;
      description: string;
    }>;
    accountManagerFees: Array<{
      conditionField: string;
      conditionMin: string;
      conditionMax: string;
      feeAmount: string;
      description: string;
    }>;
  }>({
    expenseItems: [],
    accountManagerFees: [],
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [showGlobalCommissions, setShowGlobalCommissions] = useState(false);
  const [globalCommissions, setGlobalCommissions] = useState({
    sellerCommission: { standardPercent: 0, partnerPercent: 0, description: '' },
    amCommission: { standardPercent: 0, partnerPercent: 0, description: '' },
  });
  const [savingGlobalCommissions, setSavingGlobalCommissions] = useState(false);
  const [globalCommissionsError, setGlobalCommissionsError] = useState('');
  const [globalCommissionsSuccess, setGlobalCommissionsSuccess] = useState('');

  useEffect(() => {
    fetchUser();
    fetchProducts();
    fetchTemplates();
    fetchDepartments();
  }, []);

  // Initialize global commissions from the first product that has commissions
  useEffect(() => {
    const productWithComm = products.find((p) => p.commissions.length > 0);
    if (productWithComm) {
      const sellerComm = productWithComm.commissions.find((c) => c.role === 'SELLER');
      const amComm = productWithComm.commissions.find((c) => c.role === 'ACCOUNT_MANAGER');
      setGlobalCommissions({
        sellerCommission: {
          standardPercent: sellerComm?.standardPercent ?? 0,
          partnerPercent: sellerComm?.partnerPercent ?? 0,
          description: sellerComm?.description ?? '',
        },
        amCommission: {
          standardPercent: amComm?.standardPercent ?? 0,
          partnerPercent: amComm?.partnerPercent ?? 0,
          description: amComm?.description ?? '',
        },
      });
    }
  }, [products]);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) setUser(data.user);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (res.ok) setProducts(data.products || []);
      else setError(data.error || 'Ошибка загрузки продуктов');
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/expense-item-templates');
      const data = await res.json();
      if (res.ok) setTemplates(data.expenseItemTemplates || []);
    } catch { /* ignore */ }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (res.ok) setDepartments(data.departments || []);
    } catch { /* ignore */ }
  };

  const canManage = user && (user.roleCode === 'OWNER' || user.roleCode === 'CEO');

  const handleAdd = () => {
    setEditingProduct(null);
    setFormName('');
    setError('');
    setShowModal(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Удалить продукт "${product.name}"?`)) return;
    const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
    if (res.ok) fetchProducts();
    else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  const handleOpenSettings = (product: Product) => {
    setSettingsProduct(product);

    setSettingsForm({
      expenseItems: product.expenseItems.map((ei) => ({
        expenseItemTemplateId: ei.expenseItemTemplateId,
        valueType: ei.valueType,
        defaultValue: ei.defaultValue,
        description: ei.description || '',
      })),
      accountManagerFees: product.accountManagerFees.map((f) => ({
        conditionField: f.conditionField || '',
        conditionMin: f.conditionMin != null ? String(f.conditionMin) : '',
        conditionMax: f.conditionMax != null ? String(f.conditionMax) : '',
        feeAmount: String(Number(f.feeAmount) / 100),
        description: f.description || '',
      })),
    });
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    if (!settingsProduct) return;
    setSavingSettings(true);
    setError('');

    try {
      const payload = {
        name: settingsProduct.name,
        expenseItems: settingsForm.expenseItems.map((ei, idx) => ({
          expenseItemTemplateId: ei.expenseItemTemplateId,
          valueType: ei.valueType,
          defaultValue: ei.defaultValue,
          description: ei.description || null,
          sortOrder: idx,
        })),
        accountManagerFees: settingsForm.accountManagerFees.map((f, idx) => ({
          conditionField: f.conditionField || null,
          conditionMin: f.conditionMin ? parseFloat(f.conditionMin) : null,
          conditionMax: f.conditionMax ? parseFloat(f.conditionMax) : null,
          feeAmount: Math.round(parseFloat(f.feeAmount) * 100) || 0,
          description: f.description || null,
          sortOrder: idx,
        })),
      };

      const res = await fetch(`/api/products/${settingsProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка сохранения');
        setSavingSettings(false);
        return;
      }

      setShowSettingsModal(false);
      fetchProducts();
    } catch {
      setError('Ошибка соединения');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveGlobalCommissions = async () => {
    setSavingGlobalCommissions(true);
    setGlobalCommissionsError('');
    setGlobalCommissionsSuccess('');

    try {
      const res = await fetch('/api/products/global-commissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalCommissions),
      });

      const data = await res.json();
      if (!res.ok) {
        setGlobalCommissionsError(data.error || 'Ошибка сохранения');
        return;
      }

      setGlobalCommissionsSuccess('Комиссии сохранены для всех продуктов');
      fetchProducts();
      setTimeout(() => setGlobalCommissionsSuccess(''), 3000);
    } catch {
      setGlobalCommissionsError('Ошибка соединения');
    } finally {
      setSavingGlobalCommissions(false);
    }
  };

  // Expense item management in settings
  const addExpenseItem = () => {
    if (templates.length === 0) return;
    const usedIds = settingsForm.expenseItems.map((ei) => ei.expenseItemTemplateId);
    const available = templates.filter((t) => !usedIds.includes(t.id));
    if (available.length === 0) return;
    setSettingsForm((prev) => ({
      ...prev,
      expenseItems: [
        ...prev.expenseItems,
        {
          expenseItemTemplateId: available[0].id,
          valueType: 'PERCENT',
          defaultValue: 0,
          description: '',
        },
      ],
    }));
  };

  const removeExpenseItem = (idx: number) => {
    setSettingsForm((prev) => ({
      ...prev,
      expenseItems: prev.expenseItems.filter((_, i) => i !== idx),
    }));
  };

  const updateExpenseItem = (idx: number, field: string, value: any) => {
    setSettingsForm((prev) => ({
      ...prev,
      expenseItems: prev.expenseItems.map((ei, i) => (i === idx ? { ...ei, [field]: value } : ei)),
    }));
  };

  // AM fee management
  const addAMFee = () => {
    setSettingsForm((prev) => ({
      ...prev,
      accountManagerFees: [
        ...prev.accountManagerFees,
        { conditionField: '', conditionMin: '', conditionMax: '', feeAmount: '', description: '' },
      ],
    }));
  };

  const removeAMFee = (idx: number) => {
    setSettingsForm((prev) => ({
      ...prev,
      accountManagerFees: prev.accountManagerFees.filter((_, i) => i !== idx),
    }));
  };

  const updateAMFee = (idx: number, field: string, value: string) => {
    setSettingsForm((prev) => ({
      ...prev,
      accountManagerFees: prev.accountManagerFees.map((f, i) => (i === idx ? { ...f, [field]: value } : f)),
    }));
  };

  // Template management
  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setTemplateFormName('');
    setTemplateFormDepartmentId('');
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (template: ExpenseItemTemplate) => {
    setEditingTemplate(template);
    setTemplateFormName(template.name);
    setTemplateFormDepartmentId(template.departmentId || '');
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (template: ExpenseItemTemplate) => {
    if (!confirm(`Удалить статью "${template.name}"?`)) return;
    const res = await fetch(`/api/expense-item-templates/${template.id}`, { method: 'DELETE' });
    if (res.ok) fetchTemplates();
    else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  const handleSubmitTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingTemplate ? `/api/expense-item-templates/${editingTemplate.id}` : '/api/expense-item-templates';
    const method = editingTemplate ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: templateFormName, departmentId: templateFormDepartmentId || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Ошибка');
      return;
    }
    setShowTemplateModal(false);
    fetchTemplates();
  };

  // Drag-drop for products
  const handleDragStart = (e: React.DragEvent, productId: string) => {
    if (!canManage) return;
    setDraggedItem(productId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canManage || !draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget as HTMLElement;
    if (target.dataset.productId !== draggedItem) target.classList.add('bg-blue-50');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('bg-blue-50');
  };

  const handleDrop = async (e: React.DragEvent, targetProductId: string) => {
    if (!canManage || !draggedItem) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('bg-blue-50');
    if (draggedItem === targetProductId) { setDraggedItem(null); return; }
    const draggedIndex = products.findIndex((p) => p.id === draggedItem);
    const targetIndex = products.findIndex((p) => p.id === targetProductId);
    if (draggedIndex === -1 || targetIndex === -1) { setDraggedItem(null); return; }
    const newProducts = [...products];
    const [removed] = newProducts.splice(draggedIndex, 1);
    newProducts.splice(targetIndex, 0, removed);
    setProducts(newProducts);
    setDraggedItem(null);
    const res = await fetch('/api/products/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: newProducts.map((p) => p.id) }),
    });
    if (!res.ok) {
      fetchProducts();
      const data = await res.json();
      alert(data.error || 'Ошибка сохранения порядка');
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    document.querySelectorAll('tbody tr').forEach((row) => row.classList.remove('bg-blue-50'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    const method = editingProduct ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formName }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Ошибка сохранения'); return; }
    setShowModal(false);
    setEditingProduct(null);
    setFormName('');
    fetchProducts();
  };

  const getTemplateName = (id: string) => templates.find((t) => t.id === id)?.name || 'Неизвестно';

  if (loading) return <div className="text-center py-8">Загрузка...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Статьи услуг</h1>
          {canManage && (
            <p className="text-sm text-gray-500 mt-1">Перетащите продукты для изменения порядка</p>
          )}
        </div>
        {canManage && (
          <div className="flex gap-3">
            <button
              onClick={handleAddTemplate}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
            >
              Справочник расходов
            </button>
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
            >
              + Добавить продукт
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => { setError(''); fetchProducts(); }} className="ml-4 text-red-800 underline">
            Повторить
          </button>
        </div>
      )}

      {/* Templates list (collapsible) */}
      {canManage && templates.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700">Справочник «Статьи ожидаемых расходов»</h2>
            <button onClick={handleAddTemplate} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              + Добавить
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <div key={t.id} className="bg-white border rounded-md px-3 py-1.5 text-sm flex items-center gap-2">
                <span>{t.name}</span>
                {t.department && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.department.name}</span>
                )}
                <button onClick={() => handleEditTemplate(t)} className="text-blue-500 hover:text-blue-700 text-xs">
                  ✎
                </button>
                <button onClick={() => handleDeleteTemplate(t)} className="text-red-500 hover:text-red-700 text-xs">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Commissions (collapsible) */}
      {canManage && (
        <div className="bg-white rounded-lg shadow mb-6">
          <button
            onClick={() => setShowGlobalCommissions(!showGlobalCommissions)}
            className="w-full flex justify-between items-center px-6 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-lg font-semibold">Глобальные комиссии с продажи</h2>
            <span className="text-gray-400 text-xl">{showGlobalCommissions ? '▲' : '▼'}</span>
          </button>
          {showGlobalCommissions && (
            <div className="px-6 pb-6">
              <p className="text-sm text-gray-500 mb-4">
                Эти комиссии применяются ко всем продуктам одновременно.
              </p>
              <div className="grid grid-cols-2 gap-6">
                {/* Seller */}
                <div>
                  <h4 className="font-medium mb-2">Продавец</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500">Обычный случай, %</label>
                      <input type="number" step="0.01"
                        value={globalCommissions.sellerCommission.standardPercent}
                        onChange={(e) => setGlobalCommissions((prev) => ({
                          ...prev, sellerCommission: { ...prev.sellerCommission, standardPercent: parseFloat(e.target.value) || 0 },
                        }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Лид от партнёра, %</label>
                      <input type="number" step="0.01"
                        value={globalCommissions.sellerCommission.partnerPercent}
                        onChange={(e) => setGlobalCommissions((prev) => ({
                          ...prev, sellerCommission: { ...prev.sellerCommission, partnerPercent: parseFloat(e.target.value) || 0 },
                        }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Описание формулы</label>
                      <textarea
                        value={globalCommissions.sellerCommission.description}
                        onChange={(e) => setGlobalCommissions((prev) => ({
                          ...prev, sellerCommission: { ...prev.sellerCommission, description: e.target.value },
                        }))}
                        rows={2} placeholder="(Продажа - себес(Подрядчик+АМ+Налог)) * 23%"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                    </div>
                  </div>
                </div>
                {/* Account Manager */}
                <div>
                  <h4 className="font-medium mb-2">Аккаунт-менеджер</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500">Обычный случай, %</label>
                      <input type="number" step="0.01"
                        value={globalCommissions.amCommission.standardPercent}
                        onChange={(e) => setGlobalCommissions((prev) => ({
                          ...prev, amCommission: { ...prev.amCommission, standardPercent: parseFloat(e.target.value) || 0 },
                        }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Лид от партнёра, %</label>
                      <input type="number" step="0.01"
                        value={globalCommissions.amCommission.partnerPercent}
                        onChange={(e) => setGlobalCommissions((prev) => ({
                          ...prev, amCommission: { ...prev.amCommission, partnerPercent: parseFloat(e.target.value) || 0 },
                        }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Описание формулы</label>
                      <textarea
                        value={globalCommissions.amCommission.description}
                        onChange={(e) => setGlobalCommissions((prev) => ({
                          ...prev, amCommission: { ...prev.amCommission, description: e.target.value },
                        }))}
                        rows={2}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                    </div>
                  </div>
                </div>
              </div>

              {globalCommissionsError && (
                <div className="text-red-600 text-sm mt-4">{globalCommissionsError}</div>
              )}
              {globalCommissionsSuccess && (
                <div className="text-green-600 text-sm mt-4">{globalCommissionsSuccess}</div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveGlobalCommissions}
                  disabled={savingGlobalCommissions}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {savingGlobalCommissions ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Products table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статьи расходов</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Комиссии</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ведение АМ</th>
                {canManage && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr
                  key={product.id}
                  draggable={!!canManage}
                  onDragStart={(e) => handleDragStart(e, product.id)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, product.id)}
                  onDragEnd={handleDragEnd}
                  data-product-id={product.id}
                  className={`hover:bg-gray-50 transition-colors ${draggedItem === product.id ? 'opacity-50 bg-gray-200' : ''} ${canManage ? 'cursor-move' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {canManage && <span className="inline-block mr-2 text-gray-400 cursor-move">⋮⋮</span>}
                    {product.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {product.expenseItems.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {product.expenseItems.map((ei) => (
                          <span key={ei.id} className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                            {ei.template?.name}: {ei.valueType === 'PERCENT' ? `${ei.defaultValue}%` : `${ei.defaultValue} руб.`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">Не настроены</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {product.commissions.length > 0 ? (
                      <div className="space-y-0.5">
                        {product.commissions.map((c) => (
                          <div key={c.id} className="text-xs">
                            <span className="font-medium">{c.role === 'SELLER' ? 'Продавец' : 'АМ'}:</span>{' '}
                            {c.standardPercent}% / {c.partnerPercent}% (партнёр)
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">Не настроены</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {product.accountManagerFees.length > 0 ? (
                      <div className="space-y-0.5">
                        {product.accountManagerFees.map((f) => (
                          <div key={f.id} className="text-xs">
                            {f.description || `${Number(f.feeAmount) / 100} руб.`}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">Не настроены</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onClick={() => handleOpenSettings(product)} className="text-green-600 hover:text-green-900 mr-3">
                        Настроить
                      </button>
                      <button onClick={() => handleEdit(product)} className="text-blue-600 hover:text-blue-900 mr-3">
                        Имя
                      </button>
                      <button onClick={() => handleDelete(product)} className="text-red-600 hover:text-red-900">
                        Удалить
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 && !loading && !error && (
          <div className="text-center py-8 text-gray-500">
            Статьи услуг не найдены
            <button onClick={fetchProducts} className="ml-4 text-blue-600 underline">Обновить</button>
          </div>
        )}
      </div>

      {/* Add/Edit Product Name Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {editingProduct ? 'Редактировать продукт' : 'Добавить продукт'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md" autoFocus />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex justify-end space-x-4">
                <button type="button" onClick={() => { setShowModal(false); setError(''); }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Отмена</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingTemplate ? 'Редактировать статью расходов' : 'Добавить статью расходов'}
            </h2>
            <form onSubmit={handleSubmitTemplate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                <input type="text" required value={templateFormName} onChange={(e) => setTemplateFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Отдел (для назначения ответственных)</label>
                <select
                  value={templateFormDepartmentId}
                  onChange={(e) => setTemplateFormDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Не привязан</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  При создании проекта будет предложено назначить ответственного из этого отдела
                </p>
              </div>
              <div className="flex justify-end space-x-4">
                <button type="button" onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Отмена</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Settings Modal */}
      {showSettingsModal && settingsProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-1">Настройки: {settingsProduct.name}</h2>
            <p className="text-sm text-gray-500 mb-6">Настройка статей расходов и ведения проекта</p>

            {/* Expense Items */}
            <div className="border rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Статьи ожидаемых расходов</h3>
                <button onClick={addExpenseItem} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  + Добавить статью
                </button>
              </div>
              {settingsForm.expenseItems.length === 0 && (
                <p className="text-gray-400 text-sm">Нет статей расходов. Добавьте из справочника.</p>
              )}
              <div className="space-y-3">
                {settingsForm.expenseItems.map((ei, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-gray-50 p-3 rounded">
                    <select
                      value={ei.expenseItemTemplateId}
                      onChange={(e) => updateExpenseItem(idx, 'expenseItemTemplateId', e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <select
                      value={ei.valueType}
                      onChange={(e) => updateExpenseItem(idx, 'valueType', e.target.value)}
                      className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm"
                    >
                      <option value="PERCENT">Процент %</option>
                      <option value="FIXED">Фикс (руб)</option>
                    </select>
                    <input
                      type="number" step="0.01"
                      value={ei.defaultValue}
                      onChange={(e) => updateExpenseItem(idx, 'defaultValue', parseFloat(e.target.value) || 0)}
                      placeholder={ei.valueType === 'PERCENT' ? '6' : '5000'}
                      className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-xs text-gray-500">{ei.valueType === 'PERCENT' ? '%' : 'руб'}</span>
                    <input
                      type="text"
                      value={ei.description}
                      onChange={(e) => updateExpenseItem(idx, 'description', e.target.value)}
                      placeholder="Описание"
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                    <button onClick={() => removeExpenseItem(idx)} className="text-red-500 hover:text-red-700">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* AM Fees */}
            <div className="border rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Ставки ведения проекта (АМ)</h3>
                <button onClick={addAMFee} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  + Добавить условие
                </button>
              </div>
              {settingsForm.accountManagerFees.length === 0 && (
                <p className="text-gray-400 text-sm">Нет условий ведения. Добавьте условия для расчёта оплаты АМ.</p>
              )}
              <div className="space-y-3">
                {settingsForm.accountManagerFees.map((f, idx) => (
                  <div key={idx} className="bg-gray-50 p-3 rounded space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Поле условия</label>
                        <input type="text" value={f.conditionField}
                          onChange={(e) => updateAMFee(idx, 'conditionField', e.target.value)}
                          placeholder="keyCount, price, etc."
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div className="w-24">
                        <label className="text-xs text-gray-500">От</label>
                        <input type="number" value={f.conditionMin}
                          onChange={(e) => updateAMFee(idx, 'conditionMin', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div className="w-24">
                        <label className="text-xs text-gray-500">До</label>
                        <input type="number" value={f.conditionMax}
                          onChange={(e) => updateAMFee(idx, 'conditionMax', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div className="w-32">
                        <label className="text-xs text-gray-500">Сумма (руб)</label>
                        <input type="number" step="0.01" value={f.feeAmount}
                          onChange={(e) => updateAMFee(idx, 'feeAmount', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <button onClick={() => removeAMFee(idx)} className="text-red-500 hover:text-red-700 mt-4">✕</button>
                    </div>
                    <input type="text" value={f.description}
                      onChange={(e) => updateAMFee(idx, 'description', e.target.value)}
                      placeholder="Описание условия (напр: От 10 до 30 ключей – 2000р)"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                  </div>
                ))}
              </div>
            </div>

            {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

            <div className="flex justify-end space-x-4">
              <button onClick={() => { setShowSettingsModal(false); setError(''); }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Отмена</button>
              <button onClick={handleSaveSettings} disabled={savingSettings}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {savingSettings ? 'Сохранение...' : 'Сохранить настройки'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
