'use client';

import { useState, useEffect } from 'react';

interface Niche {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  parent?: {
    id: string;
    name: string;
  } | null;
  children?: Array<{
    id: string;
    name: string;
  }>;
}

interface User {
  roleCode: string;
}

export default function NichesList() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNiche, setEditingNiche] = useState<Niche | null>(null);
  const [formName, setFormName] = useState('');
  const [formParentId, setFormParentId] = useState<string>('');
  const [error, setError] = useState('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUser();
    fetchNiches();
  }, []);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchNiches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/niches');
      const data = await res.json();
      if (res.ok) {
        setNiches(data.niches || []);
      }
    } catch (error) {
      console.error('Error fetching niches:', error);
    } finally {
      setLoading(false);
    }
  };

  const canManage = user?.roleCode === 'OWNER' || user?.roleCode === 'CEO';

  const handleAdd = () => {
    setEditingNiche(null);
    setFormName('');
    setFormParentId('');
    setError('');
    setShowModal(true);
  };

  const handleEdit = (niche: Niche) => {
    setEditingNiche(niche);
    setFormName(niche.name);
    setFormParentId(niche.parentId || '');
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (niche: Niche) => {
    if (!confirm(`Удалить нишу «${niche.name}»?`)) return;
    const res = await fetch(`/api/niches/${niche.id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchNiches();
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
    const fromIdx = niches.findIndex((n) => n.id === draggedItem);
    const toIdx = niches.findIndex((n) => n.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedItem(null);
      return;
    }
    const next = [...niches];
    const [removed] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, removed);
    setNiches(next);
    setDraggedItem(null);

    const res = await fetch('/api/niches/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nicheIds: next.map((n) => n.id) }),
    });
    if (!res.ok) {
      fetchNiches();
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
    if (!formName.trim()) {
      setError('Название обязательно');
      return;
    }

    const url = editingNiche ? `/api/niches/${editingNiche.id}` : '/api/niches';
    const method = editingNiche ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: formName.trim(),
        parentId: formParentId || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Ошибка сохранения');
      return;
    }

    setShowModal(false);
    setEditingNiche(null);
    setFormName('');
    setFormParentId('');
    fetchNiches();
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Ниши</h1>
        {canManage && (
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
          >
            + Добавить нишу
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Название
              </th>
              {canManage && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {niches.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 3 : 2} className="px-6 py-4 text-center text-gray-500">
                  Нет ниш. Добавьте первую нишу.
                </td>
              </tr>
            ) : (
              niches.map((niche, index) => (
                <tr
                  key={niche.id}
                  draggable={canManage}
                  onDragStart={(e) => handleDragStart(e, niche.id)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, niche.id)}
                  onDragEnd={handleDragEnd}
                  className={draggedItem === niche.id ? 'opacity-50' : 'cursor-move'}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {niche.name}
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(niche)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(niche)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Удалить
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingNiche ? 'Редактировать нишу' : 'Добавить нишу'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Родительская ниша (необязательно)
                </label>
                <select
                  value={formParentId}
                  onChange={(e) => setFormParentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Корневая ниша (без родителя)</option>
                  {niches
                    .filter(n => !n.parentId && (!editingNiche || n.id !== editingNiche.id))
                    .map((niche) => (
                      <option key={niche.id} value={niche.id}>
                        {niche.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Выберите родительскую нишу для создания вложенности
                </p>
              </div>
              {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingNiche(null);
                    setFormName('');
                    setFormParentId('');
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingNiche ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
