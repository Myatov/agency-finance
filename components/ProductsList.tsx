'use client';

import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  sortOrder: number;
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

  useEffect(() => {
    fetchUser();
    fetchProducts();
  }, []);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
      } else {
        console.error('Error fetching products:', data.error);
        setError(data.error || 'Ошибка загрузки продуктов');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
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
    if (!confirm(`Удалить продукт "${product.name}"?`)) {
      return;
    }

    const res = await fetch(`/api/products/${product.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchProducts();
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

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
    if (target.dataset.productId !== draggedItem) {
      target.classList.add('bg-blue-50');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('bg-blue-50');
  };

  const handleDrop = async (e: React.DragEvent, targetProductId: string) => {
    if (!canManage || !draggedItem) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('bg-blue-50');

    if (draggedItem === targetProductId) {
      setDraggedItem(null);
      return;
    }

    const draggedIndex = products.findIndex((p) => p.id === draggedItem);
    const targetIndex = products.findIndex((p) => p.id === targetProductId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      return;
    }

    // Reorder products locally
    const newProducts = [...products];
    const [removed] = newProducts.splice(draggedIndex, 1);
    newProducts.splice(targetIndex, 0, removed);

    setProducts(newProducts);
    setDraggedItem(null);

    // Update order in database
    const productIds = newProducts.map((p) => p.id);
    const res = await fetch('/api/products/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds }),
    });

    if (!res.ok) {
      // Revert on error
      fetchProducts();
      const data = await res.json();
      alert(data.error || 'Ошибка сохранения порядка');
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItem(null);
    // Remove any highlight classes
    const rows = document.querySelectorAll('tbody tr');
    rows.forEach((row) => {
      row.classList.remove('bg-blue-50');
    });
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

    if (!res.ok) {
      setError(data.error || 'Ошибка сохранения');
      return;
    }

    setShowModal(false);
    setEditingProduct(null);
    setFormName('');
    fetchProducts();
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Продукты</h1>
          {canManage && (
            <p className="text-sm text-gray-500 mt-1">
              Перетащите продукты для изменения порядка
            </p>
          )}
        </div>
        {canManage && (
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
          >
            + Добавить продукт
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button
            onClick={() => {
              setError('');
              fetchProducts();
            }}
            className="ml-4 text-red-800 underline"
          >
            Повторить
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название
                </th>
                {canManage && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product, index) => (
                <tr
                  key={product.id}
                  draggable={!!canManage}
                  onDragStart={(e) => handleDragStart(e, product.id)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, product.id)}
                  onDragEnd={(e) => handleDragEnd(e)}
                  data-product-id={product.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    draggedItem === product.id ? 'opacity-50 bg-gray-200' : ''
                  } ${canManage ? 'cursor-move' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {canManage && (
                      <span className="inline-block mr-2 text-gray-400 cursor-move" title="Перетащите для изменения порядка">
                        ⋮⋮
                      </span>
                    )}
                    {product.name}
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        className="text-red-600 hover:text-red-900"
                      >
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
            Продукты не найдены
            <button
              onClick={fetchProducts}
              className="ml-4 text-blue-600 underline"
            >
              Обновить
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {editingProduct ? 'Редактировать продукт' : 'Добавить продукт'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  autoFocus
                />
              </div>

              {error && <div className="text-red-600 text-sm">{error}</div>}

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingProduct(null);
                    setFormName('');
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
