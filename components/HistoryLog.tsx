'use client';

import { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  serviceId: string | null;
  description: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { id: string; fullName: string } | null;
  service: {
    id: string;
    product: { name: string };
    site: { title: string; client: { name: string } };
  } | null;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  SERVICE_EXPENSE: 'Статья расходов',
  WORK_PERIOD: 'Период',
  SERVICE: 'Услуга',
  SERVICE_EXPENSE_ITEM: 'Расход проекта',
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Создание',
  UPDATE: 'Изменение',
  DELETE: 'Удаление',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
};

export default function HistoryLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    entityType: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.entityType) params.set('entityType', filters.entityType);
      params.set('sortBy', filters.sortBy);
      params.set('sortOrder', filters.sortOrder);
      params.set('limit', String(pageSize));
      params.set('offset', String(page * pageSize));

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters, page]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">История изменений</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Тип</label>
            <select
              value={filters.entityType}
              onChange={(e) => { setFilters({ ...filters, entityType: e.target.value }); setPage(0); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Все</option>
              <option value="SERVICE_EXPENSE_ITEM">Расходы проектов</option>
              <option value="WORK_PERIOD">Периоды</option>
              <option value="SERVICE">Услуги</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Сортировка</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="createdAt">Дата</option>
              <option value="entityType">Тип</option>
              <option value="action">Действие</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Порядок</label>
            <select
              value={filters.sortOrder}
              onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="desc">Сначала новые</option>
              <option value="asc">Сначала старые</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Загрузка...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действие</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Проект</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Описание</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Пользователь</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {ENTITY_TYPE_LABELS[log.entityType] || log.entityType}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {log.service ? (
                        <div>
                          <div className="font-medium">{log.service.site.client.name}</div>
                          <div className="text-gray-400">{log.service.site.title} — {log.service.product.name}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-xs truncate" title={log.description}>
                      {log.description}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {log.user?.fullName || '—'}
                    </td>
                  </tr>
                  {expandedLog === log.id && (log.oldValue || log.newValue) && (
                    <tr key={`${log.id}-detail`} className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {log.oldValue && (
                            <div>
                              <div className="font-medium text-gray-600 mb-1">Было:</div>
                              <pre className="bg-white border rounded p-2 overflow-auto max-h-40 text-gray-700">
                                {JSON.stringify(JSON.parse(log.oldValue), null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.newValue && (
                            <div>
                              <div className="font-medium text-gray-600 mb-1">Стало:</div>
                              <pre className="bg-white border rounded p-2 overflow-auto max-h-40 text-gray-700">
                                {JSON.stringify(JSON.parse(log.newValue), null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {logs.length === 0 && (
            <div className="text-center py-8 text-gray-500">Нет записей</div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Всего: {total} записей, стр. {page + 1} из {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-100"
                >
                  Назад
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-100"
                >
                  Вперёд
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
