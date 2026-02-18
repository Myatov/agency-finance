'use client';

import { useState, useEffect } from 'react';

interface Site {
  id: string;
  title: string;
  websiteUrl: string | null;
  description: string | null;
  niche: string;
  clientId: string;
  isActive: boolean;
}

interface Niche {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  parent?: { id: string; name: string; sortOrder?: number } | null;
}

interface Client {
  id: string;
  name: string;
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
    description: '',
    niche: '',
    nicheId: '',
    clientId: '',
    isActive: false,
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClients();
    fetchNiches();
    fetchUser();

    if (site) {
      setFormData((prev) => ({
        ...prev,
        title: site.title,
        description: site.description || '',
        niche: site.niche,
        nicheId: '',
        clientId: site.clientId,
        isActive: site.isActive,
      }));
    }
  }, [site]);

  // При редактировании подставляем nicheId по имени ниши (только для дочерних)
  useEffect(() => {
    if (site && niches.length > 0 && formData.niche === site.niche) {
      const childNiches = niches.filter((n) => n.parentId);
      const found = childNiches.find((n) => n.name === site.niche);
      if (found && !formData.nicheId) {
        setFormData((prev) => ({ ...prev, nicheId: found.id }));
      }
    }
  }, [site, niches, formData.niche, formData.nicheId]);

  const fetchClients = async () => {
    const res = await fetch('/api/clients?filter=all');
    const data = await res.json();
    setClients(data.clients || []);
  };

  const fetchNiches = async () => {
    try {
      const res = await fetch('/api/niches');
      const data = await res.json();
      if (res.ok) setNiches(data.niches || []);
    } catch {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = site ? `/api/sites/${site.id}` : '/api/sites';
      const method = site ? 'PUT' : 'POST';

      let nicheName = (formData.niche || '').trim();
      const selectedNiche = formData.nicheId ? niches.find((n) => n.id === formData.nicheId) : null;
      if (selectedNiche) nicheName = selectedNiche.name;
      if (!nicheName) {
        setError('Поле «Ниша» обязательно для заполнения');
        setLoading(false);
        return;
      }

      const payload: any = {
        title: formData.title,
        websiteUrl: null,
        description: formData.description || null,
        niche: nicheName,
        nicheId: formData.nicheId || null,
        clientId: formData.clientId,
        isActive: formData.isActive,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = [data.error, data.details].filter(Boolean).join(': ') || 'Ошибка сохранения';
        setError(msg);
        setLoading(false);
        return;
      }

      if (!site && !data.site) {
        setError('Сервер не вернул созданный сайт');
        setLoading(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка соединения');
      setLoading(false);
    }
  };

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
            <select
              required
              value={formData.nicheId}
              onChange={(e) => {
                const n = niches.find((x) => x.id === e.target.value);
                setFormData({
                  ...formData,
                  nicheId: e.target.value,
                  niche: n ? n.name : '',
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Выберите нишу</option>
              {(() => {
                const childNiches = niches.filter((n) => n.parentId);
                if (childNiches.length === 0) {
                  return (
                    <option value="" disabled>
                      Нет дочерних ниш — добавьте в справочнике «Ниши»
                    </option>
                  );
                }
                const rootMap = new Map(
                  niches.filter((n) => !n.parentId).map((n) => [n.id, { sortOrder: n.sortOrder ?? 0, name: n.name }])
                );
                const getParentOrder = (niche: Niche) =>
                  niche.parentId ? (rootMap.get(niche.parentId)?.sortOrder ?? 0) : 0;
                const sorted = [...childNiches].sort((a, b) => {
                  const oA = getParentOrder(a);
                  const oB = getParentOrder(b);
                  if (oA !== oB) return oA - oB;
                  return a.sortOrder - b.sortOrder;
                });
                return sorted.map((niche) => {
                  const parentName = niche.parent?.name ?? niches.find((p) => p.id === niche.parentId)?.name ?? '';
                  const label = parentName ? `${parentName} › ${niche.name}` : niche.name;
                  return (
                    <option key={niche.id} value={niche.id}>
                      {label}
                    </option>
                  );
                });
              })()}
            </select>
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
