'use client';

import { useState, useEffect } from 'react';
import ClientModal from './ClientModal';
import ClientDocumentsModal from './ClientDocumentsModal';

interface Client {
  id: string;
  name: string;
  legalEntity?: {
    id: string;
    name: string;
  } | null;
  seller: {
    id: string;
    fullName: string;
  };
  sites: Array<{
    id: string;
    title: string;
    niche: string;
  }>;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface User {
  id: string;
  fullName: string;
  roleCode: string;
}

export default function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [documentsClient, setDocumentsClient] = useState<Client | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [canAdd, setCanAdd] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    fetchUser();
    fetchClients();
  }, []);

  useEffect(() => {
    if (user) {
      // Check permissions via API
      Promise.all([
        fetch('/api/permissions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'clients', permission: 'create' }),
        }).then((r) => r.json()),
        fetch('/api/permissions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'clients', permission: 'edit' }),
        }).then((r) => r.json()),
        fetch('/api/permissions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'clients', permission: 'delete' }),
        }).then((r) => r.json()),
      ]).then(([create, edit, del]) => {
        setCanAdd(create.hasPermission || false);
        setCanEdit(edit.hasPermission || false);
        setCanDelete(del.hasPermission || false);
      });
    }
  }, [user]);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    const res = await fetch('/api/clients');
    const data = await res.json();
    setClients(data.clients || []);
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingClient(null);
    setShowModal(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowModal(true);
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Удалить клиента "${client.name}"? Все проекты будут перенесены в "Без клиентов".`)) {
      return;
    }

    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchClients();
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('ru-RU');
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Клиенты</h1>
        {canAdd && (
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
          >
            + Добавить клиента
          </button>
        )}
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Клиент
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Продавец
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Юрлицо
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Проекты
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ниши
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map((client) => {
                const niches = [...new Set(client.sites.map((s) => s.niche))];
                return (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{client.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.seller.fullName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.legalEntity?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {client.sites.length > 0 ? (
                        <div className="max-w-xs">
                          {client.sites.map((s) => s.title).join(', ')}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {niches.length > 0 ? niches.join(', ') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setDocumentsClient(client)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Документы
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleEdit(client)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Редактировать
                        </button>
                      )}
                      {canDelete && !client.name.includes('Без клиентов') && (
                        <button
                          onClick={() => handleDelete(client)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Удалить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {clients.length === 0 && (
          <div className="text-center py-8 text-gray-500">Клиенты не найдены</div>
        )}
      </div>

      {documentsClient && (
        <ClientDocumentsModal
          clientId={documentsClient.id}
          clientName={documentsClient.name}
          onClose={() => setDocumentsClient(null)}
        />
      )}

      {showModal && (
        <ClientModal
          client={editingClient ? {
            id: editingClient.id,
            name: editingClient.name,
            legalEntityId: editingClient.legalEntity?.id || null,
            sellerEmployeeId: editingClient.seller.id,
          } : null}
          onClose={() => {
            setShowModal(false);
            setEditingClient(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingClient(null);
            fetchClients();
          }}
        />
      )}
    </div>
  );
}
