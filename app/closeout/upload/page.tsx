'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
}

interface CloseoutPackage {
  id: string;
  period: string;
  status: string;
}

const docTypeLabels: Record<string, string> = {
  ACT: 'Акт выполненных работ',
  INVOICE: 'Счёт',
  SF: 'Счёт-фактура',
  UPD: 'УПД',
  RECONCILIATION: 'Акт сверки',
  REPORT: 'Отчёт',
  OTHER: 'Прочее',
};

export default function CloseoutUploadPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [packages, setPackages] = useState<CloseoutPackage[]>([]);
  const [clientId, setClientId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [period, setPeriod] = useState('');
  const [docType, setDocType] = useState('ACT');
  const [docDate, setDocDate] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [comment, setComment] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const clientIdFromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('clientId') : null;
  const packageIdFromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('packageId') : null;

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (clientIdFromUrl && clients.length) setClientId(clientIdFromUrl);
    if (packageIdFromUrl) setPackageId(packageIdFromUrl);
  }, [clientIdFromUrl, packageIdFromUrl, clients]);

  useEffect(() => {
    if (clientId) {
      fetch(`/api/closeout/packages?clientId=${clientId}`)
        .then((r) => r.json())
        .then((data) => setPackages(data.packages || []));
    } else {
      setPackages([]);
      setPackageId('');
    }
  }, [clientId]);

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    const data = await res.json();
    setClients(data.clients || []);
  };

  const resolvedPeriod = period || (packageId ? packages.find((p) => p.id === packageId)?.period : '') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!clientId) {
      setError('Выберите клиента');
      return;
    }
    if (!file || file.size === 0) {
      setError('Выберите файл');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('clientId', clientId);
      if (packageId) form.set('packageId', packageId);
      if (resolvedPeriod) form.set('period', resolvedPeriod);
      form.set('docType', docType);
      if (docDate) form.set('docDate', docDate);
      if (amount) form.set('amount', amount);
      form.set('status', status);
      if (comment) form.set('comment', comment);

      const res = await fetch('/api/closeout/documents', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка загрузки');
        setLoading(false);
        return;
      }
      setSuccess(true);
      setFile(null);
      setComment('');
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/closeout" className="text-gray-600 hover:text-gray-900">← Закрывающие документы</Link>
          <h1 className="text-3xl font-bold">Загрузить документ</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Клиент *</label>
            <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full px-3 py-2 border rounded-md">
              <option value="">Выберите клиента</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Пакет периода</label>
            <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className="w-full px-3 py-2 border rounded-md">
              <option value="">— Без пакета</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>{p.period}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Период</label>
            <input type="text" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-02" className="w-full px-3 py-2 border rounded-md" />
            {packageId && !period && <p className="text-xs text-gray-500 mt-1">Можно взять из пакета: {resolvedPeriod || '—'}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип документа</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full px-3 py-2 border rounded-md">
              {Object.entries(docTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Файл *</label>
            <input type="file" required accept=".pdf,.doc,.docx,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full px-3 py-2 border rounded-md" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата документа</label>
              <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Сумма</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border rounded-md">
              <option value="DRAFT">Черновик</option>
              <option value="SIGNED">Подписан</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-md" />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">Документ загружен.</div>}

          <div className="flex gap-4">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{loading ? 'Загрузка...' : 'Загрузить'}</button>
            <Link href="/closeout" className="px-4 py-2 border rounded-md hover:bg-gray-50">Отмена</Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
