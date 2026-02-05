'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CostCategory {
  id: string;
  name: string;
  sortOrder: number;
}

interface FinancialModelExpenseType {
  id: string;
  name: string;
  sortOrder: number;
}

interface CostItem {
  id: string;
  costCategoryId: string;
  title: string;
  sortOrder: number;
  financialModelExpenseTypeId: string;
  costCategory: CostCategory;
  financialModelExpenseType: FinancialModelExpenseType;
}

export default function CostItemsList() {
  const [items, setItems] = useState<CostItem[]>([]);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [financialModelTypes, setFinancialModelTypes] = useState<FinancialModelExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CostItem | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formFinancialModelTypeId, setFormFinancialModelTypeId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [error, setError] = useState('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const fetchCanManage = async () => {
    try {
      const res = await fetch('/api/permissions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'expenses', permission: 'manage' }),
      });
      if (res.ok) {
        const data = await res.json();
        setCanManage(!!data.hasPermission);
      }
    } catch {
      setCanManage(false);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const [itemsRes, catRes, typesRes] = await Promise.all([
        fetch('/api/cost-items'),
        fetch('/api/cost-categories'),
        fetch('/api/financial-model-expense-types'),
      ]);
      const itemsData = await itemsRes.json();
      const catData = await catRes.json();
      const typesData = await typesRes.json();
      if (itemsRes.ok) setItems(itemsData.costItems || []);
      else setError(itemsData.error || 'Ошибка загрузки');
      if (catRes.ok) setCategories(catData.categories || []);
      if (typesRes.ok) setFinancialModelTypes(typesData.types || []);
    } catch (err) {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCanManage();
    fetchItems();
  }, []);

  const handleAdd = () => {
    setEditingItem(null);
    setFormCategoryId(categories[0]?.id ?? '');
    setFormFinancialModelTypeId(financialModelTypes[0]?.id ?? '');
    setFormTitle('');
    setError('');
    setShowModal(true);
  };

  const handleEdit = (item: CostItem) => {
    setEditingItem(item);
    setFormCategoryId(item.costCategoryId);
    setFormFinancialModelTypeId(item.financialModelExpenseTypeId);
    setFormTitle(item.title);
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (item: CostItem) => {
    if (!confirm(`Удалить статью расходов «${item.title}»?`)) return;
    const res = await fetch(`/api/cost-items/${item.id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchItems();
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!canManage) return;
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canManage || !draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget as HTMLElement;
    if (target.dataset.id !== draggedItem) target.classList.add('bg-blue-50');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('bg-blue-50');
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    if (!canManage || !draggedItem) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('bg-blue-50');
    if (draggedItem === targetId) {
      setDraggedItem(null);
      return;
    }
    const fromIdx = items.findIndex((i) => i.id === draggedItem);
    const toIdx = items.findIndex((i) => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedItem(null);
      return;
    }
    const next = [...items];
    const [removed] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, removed);
    setItems(next);
    setDraggedItem(null);

    const res = await fetch('/api/cost-items/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ costItemIds: next.map((i) => i.id) }),
    });
    if (!res.ok) {
      fetchItems();
      const data = await res.json();
      alert(data.error || 'Ошибка сохранения порядка');
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    document.querySelectorAll('tbody tr').forEach((r) => r.classList.remove('bg-blue-50'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const url = editingItem ? `/api/cost-items/${editingItem.id}` : '/api/cost-items';
    const method = editingItem ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        costCategoryId: formCategoryId,
        title: formTitle.trim(),
        financialModelExpenseTypeId: formFinancialModelTypeId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Ошибка сохранения');
      return;
    }
    setShowModal(false);
    setEditingItem(null);
    setFormTitle('');
    fetchItems();
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Статьи расходов</h1>
          {canManage && (
            <p className="text-sm text-gray-500 mt-1">
              Перетащите строки для изменения порядка. Порядок используется в разделе «Расходы» и в отчётах.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/cost-categories"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Категории расходов
          </Link>
          <Link
            href="/financial-model-expense-types"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Расходы в финмодели
          </Link>
          {canManage && (
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
            >
              + Добавить статью
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => { setError(''); fetchItems(); }} className="ml-4 text-red-800 underline">Повторить</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Категория</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Вид для финмодели</th>
                {canManage && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr
                  key={item.id}
                  draggable={!!canManage}
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, item.id)}
                  onDragEnd={handleDragEnd}
                  data-id={item.id}
                  className={`hover:bg-gray-50 transition-colors ${draggedItem === item.id ? 'opacity-50 bg-gray-200' : ''} ${canManage ? 'cursor-move' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {canManage && (
                      <span className="inline-block mr-2 text-gray-400 cursor-move" title="Перетащите для изменения порядка">⋮⋮</span>
                    )}
                    {item.costCategory?.name ?? '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.financialModelExpenseType?.name ?? '-'}</td>
                  {canManage && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-900 mr-4">Редактировать</button>
                      <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-900">Удалить</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && !loading && !error && (
          <div className="text-center py-8 text-gray-500">
            Статьи расходов не найдены
            <button onClick={fetchItems} className="ml-4 text-blue-600 underline">Обновить</button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {editingItem ? 'Редактировать статью расходов' : 'Добавить статью расходов'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Категория *</label>
                <select
                  required
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Вид расхода для финмодели *</label>
                <select
                  required
                  value={formFinancialModelTypeId}
                  onChange={(e) => setFormFinancialModelTypeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {financialModelTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Например: Зарплата"
                  autoFocus
                />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingItem(null); setError(''); }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
