'use client';

import { useState, useEffect } from 'react';
import LegalEntityModal from './LegalEntityModal';

interface LegalEntity {
  id: string;
  name: string;
  type: string;
  usnPercent: number;
  vatPercent: number;
  totalTaxLoad: number;
  isActive: boolean;
}

interface User {
  id: string;
  roleCode: string;
}

const TYPE_LABELS: Record<string, string> = {
  IP: 'ИП',
  OOO: 'ООО',
  CARD: 'Карта',
  CRYPTO: 'Крипта',
  BARTER: 'Бартер',
};

export default function LegalEntitiesList() {
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<LegalEntity | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUser();
    fetchLegalEntities();
  }, []);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchLegalEntities = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/legal-entities');
      const data = await res.json();
      if (res.ok) {
        setLegalEntities(data.legalEntities || []);
      } else if (res.status === 403) {
        // Redirect to default page if no access
        window.location.href = '/';
      } else {
        console.error('Error fetching legal entities:', data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error fetching legal entities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingEntity(null);
    setShowModal(true);
  };

  const handleEdit = (entity: LegalEntity) => {
    setEditingEntity(entity);
    setShowModal(true);
  };

  const handleDelete = async (entity: LegalEntity) => {
    if (!confirm(`Удалить юрлицо "${entity.name}"?`)) {
      return;
    }

    const res = await fetch(`/api/legal-entities/${entity.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchLegalEntities();
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  const canManage = user?.roleCode === 'OWNER' || user?.roleCode === 'CEO';

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Юрлица</h1>
        {canManage && (
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
          >
            + Добавить юрлицо
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тип
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  УСН %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  НДС %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Итоговая налоговая нагрузка %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                {canManage && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {legalEntities.map((entity) => (
                <tr key={entity.id} className={!entity.isActive ? 'opacity-60' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entity.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {TYPE_LABELS[entity.type] || entity.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entity.usnPercent}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entity.vatPercent}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entity.totalTaxLoad.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        entity.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {entity.isActive ? 'Активно' : 'Неактивно'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(entity)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(entity)}
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
        {legalEntities.length === 0 && (
          <div className="text-center py-8 text-gray-500">Юрлица не найдены</div>
        )}
      </div>

      {showModal && (
        <LegalEntityModal
          legalEntity={editingEntity}
          onClose={() => {
            setShowModal(false);
            setEditingEntity(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingEntity(null);
            fetchLegalEntities();
          }}
        />
      )}
    </div>
  );
}
