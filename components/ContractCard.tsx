'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ContractSection {
  id: string;
  title: string;
  comment: string | null;
  siteId: string | null;
  serviceId: string | null;
  site?: { id: string; title: string } | null;
}

interface ContractChild {
  id: string;
  type: string;
  originalName: string;
  docNumber: string | null;
  uploadedAt: string;
  uploader?: { fullName: string };
  site?: { title: string } | null;
}

interface Contract {
  id: string;
  clientId: string;
  client: { id: string; name: string };
  siteId: string | null;
  site?: { id: string; title: string } | null;
  type: string;
  parentId: string | null;
  filePath: string;
  originalName: string;
  docNumber: string | null;
  docDate: string | null;
  endDate: string | null;
  comment: string | null;
  tags: string | null;
  status: string;
  uploadedAt: string;
  uploader?: { fullName: string };
  sections: ContractSection[];
  children: ContractChild[];
}

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

export default function ContractCard({ contractId }: { contractId: string }) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ docNumber: '', docDate: '', endDate: '', comment: '', tags: '', status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionComment, setNewSectionComment] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [replacingFile, setReplacingFile] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchContract();
  }, [contractId]);

  useEffect(() => {
    if (contract) {
      setEditForm({
        docNumber: contract.docNumber ?? '',
        docDate: contract.docDate ? contract.docDate.slice(0, 10) : '',
        endDate: contract.endDate ? contract.endDate.slice(0, 10) : '',
        comment: contract.comment ?? '',
        tags: contract.tags ?? '',
        status: contract.status,
      });
    }
  }, [contract]);

  const fetchContract = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/contracts/${contractId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка загрузки');
        setContract(null);
        return;
      }
      setContract(data.contract);
    } catch {
      setError('Ошибка соединения');
      setContract(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMeta = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docNumber: editForm.docNumber || null,
          docDate: editForm.docDate || null,
          endDate: editForm.endDate || null,
          comment: editForm.comment || null,
          tags: editForm.tags || null,
          status: editForm.status,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setContract(data.contract);
        setEditing(false);
      } else {
        const data = await res.json();
        setError(data.error || 'Ошибка сохранения');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddSection = async () => {
    if (!contract || !newSectionTitle.trim()) return;
    setAddingSection(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSectionTitle.trim(), comment: newSectionComment.trim() || undefined }),
      });
      if (res.ok) {
        setNewSectionTitle('');
        setNewSectionComment('');
        fetchContract();
      }
    } finally {
      setAddingSection(false);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Удалить секцию?')) return;
    try {
      const res = await fetch(`/api/contracts/${contractId}/sections/${sectionId}`, { method: 'DELETE' });
      if (res.ok) fetchContract();
    } catch {}
  };

  const handleReplaceFile = async () => {
    if (!contract || !replacementFile) return;
    setReplacing(true);
    setError('');
    try {
      const form = new FormData();
      form.set('file', replacementFile);
      const res = await fetch(`/api/contracts/${contractId}`, { method: 'PUT', body: form });
      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {
        console.error('Failed to parse response:', e);
        setError('Ошибка обработки ответа сервера');
        setReplacing(false);
        return;
      }
      if (res.ok) {
        if (data.contract) {
          setContract(data.contract);
          setReplacingFile(false);
          setReplacementFile(null);
        } else {
          setError('Неверный формат ответа от сервера');
        }
      } else {
        setError(data.error || 'Ошибка замены файла');
      }
    } catch (error: any) {
      console.error('Error replacing file:', error);
      setError(error.message || 'Ошибка соединения');
    } finally {
      setReplacing(false);
    }
  };

  const handleDelete = async () => {
    if (!contract) return;
    const confirmMsg = contract.children.length > 0
      ? `Удалить договор и все его приложения (${contract.children.length} шт.)? Это действие нельзя отменить.`
      : 'Удалить договор? Это действие нельзя отменить.';
    if (!confirm(confirmMsg)) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/contracts/${contractId}`, { method: 'DELETE' });
      if (res.ok) {
        window.location.href = '/contracts';
      } else {
        const data = await res.json();
        setError(data.error || 'Ошибка удаления');
        setDeleting(false);
      }
    } catch {
      setError('Ошибка соединения');
      setDeleting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Загрузка...</div>;
  if (error || !contract) return <div className="p-8 text-center text-red-600">{error || 'Не найдено'}</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/contracts" className="text-gray-600 hover:text-gray-900">← Договора</Link>
        <h1 className="text-2xl font-bold">{contract.originalName}</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-500">Клиент</p>
            <p className="font-medium">{contract.client.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              {typeLabels[contract.type] ?? contract.type} · {statusLabels[contract.status] ?? contract.status}
              {contract.site && ` · ${contract.site.title}`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href={`/api/contracts/${contractId}/download`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Скачать</a>
            {!editing ? (
              <>
                <button type="button" onClick={() => setEditing(true)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">Редактировать</button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleSaveMeta} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm">Сохранить</button>
                <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">Отмена</button>
              </>
            )}
            <button type="button" onClick={() => setReplacingFile(true)} className="px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 text-sm">Заменить файл</button>
            <button type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm">
              {deleting ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        </div>

        {error && <div className="text-red-600 text-sm border-t pt-4">{error}</div>}

        {replacingFile && (
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-medium">Заменить файл</h3>
            <p className="text-sm text-gray-600">Текущий файл: {contract.originalName}</p>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Новый файл *</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => setReplacementFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReplaceFile}
                disabled={replacing || !replacementFile}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm"
              >
                {replacing ? 'Замена...' : 'Заменить'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplacingFile(false);
                  setReplacementFile(null);
                }}
                disabled={replacing}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {editing ? (
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Номер документа</label>
              <input value={editForm.docNumber} onChange={(e) => setEditForm({ ...editForm, docNumber: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Статус</label>
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                <option value="ACTIVE">Активный</option>
                <option value="CLOSED">Закрыт</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Дата документа</label>
              <input type="date" value={editForm.docDate} onChange={(e) => setEditForm({ ...editForm, docDate: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Дата окончания договора</label>
              <input type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Комментарий</label>
              <textarea value={editForm.comment} onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Теги</label>
              <input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} className="w-full px-3 py-2 border rounded-md" placeholder="SEO, Dev, SMM" />
            </div>
          </div>
        ) : (
          <div className="border-t pt-4 text-sm text-gray-600">
            {contract.docNumber && <p><span className="text-gray-500">Номер:</span> {contract.docNumber}</p>}
            {contract.docDate && <p><span className="text-gray-500">Дата документа:</span> {new Date(contract.docDate).toLocaleDateString('ru')}</p>}
            {contract.endDate && <p><span className="text-gray-500">Окончание договора:</span> {new Date(contract.endDate).toLocaleDateString('ru')}</p>}
            {contract.comment && <p><span className="text-gray-500">Комментарий:</span> {contract.comment}</p>}
            {contract.tags && <p><span className="text-gray-500">Теги:</span> {contract.tags}</p>}
            <p><span className="text-gray-500">Загрузил:</span> {contract.uploader?.fullName ?? '—'} · {contract.uploadedAt ? new Date(contract.uploadedAt).toLocaleString('ru') : '—'}</p>
          </div>
        )}

        {/* Секции внутри файла */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Секции внутри файла</h3>
          {contract.sections.length === 0 && !newSectionTitle ? (
            <p className="text-sm text-gray-500">Нет секций. Добавьте опционально.</p>
          ) : (
            <ul className="list-disc list-inside space-y-1 mb-4">
              {contract.sections.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span>{s.title}{s.comment ? ` — ${s.comment}` : ''}</span>
                  <button type="button" onClick={() => handleDeleteSection(s.id)} className="text-red-600 text-xs hover:underline">Удалить</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 flex-wrap items-end">
            <input
              type="text"
              placeholder="Название секции (напр. Приложение №1 — SEO)"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              className="px-3 py-2 border rounded-md flex-1 min-w-[200px]"
            />
            <input
              type="text"
              placeholder="Комментарий"
              value={newSectionComment}
              onChange={(e) => setNewSectionComment(e.target.value)}
              className="px-3 py-2 border rounded-md w-48"
            />
            <button type="button" onClick={handleAddSection} disabled={addingSection || !newSectionTitle.trim()} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 text-sm">Добавить секцию</button>
          </div>
        </div>

        {/* Приложения (дети) */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Приложения к договору</h3>
          {contract.children.length === 0 ? (
            <p className="text-sm text-gray-500 mb-2">Нет приложений.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {contract.children.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-1 border-b border-gray-100">
                  <span className="text-sm">{c.originalName} {c.docNumber ? `№ ${c.docNumber}` : ''} · {typeLabels[c.type] ?? c.type}</span>
                  <div className="flex gap-2">
                    <a href={`/api/contracts/${c.id}/download`} className="text-blue-600 text-sm hover:underline">Скачать</a>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Удалить приложение "${c.originalName}"?`)) {
                          try {
                            const res = await fetch(`/api/contracts/${c.id}`, { method: 'DELETE' });
                            if (res.ok) {
                              fetchContract();
                            } else {
                              const data = await res.json();
                              setError(data.error || 'Ошибка удаления');
                            }
                          } catch {
                            setError('Ошибка соединения');
                          }
                        }
                      }}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/contracts/upload?clientId=${contract.clientId}&parentId=${contractId}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Загрузить приложение
          </Link>
        </div>
      </div>
    </div>
  );
}
