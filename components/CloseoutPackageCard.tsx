'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CloseoutDoc {
  id: string;
  docType: string;
  originalName: string;
  docDate: string | null;
  amount: string | null;
  status: string;
  uploadedAt: string;
  uploader?: { fullName: string };
}

interface CloseoutPackageData {
  id: string;
  clientId: string;
  client: { id: string; name: string };
  period: string;
  periodType: string;
  status: string;
  amount: string | null;
  documents: CloseoutDoc[];
}

const docTypeLabels: Record<string, string> = {
  ACT: 'Акт',
  INVOICE: 'Счёт',
  SF: 'Счёт-фактура',
  UPD: 'УПД',
  RECONCILIATION: 'Акт сверки',
  REPORT: 'Отчёт',
  OTHER: 'Прочее',
};
const statusLabels: Record<string, string> = {
  PREPARING: 'Готовится',
  SENT: 'Отправлено',
  SIGNED: 'Подписано',
};
const docStatusLabels: Record<string, string> = {
  DRAFT: 'Черновик',
  SIGNED: 'Подписан',
};

export default function CloseoutPackageCard({ packageId }: { packageId: string }) {
  const [pkg, setPkg] = useState<CloseoutPackageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/closeout/packages/${packageId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.package) setPkg(data.package);
        else setError(data.error || 'Не найдено');
      })
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [packageId]);

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Удалить документ?')) return;
    const res = await fetch(`/api/closeout/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) {
      setPkg((prev) => prev ? { ...prev, documents: prev.documents.filter((d) => d.id !== docId) } : null);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Загрузка...</div>;
  if (error || !pkg) return <div className="p-8 text-center text-red-600">{error || 'Не найдено'}</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/closeout" className="text-gray-600 hover:text-gray-900">← Закрывающие документы</Link>
        <h1 className="text-2xl font-bold">Пакет: {pkg.period}</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-500">Клиент</p>
            <p className="font-medium">{pkg.client.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              Статус: {statusLabels[pkg.status] ?? pkg.status}
              {pkg.amount != null && ` · Сумма: ${pkg.amount}`}
            </p>
          </div>
          <Link
            href={`/closeout/upload?clientId=${pkg.clientId}&packageId=${pkg.id}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Загрузить документ
          </Link>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Документы в пакете</h3>
          {pkg.documents.length === 0 ? (
            <p className="text-sm text-gray-500">Нет документов. Загрузите акт, отчёт и т.д.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Файл</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Сумма</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pkg.documents.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2 text-sm">{docTypeLabels[d.docType] ?? d.docType}</td>
                    <td className="px-4 py-2 text-sm">{d.originalName}</td>
                    <td className="px-4 py-2 text-sm">{d.docDate ? new Date(d.docDate).toLocaleDateString('ru') : '—'}</td>
                    <td className="px-4 py-2 text-sm">{d.amount ?? '—'}</td>
                    <td className="px-4 py-2 text-sm">{docStatusLabels[d.status] ?? d.status}</td>
                    <td className="px-4 py-2 text-sm">
                      <a href={`/api/closeout/documents/${d.id}/download`} className="text-blue-600 hover:underline mr-2">Скачать</a>
                      <button type="button" onClick={() => handleDeleteDoc(d.id)} className="text-red-600 hover:underline">Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
