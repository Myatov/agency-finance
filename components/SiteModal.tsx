'use client';

import { useState, useEffect } from 'react';

interface Site {
  id: string;
  title: string;
  websiteUrl: string | null;
  description: string | null;
  niche: string;
  nicheId: string | null;
  clientId: string;
  accountManagerId: string | null;
  isActive: boolean;
}

interface Niche {
  id: string;
  name: string;
  parentId: string | null;
  parent?: {
    id: string;
    name: string;
  } | null;
}

interface Client {
  id: string;
  name: string;
}

interface AccountManager {
  id: string;
  fullName: string;
}

interface User {
  id: string;
  roleCode: string;
}

export default function SiteModal({
  site,
  onClose,
  onSuccess,
}: {
  site: Site | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    title: '',
    websiteUrl: '',
    description: '',
    niche: '',
    nicheId: '',
    clientId: '',
    accountManagerId: '',
    isActive: false,
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [accountManagers, setAccountManagers] = useState<AccountManager[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClients();
    fetchAccountManagers();
    fetchNiches();
    fetchUser();

    if (site) {
      setFormData({
        title: site.title,
        websiteUrl: site.websiteUrl || '',
        description: site.description || '',
        niche: site.niche,
        nicheId: site.nicheId || '',
        clientId: site.clientId,
        accountManagerId: site.accountManagerId || '',
        isActive: site.isActive,
      });
    }
  }, [site]);

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    const data = await res.json();
    setClients(data.clients || []);
  };

  const fetchAccountManagers = async () => {
    const res = await fetch('/api/users/account-managers');
    const data = await res.json();
    setAccountManagers(data.accountManagers || []);
  };

  const fetchNiches = async () => {
    try {
      const res = await fetch('/api/niches');
      const data = await res.json();
      if (res.ok) {
        setNiches(data.niches || []);
      }
    } catch (error) {
      console.error('Error fetching niches:', error);
      // Если ошибка - просто не загружаем ниши, форма будет работать с текстовым полем
      setNiches([]);
    }
  };

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  // Автоматически назначаем ACCOUNT_MANAGER при создании нового сайта
  useEffect(() => {
    if (!site && user && user.roleCode === 'ACCOUNT_MANAGER' && accountManagers.length > 0 && user.id) {
      const currentUserAsAM = accountManagers.find((am) => am.id === user.id);
      if (currentUserAsAM) {
        setFormData((prev) => {
          // Устанавливаем только если еще не установлено
          if (!prev.accountManagerId) {
            return { ...prev, accountManagerId: user.id };
          }
          return prev;
        });
      }
    }
  }, [user, accountManagers, site]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = site ? `/api/sites/${site.id}` : '/api/sites';
      const method = site ? 'PUT' : 'POST';

      const payload: any = {
        title: formData.title,
        websiteUrl: formData.websiteUrl || null,
        description: formData.description || null,
        niche: formData.nicheId ? niches.find(n => n.id === formData.nicheId)?.name || formData.niche : formData.niche,
        nicheId: formData.nicheId || null,
        clientId: formData.clientId,
        isActive: formData.isActive,
      };

      // Include accountManagerId if:
      // 1. User can assign (OWNER, CEO, FINANCE)
      // 2. User is ACCOUNT_MANAGER creating a new site (can assign themselves)
      if (
        user &&
        (user.roleCode === 'OWNER' ||
          user.roleCode === 'CEO' ||
          user.roleCode === 'FINANCE' ||
          (user.roleCode === 'ACCOUNT_MANAGER' && !site))
      ) {
        payload.accountManagerId = formData.accountManagerId || null;
      }

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
    } catch (err) {
      setError('Ошибка соединения');
      setLoading(false);
    }
  };

  const canAssignAccountManager =
    user &&
    (user.roleCode === 'OWNER' ||
      user.roleCode === 'CEO' ||
      user.roleCode === 'FINANCE' ||
      (user.roleCode === 'ACCOUNT_MANAGER' && !site)); // ACCOUNT_MANAGER can assign themselves when creating

  // Auto-fill title from client name
  const handleClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client && !site && !formData.title) {
      setFormData({ ...formData, clientId, title: client.name });
    } else {
      setFormData({ ...formData, clientId });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {site ? 'Редактировать сайт' : 'Добавить сайт'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Клиент *
            </label>
            <select
              required
              value={formData.clientId}
              onChange={(e) => handleClientChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Выберите клиента</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название сайта *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ниша *
            </label>
            {niches.length > 0 ? (() => {
              // Фильтруем только дочерние ниши (не корневые)
              const childNiches = niches.filter(n => n.parentId);
              
              // Если нет дочерних ниш, показываем все (для обратной совместимости)
              const availableNiches = childNiches.length > 0 ? childNiches : niches;
              
              return (
                <select
                  required
                  value={formData.nicheId}
                  onChange={(e) => {
                    const selectedNiche = niches.find(n => n.id === e.target.value);
                    setFormData({ 
                      ...formData, 
                      nicheId: e.target.value,
                      niche: selectedNiche?.name || ''
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Выберите нишу</option>
                  {availableNiches.map((niche) => {
                    // Показываем иерархию: "Родитель > Дочерняя"
                    const displayName = niche.parent 
                      ? `${niche.parent.name} > ${niche.name}`
                      : niche.name;
                    return (
                      <option key={niche.id} value={niche.id}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              );
            })() : (
              <input
                type="text"
                required
                value={formData.niche}
                onChange={(e) => setFormData({ ...formData, niche: e.target.value, nicheId: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Введите нишу"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Адрес сайта
            </label>
            <input
              type="url"
              value={formData.websiteUrl}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {canAssignAccountManager && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Аккаунт-менеджер
              </label>
              <select
                value={formData.accountManagerId}
                onChange={(e) =>
                  setFormData({ ...formData, accountManagerId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Не назначен</option>
                {user && user.roleCode === 'ACCOUNT_MANAGER' && !site ? (
                  // ACCOUNT_MANAGER при создании может выбрать только себя
                  accountManagers
                    .filter((am) => am.id === user.id)
                    .map((am) => (
                      <option key={am.id} value={am.id}>
                        {am.fullName}
                      </option>
                    ))
                ) : (
                  // OWNER/CEO/FINANCE видят всех аккаунт-менеджеров
                  accountManagers.map((am) => (
                    <option key={am.id} value={am.id}>
                      {am.fullName}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
              Активен
            </label>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex justify-end space-x-4">
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
