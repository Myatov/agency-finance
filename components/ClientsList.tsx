'use client';

import { useState, useEffect } from 'react';
import ClientModal from './ClientModal';
import ClientDocumentsModal from './ClientDocumentsModal';
import ClientPortalModal from './ClientPortalModal';

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
  agent?: {
    id: string;
    name: string;
    phone?: string | null;
    telegram?: string | null;
  } | null;
  sites: Array<{
    id: string;
    title: string;
    niche: string;
  }>;
  createdAt: Date | string;
  updatedAt: Date | string;
  legalEntityName?: string | null;
  accountManagerId?: string | null;
  accountManager?: { id: string; fullName: string } | null;
  legalAddress?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  rs?: string | null;
  bankName?: string | null;
  bik?: string | null;
  ks?: string | null;
  paymentRequisites?: string | null;
  contacts?: string | null;
  isArchived?: boolean;
}

interface User {
  id: string;
  fullName: string;
  roleCode: string;
}

type ClientFilter = 'active' | 'all';

type SimpleUser = {
  id: string;
  fullName: string;
};

export default function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [documentsClient, setDocumentsClient] = useState<Client | null>(null);
  const [portalClient, setPortalClient] = useState<Client | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [canAdd, setCanAdd] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [filter, setFilter] = useState<ClientFilter>('active');
  const [sellers, setSellers] = useState<SimpleUser[]>([]);
  const [accountManagers, setAccountManagers] = useState<SimpleUser[]>([]);
  const [canViewAllClients, setCanViewAllClients] = useState(false);
  const [canViewAllProjects, setCanViewAllProjects] = useState(false);
  const [sellerFilter, setSellerFilter] = useState<string>('');
  const [accountManagerFilter, setAccountManagerFilter] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    fetchClients();
  }, [filter, sellerFilter, accountManagerFilter, showArchived]);

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
        fetch('/api/permissions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'clients', permission: 'view_all' }),
        }).then((r) => r.json()),
        fetch('/api/permissions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'projects', permission: 'view_all' }),
        }).then((r) => r.json()),
      ]).then(([create, edit, del, viewAll, viewAllProjects]) => {
        setCanAdd(create.hasPermission || false);
        setCanEdit(edit.hasPermission || false);
        setCanDelete(del.hasPermission || false);
        setCanViewAllClients(viewAll.hasPermission || false);
        setCanViewAllProjects(viewAllProjects.hasPermission || false);
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Продавцы — для фильтра «Продавец»
    fetch('/api/users/sellers')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.sellers)) {
          setSellers(d.sellers);
        }
      })
      .catch(() => {
        setSellers([]);
      });

    // Аккаунт-менеджеры — для фильтра «Аккаунт-менеджер»
    fetch('/api/users/account-managers')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.accountManagers)) {
          setAccountManagers(d.accountManagers);
        }
      })
      .catch(() => {
        setAccountManagers([]);
      });
  }, [user]);

  // По умолчанию: если нет права смотреть всех клиентов и роль — ACCOUNT_MANAGER,
  // фильтр по аккаунт-менеджеру фиксируем на текущего пользователя
  useEffect(() => {
    if (user && !canViewAllClients && user.roleCode === 'ACCOUNT_MANAGER') {
      setAccountManagerFilter(user.id);
    }
  }, [user, canViewAllClients]);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('filter', filter);
    if (sellerFilter) params.set('sellerId', sellerFilter);
    if (accountManagerFilter) params.set('accountManagerId', accountManagerFilter);
    if (showArchived) params.set('archived', '1');
    const res = await fetch(`/api/clients?${params}`, { cache: 'no-store' });
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

  const handleAssignAM = async (client: Client, newAMId: string) => {
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: client.name,
          sellerEmployeeId: client.seller.id,
          accountManagerId: newAMId || null,
        }),
      });
      if (res.ok) {
        fetchClients();
      } else {
        const data = await res.json();
        alert(data.error || 'Ошибка назначения');
      }
    } catch {
      alert('Ошибка соединения');
    }
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

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <span className="text-sm font-medium text-gray-700">Показать:</span>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="clientFilter"
              checked={filter === 'active'}
              onChange={() => setFilter('active')}
              className="rounded border-gray-300"
            />
            <span className="text-sm">с активными проектами</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="clientFilter"
              checked={filter === 'all'}
              onChange={() => setFilter('all')}
              className="rounded border-gray-300"
            />
            <span className="text-sm">всех клиентов</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Продавец:</span>
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Все</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>

          {(canViewAllClients || user?.roleCode === 'ACCOUNT_MANAGER') && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Аккаунт-менеджер:</span>
              <select
                value={accountManagerFilter}
                onChange={(e) => setAccountManagerFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {canViewAllClients && (
                  <option value="">Все</option>
                )}
                {!canViewAllClients && user?.roleCode === 'ACCOUNT_MANAGER' && (
                  <option value={user.id}>Только я</option>
                )}
                {canViewAllClients &&
                  accountManagers.map((am) => (
                    <option key={am.id} value={am.id}>
                      {am.fullName}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <label className="inline-flex items-center gap-2 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Архивные</span>
          </label>
        </div>
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
                  Аккаунт-менеджер
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Юрлицо
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Агент
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
                      {canViewAllProjects ? (
                        <select
                          value={client.accountManagerId || ''}
                          onChange={(e) => handleAssignAM(client, e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="">Не назначен</option>
                          {accountManagers.map((am) => (
                            <option key={am.id} value={am.id}>
                              {am.fullName}
                            </option>
                          ))}
                        </select>
                      ) : client.accountManager?.fullName ? (
                        client.accountManager.fullName
                      ) : (
                        <span className="text-red-400">Не назначен</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.legalEntity?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.agent?.name || '-'}
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
                          onClick={() => setPortalClient(client)}
                          className="text-teal-600 hover:text-teal-900 mr-4"
                        >
                          Личный кабинет
                        </button>
                      )}
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

      {portalClient && (
        <ClientPortalModal
          clientId={portalClient.id}
          clientName={portalClient.name}
          onClose={() => setPortalClient(null)}
        />
      )}

      {showModal && (
        <ClientModal
          key={editingClient?.id ?? 'new'}
          client={editingClient ? {
            ...editingClient,
            legalEntityId: editingClient.legalEntity?.id ?? (editingClient as { legalEntityId?: string }).legalEntityId ?? null,
            sellerEmployeeId: editingClient.seller?.id ?? (editingClient as { sellerEmployeeId?: string }).sellerEmployeeId ?? '',
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
