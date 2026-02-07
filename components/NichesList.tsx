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
  const [draggedParentId, setDraggedParentId] = useState<string | null>(null);
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
      if (data.user.roleCode !== 'OWNER' && data.user.roleCode !== 'CEO') {
        window.location.href = '/';
        return;
      }
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

  // Группируем ниши: корневые и дочерние
  const rootNiches = niches.filter(n => !n.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const getChildren = (parentId: string) => 
    niches.filter(n => n.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

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

  const handleDragStart = (e: React.DragEvent, niche: Niche) => {
    if (!canManage) return;
    setDraggedItem(niche.id);
    setDraggedParentId(niche.parentId);
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

  const handleDrop = async (e: React.DragEvent, targetNiche: Niche) => {
    if (!canManage || !draggedItem) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('bg-blue-50');
    
    if (draggedItem === targetNiche.id) {
      setDraggedItem(null);
      setDraggedParentId(null);
      return;
    }

    // Можно перемещать только в рамках одной группы (корневые или дочерние одной родительской)
    if (draggedParentId !== targetNiche.parentId) {
      setDraggedItem(null);
      setDraggedParentId(null);
      return;
    }

    const group = draggedParentId 
      ? niches.filter(n => n.parentId === draggedParentId).sort((a, b) => a.sortOrder - b.sortOrder)
      : rootNiches;

    const fromIdx = group.findIndex((n) => n.id === draggedItem);
    const toIdx = group.findIndex((n) => n.id === targetNiche.id);
    
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedItem(null);
      setDraggedParentId(null);
      return;
    }

    const next = [...group];
    const [removed] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, removed);
    
    // Обновляем локально
    const updatedNiches = niches.map(n => {
      const found = next.find(nn => nn.id === n.id);
      if (found) {
        const newIndex = next.indexOf(found);
        return { ...n, sortOrder: newIndex };
      }
      return n;
    });
    setNiches(updatedNiches);
    setDraggedItem(null);
    setDraggedParentId(null);

    // Сохраняем на сервере
    const res = await fetch('/api/niches/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        nicheIds: next.map((n) => n.id),
        parentId: draggedParentId,
      }),
    });
    
    if (!res.ok) {
      fetchNiches();
      const data = await res.json();
      alert(data.error || 'Ошибка сохранения порядка');
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedParentId(null);
    document.querySelectorAll('tbody tr, tbody .group-row').forEach((r) => r.classList.remove('bg-blue-50'));
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

  const renderNicheRow = (niche: Niche, isChild: boolean = false, index: number = 0): JSX.Element => {
    const children = getChildren(niche.id);
    const isDragging = draggedItem === niche.id;
    const canDrag = canManage; // Можно перетаскивать и корневые, и дочерние
    
    return (
      <>
        <tr
          key={niche.id}
          draggable={canDrag}
          onDragStart={canDrag ? (e) => handleDragStart(e, niche) : undefined}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={canDrag ? (e) => handleDrop(e, niche) : undefined}
          onDragEnd={handleDragEnd}
          className={`group-row ${isDragging ? 'opacity-50' : ''} ${canDrag ? 'cursor-move' : ''} ${!isChild ? 'bg-gray-50 font-semibold' : ''}`}
        >
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {!isChild && index + 1}
          </td>
          <td className={`px-6 py-4 whitespace-nowrap text-sm ${!isChild ? 'font-bold text-gray-900' : 'text-gray-700'}`} style={{ paddingLeft: isChild ? '48px' : '24px' }}>
            {isChild && <span className="text-gray-400 mr-2">└</span>}
            {niche.name}
            {children.length > 0 && !isChild && (
              <span className="ml-2 text-xs text-gray-500 font-normal">({children.length} подкатегорий)</span>
            )}
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
        {children.map((child, childIndex) => 
          renderNicheRow(child, true, childIndex)
        )}
      </>
    );
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
            {rootNiches.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 3 : 2} className="px-6 py-4 text-center text-gray-500">
                  Нет ниш. Добавьте первую нишу.
                </td>
              </tr>
            ) : (
              rootNiches.map((niche, index) => renderNicheRow(niche, false, index))
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
                  {rootNiches
                    .filter(n => !editingNiche || n.id !== editingNiche.id)
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
