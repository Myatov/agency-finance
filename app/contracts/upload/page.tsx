'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  sites: Array<{ id: string; title: string }>;
}

interface ContractDoc {
  id: string;
  clientId: string;
  type: string;
  docNumber: string | null;
  originalName: string;
}

export default function ContractUploadPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [rootContracts, setRootContracts] = useState<ContractDoc[]>([]);
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [type, setType] = useState('CONTRACT');
  const [parentId, setParentId] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const clientIdFromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('clientId') : null;

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (clientIdFromUrl && clients.length) {
      setClientId(clientIdFromUrl);
    }
  }, [clientIdFromUrl, clients]);

  useEffect(() => {
    if (clientId) {
      fetchRootContracts();
    } else {
      setRootContracts([]);
      setParentId('');
    }
  }, [clientId]);

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    const data = await res.json();
    setClients(data.clients || []);
  };

  const fetchRootContracts = async () => {
    const res = await fetch(`/api/contracts?clientId=${clientId}`);
    const data = await res.json();
    setRootContracts(data.contracts || []);
  };

  const sites = clientId ? (clients.find((c) => c.id === clientId)?.sites || []) : [];

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
      if (siteId) form.set('siteId', siteId);
      form.set('type', type);
      if (parentId) form.set('parentId', parentId);
      if (docNumber) form.set('docNumber', docNumber);
      if (docDate) form.set('docDate', docDate);
      if (endDate) form.set('endDate', endDate);
      if (comment) form.set('comment', comment);
      if (tags) form.set('tags', tags);
      form.set('status', status);

      const res = await fetch('/api/contracts', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка загрузки');
        setLoading(false);
        return;
      }
      setSuccess(true);
      setFile(null);
      setDocNumber('');
      setComment('');
      setTags('');
      if (parentId) setParentId('');
      fetchRootContracts();
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
          <Link href="/contracts" className="text-gray-600 hover:text-gray-900">
            ← Договора
          </Link>
          <h1 className="text-3xl font-bold">Загрузить документ</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Клиент *</label>
            <select
              required
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setSiteId(''); }}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Выберите клиента</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Сайт</label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">—</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border rounded-md">
              <option value="CONTRACT">Договор</option>
              <option value="ADDENDUM">Доп. соглашение</option>
              <option value="NDA">NDA</option>
              <option value="OTHER">Прочее</option>
            </select>
          </div>

          {clientId && rootContracts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Приложение к договору</label>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full px-3 py-2 border rounded-md">
                <option value="">Нет (новый договор)</option>
                {rootContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.originalName} {c.docNumber ? `№ ${c.docNumber}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Файл *</label>
            <input
              type="file"
              required
              accept=".pdf,.doc,.docx,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Номер документа</label>
            <input
              type="text"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата документа</label>
              <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания договора</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-md" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Теги (SEO, Dev, SMM…)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="через запятую" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border rounded-md">
              <option value="ACTIVE">Активный</option>
              <option value="CLOSED">Закрыт</option>
            </select>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">Документ загружен.</div>}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Загрузка...' : 'Загрузить'}
            </button>
            <Link href="/contracts" className="px-4 py-2 border rounded-md hover:bg-gray-50">Отмена</Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
