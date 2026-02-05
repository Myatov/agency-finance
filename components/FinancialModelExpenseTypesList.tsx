'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FinancialModelExpenseType {
  id: string;
  name: string;
  sortOrder: number;
}

export default function FinancialModelExpenseTypesList() {
  const [items, setItems] = useState<FinancialModelExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FinancialModelExpenseType | null>(null);
  const [formName, setFormName] = useState('');
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);
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
      const res = await fetch('/api/financial-model-expense-types');
      const data = await res.json();
      if (res.ok) setItems(data.types || []);
      else setError(data.error || 'Ошибка загрузки');
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
    setFormName('');
    setError('');
    setShowModal(true);
  };

  const handleEdit = (item: FinancialModelExpenseType) => {
    setEditingItem(item);
    setFormName(item.name);
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (item: FinancialModelExpenseType) => {
    if (!confirm(`Удалить вид «${item.name}»?`)) return;
    const res = await fetch(`/api/financial-model-expense-types/${item.id}`, { method: 'DELETE' });
    if (res.ok) fetchItems();
    else {
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
    (e.currentTarget as HTMLElement).classList.add('bg-blue-50');
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
    const res = await fetch('/api/financial-model-expense-types/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typeIds: next.map((i) => i.id) }),
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
    const url = editingItem ? `/api/financial-model-expense-types/${editingItem.id}` : '/api/financial-model-expense-types';
    const method = editingItem ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Ошибка сохранения');
      return;
    }
    setShowModal(false);
    setEditingItem(null);
    setFormName('');
    fetchItems();
  };

  if (loading) return <div className="text-center py-8">Загрузка...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/cost-items" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            ← Статьи расходов
          </Link>
          <h1 className="text-3xl font-bold">Виды расходов для финмодели</h1>
          {canManage && (
            <p className="text-sm text-gray-500 mt-1">Перетащите строки для изменения порядка</p>
          )}
        </div>
        {canManage && (
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Добавить вид
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => { setError(''); fetchItems(); }} className="ml-4 underline">Повторить</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
              {canManage && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>}
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
                className={`hover:bg-gray-50 ${draggedItem === item.id ? 'opacity-50 bg-gray-200' : ''} ${canManage ? 'cursor-move' : ''}`}
              >
                <td className="px-6 py-4">
                  {canManage && <span className="mr-2 text-gray-400 cursor-move">⋮⋮</span>}
                  {item.name}
                </td>
                {canManage && (
                  <td className="px-6 py-4">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:underline mr-4">Редактировать</button>
                    <button onClick={() => handleDelete(item)} className="text-red-600 hover:underline">Удалить</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">{editingItem ? 'Редактировать вид' : 'Добавить вид расхода для финмодели'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowModal(false); setError(''); }} className="px-4 py-2 border rounded-md">Отмена</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
