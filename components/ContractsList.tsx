'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ContractDoc {
  id: string;
  clientId: string;
  type: string;
  docNumber: string | null;
  docDate: string | null;
  endDate: string | null;
  status: string;
  uploadedAt: string;
  originalName: string;
  client?: { id: string; name: string };
  uploader?: { id: string; fullName: string };
  site?: { id: string; title: string } | null;
}

interface ClientGroup {
  client: { id: string; name: string };
  documents: ContractDoc[];
}

interface StorageClientGroup {
  client: { id: string; name: string };
  contracts: any[];
  invoices: any[];
  closeoutDocs: any[];
  periodReports: any[];
}

type ViewMode = 'documents' | 'clients';

export default function ContractsList() {
  const [docs, setDocs] = useState<ContractDoc[]>([]);
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [storageClientGroups, setStorageClientGroups] = useState<StorageClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [status, setStatus] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('documents');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDocs();
  }, [clientId, siteId, status, viewMode]);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      if (viewMode === 'clients') {
        const res = await fetch('/api/storage/by-client');
        const data = await res.json();
        if (res.ok) {
          setStorageClientGroups(data.clientGroups || []);
        } else {
          setStorageClientGroups([]);
        }
      } else {
        const params = new URLSearchParams();
        if (clientId) params.set('clientId', clientId);
        if (siteId) params.set('siteId', siteId);
        if (status) params.set('status', status);
        const res = await fetch(`/api/contracts?${params}`);
        const data = await res.json();
        if (res.ok) {
          setDocs(data.contracts || []);
        } else {
          setDocs([]);
        }
      }
    } catch {
      setDocs([]);
      setStorageClientGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const typeLabels: Record<string, string> = {
    CONTRACT: 'Договор',
    ADDENDUM: 'Доп. соглашение',
    NDA: 'NDA',
    OTHER: 'Прочее',
  };
  const statusLabels: Record<string, string> = {
    ACTIVE: 'Активный',
    CLOSED: 'Закрыт',
  };

  const handleDelete = async (docId: string, docName: string) => {
    if (!confirm(`Удалить договор "${docName}"? Это действие нельзя отменить.`)) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/contracts/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDocs();
      } else {
        const data = await res.json();
        alert(data.error || 'Ошибка удаления');
      }
    } catch {
      alert('Ошибка соединения');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleClient = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const renderDocumentsView = () => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {loading ? (
        <div className="p-8 text-center text-gray-500">Загрузка...</div>
      ) : docs.length === 0 ? (
        <div className="p-8 text-center text-gray-500">Нет документов. Загрузите договор.</div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Номер</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата загрузки</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Кто загрузил</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Окончание</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td className="px-6 py-4 text-sm text-gray-900">{doc.client?.name ?? doc.clientId}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{typeLabels[doc.type] ?? doc.type}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{doc.docNumber ?? '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('ru') : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{doc.uploader?.fullName ?? '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {doc.endDate ? new Date(doc.endDate).toLocaleDateString('ru') : '—'}
                </td>
                <td className="px-6 py-4 text-sm">{statusLabels[doc.status] ?? doc.status}</td>
                <td className="px-6 py-4 text-sm">
                  <a href={`/api/contracts/${doc.id}/download`} className="text-blue-600 hover:underline mr-4">Скачать</a>
                  <Link href={`/contracts/${doc.id}`} className="text-blue-600 hover:underline mr-4">Карточка</Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id, doc.originalName)}
                    disabled={deletingId === doc.id}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deletingId === doc.id ? 'Удаление...' : 'Удалить'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ru') : '—';
  const formatMoney = (amount: string | number | null) => {
    if (amount == null) return '—';
    const n = Number(amount);
    if (isNaN(n)) return '—';
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(n / 100);
  };

  const renderClientsView = () => (
    <div className="space-y-3">
      {loading ? (
        <div className="p-8 text-center text-gray-500">Загрузка...</div>
      ) : storageClientGroups.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow">Нет документов.</div>
      ) : (
        storageClientGroups.map((group) => {
          const isExpanded = expandedClients.has(group.client.id);
          const totalDocs = group.contracts.length + group.invoices.length + group.closeoutDocs.length + group.periodReports.length;
          return (
            <div key={group.client.id} className="bg-white rounded-lg shadow overflow-hidden">
              <button
                type="button"
                onClick={() => toggleClient(group.client.id)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-lg font-semibold text-gray-900">{group.client.name}</span>
                </div>
                <div className="flex gap-2">
                  {group.contracts.length > 0 && (
                    <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">Договора: {group.contracts.length}</span>
                  )}
                  {group.invoices.length > 0 && (
                    <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Счета: {group.invoices.length}</span>
                  )}
                  {group.closeoutDocs.length > 0 && (
                    <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">Закрывающие: {group.closeoutDocs.length}</span>
                  )}
                  {group.periodReports.length > 0 && (
                    <span className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">Отчёты: {group.periodReports.length}</span>
                  )}
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-0.5 rounded-full">
                    {totalDocs} {docWord(totalDocs)}
                  </span>
                </div>
              </button>
              {isExpanded && (
                <div className="border-t divide-y divide-gray-100">
                  {/* Contracts */}
                  {group.contracts.length > 0 && (
                    <div className="px-6 py-3">
                      <h4 className="text-sm font-medium text-blue-700 mb-2">Договора ({group.contracts.length})</h4>
                      <div className="space-y-2">
                        {group.contracts.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between py-2 pl-4 bg-blue-50 rounded-md">
                            <div className="flex items-center gap-4 min-w-0">
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                {typeLabels[doc.type] ?? doc.type}
                              </span>
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {doc.docNumber || doc.originalName}
                              </span>
                              <span className="text-xs text-gray-400">{formatDate(doc.uploadedAt)}</span>
                              {doc.endDate && <span className="text-xs text-gray-400">до {formatDate(doc.endDate)}</span>}
                            </div>
                            <div className="flex items-center gap-3 pr-3 flex-shrink-0">
                              <a href={`/api/contracts/${doc.id}/download`} className="text-blue-600 hover:underline text-sm">Скачать</a>
                              <Link href={`/contracts/${doc.id}`} className="text-blue-600 hover:underline text-sm">Карточка</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoices */}
                  {group.invoices.length > 0 && (
                    <div className="px-6 py-3">
                      <h4 className="text-sm font-medium text-green-700 mb-2">Счета ({group.invoices.length})</h4>
                      <div className="space-y-2">
                        {group.invoices.map((inv: any) => (
                          <div key={inv.id} className="flex items-center justify-between py-2 pl-4 bg-green-50 rounded-md">
                            <div className="flex items-center gap-4 min-w-0">
                              <span className="text-sm font-medium text-gray-900">
                                {inv.invoiceNumber || `Счёт`}
                              </span>
                              <span className="text-sm text-gray-600">{formatMoney(inv.amount)}</span>
                              <span className="text-xs text-gray-500">{inv.legalEntity?.name}</span>
                              {inv.site && <span className="text-xs text-gray-400">{inv.site} — {inv.service}</span>}
                              {inv.periodFrom && (
                                <span className="text-xs text-gray-400">
                                  {formatDate(inv.periodFrom)} — {formatDate(inv.periodTo)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 pr-3 flex-shrink-0">
                              <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:underline text-sm">Открыть</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Closeout Documents */}
                  {group.closeoutDocs.length > 0 && (
                    <div className="px-6 py-3">
                      <h4 className="text-sm font-medium text-purple-700 mb-2">Закрывающие документы ({group.closeoutDocs.length})</h4>
                      <div className="space-y-2">
                        {group.closeoutDocs.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between py-2 pl-4 bg-purple-50 rounded-md">
                            <div className="flex items-center gap-4 min-w-0">
                              <span className="text-sm font-medium text-gray-900 truncate">{doc.originalName}</span>
                              <span className="text-xs text-gray-400">{formatDate(doc.uploadedAt)}</span>
                              {doc.site && <span className="text-xs text-gray-400">{doc.site} — {doc.service}</span>}
                              {doc.periodFrom && (
                                <span className="text-xs text-gray-400">
                                  {formatDate(doc.periodFrom)} — {formatDate(doc.periodTo)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 pr-3 flex-shrink-0">
                              <a href={`/api/closeout/${doc.id}/download`} className="text-blue-600 hover:underline text-sm">Скачать</a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Period Reports */}
                  {group.periodReports.length > 0 && (
                    <div className="px-6 py-3">
                      <h4 className="text-sm font-medium text-orange-700 mb-2">Отчёты по периодам ({group.periodReports.length})</h4>
                      <div className="space-y-2">
                        {group.periodReports.map((pr: any) => (
                          <div key={pr.id} className="flex items-center justify-between py-2 pl-4 bg-orange-50 rounded-md">
                            <div className="flex items-center gap-4 min-w-0">
                              <span className="text-sm font-medium text-gray-900 truncate">{pr.originalName}</span>
                              <span className="text-xs text-gray-400">{formatDate(pr.completedAt)}</span>
                              {pr.site && <span className="text-xs text-gray-400">{pr.site} — {pr.service}</span>}
                              {pr.periodFrom && (
                                <span className="text-xs text-gray-400">
                                  {formatDate(pr.periodFrom)} — {formatDate(pr.periodTo)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 pr-3 flex-shrink-0">
                              <a href={`/api/period-reports/${pr.id}/download`} className="text-blue-600 hover:underline text-sm">Скачать</a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Хранилище</h1>
        <Link
          href="/contracts/upload"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Загрузить
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <span className="text-sm font-medium text-gray-700">Вид:</span>
          <button
            type="button"
            onClick={() => setViewMode('documents')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'documents'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            По документам
          </button>
          <button
            type="button"
            onClick={() => setViewMode('clients')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'clients'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            По клиентам
          </button>
        </div>
        {viewMode === 'documents' && (
          <>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Фильтры</h3>
            <div className="flex flex-wrap gap-4">
              <input
                type="text"
                placeholder="Клиент (ID)"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="px-3 py-2 border rounded-md w-48"
              />
              <input
                type="text"
                placeholder="Сайт (ID)"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="px-3 py-2 border rounded-md w-48"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">Все статусы</option>
                <option value="ACTIVE">Активный</option>
                <option value="CLOSED">Закрыт</option>
              </select>
            </div>
          </>
        )}
      </div>

      {viewMode === 'documents' ? renderDocumentsView() : renderClientsView()}
    </div>
  );
}

function docWord(count: number): string {
  const abs = Math.abs(count) % 100;
  const lastDigit = abs % 10;
  if (abs >= 11 && abs <= 19) return 'документов';
  if (lastDigit === 1) return 'документ';
  if (lastDigit >= 2 && lastDigit <= 4) return 'документа';
  return 'документов';
}
