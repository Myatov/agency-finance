'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AgentModal, { type Agent } from './AgentModal';

interface AgentWithCount extends Agent {
  _count?: { clients: number };
}

interface UserWithPermissions {
  roleCode: string;
  permissions?: {
    agents?: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      manage: boolean;
      view_all: boolean;
    };
  };
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Активен',
  PAUSED: 'Пауза',
  ARCHIVED: 'Архив',
};

const SOURCE_LABELS: Record<string, string> = {
  PARTNER: 'Партнёр',
  AGENT: 'Агент',
  REFERRER: 'Рекомендатель',
  EMPLOYEE: 'Сотрудник',
};

export default function AgentsList() {
  const [agents, setAgents] = useState<AgentWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [user, setUser] = useState<UserWithPermissions | null>(null);

  const canCreate = !!(user?.permissions?.agents?.create || user?.permissions?.agents?.manage);
  const canEdit = !!(user?.permissions?.agents?.edit || user?.permissions?.agents?.manage);
  const canDelete = !!(user?.permissions?.agents?.delete || user?.permissions?.agents?.manage);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    const url = search.trim() ? `/api/agents?q=${encodeURIComponent(search.trim())}` : '/api/agents';
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    setAgents(data.agents || []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => d.user && setUser(d.user));
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleAdd = () => {
    setEditingAgent(null);
    setShowModal(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setShowModal(true);
  };

  const handleDelete = async (agent: AgentWithCount) => {
    if (!confirm(`Удалить агента «${agent.name}»?`)) return;
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAgents();
      } else {
        const data = await res.json();
        alert(data.error || 'Ошибка удаления');
      }
    } catch {
      alert('Ошибка соединения');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Агенты</h1>
        <div className="flex items-center gap-4">
          <input
            type="search"
            placeholder="Поиск по имени, телефону, Telegram..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md min-w-[280px]"
          />
          {canCreate && (
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
            >
              + Добавить агента
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Имя</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Компания</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Деятельность</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Телефон / Telegram</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Источник</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Клиентов приведено</th>
                {(canEdit || canDelete) && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agents.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    <Link href={`/agents/${a.id}`} className="text-blue-600 hover:text-blue-900 hover:underline">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{a.companyName || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-[180px] truncate" title={a.professionalActivity || undefined}>
                    {a.professionalActivity || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {[a.phone, a.telegram].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{a.source ? SOURCE_LABELS[a.source] || a.source : '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{a.status ? STATUS_LABELS[a.status] || a.status : '—'}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{a._count?.clients ?? 0}</td>
                  {(canEdit || canDelete) && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {canEdit && (
                        <button onClick={() => handleEdit(a)} className="text-blue-600 hover:text-blue-900 mr-3">
                          Изменить
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(a)} className="text-red-600 hover:text-red-900">
                          Удалить
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && agents.length === 0 && (
          <div className="text-center py-8 text-gray-500">Агенты не найдены</div>
        )}
      </div>

      {showModal && (
        <AgentModal
          agent={editingAgent}
          onClose={() => {
            setShowModal(false);
            setEditingAgent(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingAgent(null);
            fetchAgents();
          }}
        />
      )}
    </div>
  );
}
