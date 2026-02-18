'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface ClientGroup {
  client: { id: string; name: string };
  contracts: Array<{
    id: string;
    type: string;
    docNumber: string | null;
    docDate: string | null;
    endDate: string | null;
    status: string;
    uploadedAt: string;
    originalName: string;
    uploader?: { fullName: string };
    site?: { title: string } | null;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: string;
    createdAt: string;
    legalEntity?: { name: string };
    service: string;
    site: string;
    periodFrom?: string;
    periodTo?: string;
  }>;
  closeoutDocs: Array<{
    id: string;
    docType: string;
    originalName: string;
    uploadedAt: string;
    uploader?: { fullName: string };
    service: string;
    site: string;
    periodFrom?: string;
    periodTo?: string;
  }>;
  periodReports: Array<{
    id: string;
    paymentType: string;
    originalName: string;
    completedAt: string;
    accountManager?: { fullName: string };
    service: string;
    site: string;
    periodFrom?: string;
    periodTo?: string;
  }>;
}

const typeLabels: Record<string, string> = {
  CONTRACT: 'Договор',
  ADDENDUM: 'Доп. соглашение',
  NDA: 'NDA',
  OTHER: 'Прочее',
};

const docTypeLabels: Record<string, string> = {
  ACT: 'Акт',
  INVOICE: 'Счёт',
  SF: 'Счёт-фактура',
  UPD: 'УПД',
  RECONCILIATION: 'Акт сверки',
  REPORT: 'Отчёт',
  OTHER: 'Прочее',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function formatMoney(amount: string | number): string {
  const n = Number(amount) / 100;
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(n);
}

export default function StoragePage() {
  const [viewMode, setViewMode] = useState<'sections' | 'byClient'>('sections');
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (viewMode === 'byClient') {
      setLoading(true);
      fetch('/api/storage/by-client')
        .then((r) => r.json())
        .then((d) => {
          setClientGroups(d.clientGroups || []);
          if (d.clientGroups?.length > 0 && !selectedClientId) {
            setSelectedClientId(d.clientGroups[0].client.id);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [viewMode]);

  const selectedGroup = clientGroups.find((g) => g.client.id === selectedClientId);

  return (
    <Layout>
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Хранилище</h1>

        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm font-medium text-gray-700">Вид:</span>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('sections')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'sections' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              По разделам
            </button>
            <button
              type="button"
              onClick={() => setViewMode('byClient')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'byClient' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              По клиенту
            </button>
          </div>
        </div>

        {viewMode === 'sections' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <ul className="divide-y divide-gray-200">
              <li>
                <Link
                  href="/contracts"
                  className="block px-6 py-4 hover:bg-gray-50 text-blue-600 font-medium"
                >
                  Договора
                </Link>
              </li>
              <li>
                <Link
                  href="/invoices"
                  className="block px-6 py-4 hover:bg-gray-50 text-blue-600 font-medium"
                >
                  Счета
                </Link>
              </li>
              <li>
                <Link
                  href="/closeout"
                  className="block px-6 py-4 hover:bg-gray-50 text-blue-600 font-medium"
                >
                  Закрывающие документы
                </Link>
              </li>
            </ul>
          </div>
        )}

        {viewMode === 'byClient' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Клиент</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md"
                disabled={loading}
              >
                <option value="">Выберите клиента</option>
                {clientGroups.map((g) => (
                  <option key={g.client.id} value={g.client.id}>
                    {g.client.name}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">Загрузка...</div>
            ) : !selectedGroup ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                {clientGroups.length === 0 ? 'Нет клиентов с документами' : 'Выберите клиента'}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">{selectedGroup.client.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Договора: {selectedGroup.contracts.length} · Счета: {selectedGroup.invoices.length} · Закрывающие: {selectedGroup.closeoutDocs.length} · Отчёты: {selectedGroup.periodReports.length}
                  </p>
                </div>
                <div className="divide-y divide-gray-200 max-h-[60vh] overflow-y-auto">
                  {selectedGroup.contracts.length > 0 && (
                    <div className="px-6 py-4">
                      <h3 className="text-sm font-semibold text-blue-700 mb-3">Договора ({selectedGroup.contracts.length})</h3>
                      <div className="space-y-2">
                        {selectedGroup.contracts.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between py-2 pl-4 bg-blue-50 rounded-md">
                            <div className="flex items-center gap-4 min-w-0">
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{typeLabels[doc.type] ?? doc.type}</span>
                              <span className="text-sm font-medium text-gray-900 truncate">{doc.docNumber || doc.originalName}</span>
                              {doc.site && <span className="text-xs text-gray-500">{'title' in doc.site ? doc.site.title : ''}</span>}
                              <span className="text-xs text-gray-400">{formatDate(doc.uploadedAt)}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <a href={`/api/contracts/${doc.id}/download`} className="text-blue-600 hover:underline text-sm">Скачать</a>
                              <Link href={`/contracts/${doc.id}`} className="text-blue-600 hover:underline text-sm">Карточка</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedGroup.invoices.length > 0 && (
                    <div className="px-6 py-4">
                      <h3 className="text-sm font-semibold text-green-700 mb-3">Счета ({selectedGroup.invoices.length})</h3>
                      <div className="space-y-2">
                        {selectedGroup.invoices.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between py-2 pl-4 bg-green-50 rounded-md">
                            <div className="flex items-center gap-4 min-w-0">
                              <span className="text-sm font-medium text-gray-900">{inv.invoiceNumber || 'Счёт'}</span>
                              <span className="text-sm text-gray-600">{formatMoney(inv.amount)}</span>
                              {inv.site && <span className="text-xs text-gray-500">{inv.site} — {inv.service}</span>}
                              {inv.periodFrom && <span className="text-xs text-gray-400">{formatDate(inv.periodFrom)} — {formatDate(inv.periodTo)}</span>}
                            </div>
                            <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:underline text-sm">Открыть</Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedGroup.closeoutDocs.length > 0 && (
                    <div className="px-6 py-4">
                      <h3 className="text-sm font-semibold text-purple-700 mb-3">Закрывающие документы ({selectedGroup.closeoutDocs.length})</h3>
                      <div className="space-y-2">
                        {selectedGroup.closeoutDocs.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between py-2 pl-4 bg-purple-50 rounded-md">
                            <div className="flex items-center gap-4 min-w-0">
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">{docTypeLabels[doc.docType] ?? doc.docType}</span>
                              <span className="text-sm font-medium text-gray-900 truncate">{doc.originalName}</span>
                              {doc.site && <span className="text-xs text-gray-500">{doc.site} — {doc.service}</span>}
                              <span className="text-xs text-gray-400">{formatDate(doc.uploadedAt)}</span>
                            </div>
                            <a href={`/api/closeout/documents/${doc.id}/download`} className="text-blue-600 hover:underline text-sm">Скачать</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedGroup.periodReports.length > 0 && (
                    <div className="px-6 py-4">
                      <h3 className="text-sm font-semibold text-orange-700 mb-3">Отчёты по периодам ({selectedGroup.periodReports.length})</h3>
                      <div className="space-y-2">
                        {selectedGroup.periodReports.map((pr) => (
                          <div key={pr.id} className="flex items-center justify-between py-2 pl-4 bg-orange-50 rounded-md">
                            <div className="flex items-center gap-4 min-w-0">
                              <span className="text-sm font-medium text-gray-900 truncate">{pr.originalName}</span>
                              {pr.site && <span className="text-xs text-gray-500">{pr.site} — {pr.service}</span>}
                              <span className="text-xs text-gray-400">{formatDate(pr.completedAt)}</span>
                            </div>
                            <a href={`/api/period-reports/${pr.id}/download`} className="text-blue-600 hover:underline text-sm">Скачать</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedGroup.contracts.length === 0 &&
                    selectedGroup.invoices.length === 0 &&
                    selectedGroup.closeoutDocs.length === 0 &&
                    selectedGroup.periodReports.length === 0 && (
                      <div className="px-6 py-8 text-center text-gray-500">Нет документов по этому клиенту</div>
                    )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
