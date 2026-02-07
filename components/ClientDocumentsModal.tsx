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
  uploader?: { fullName: string };
  site?: { title: string } | null;
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

export default function ClientDocumentsModal({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [contracts, setContracts] = useState<ContractDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/contracts?clientId=${clientId}`)
      .then((r) => r.json())
      .then((data) => setContracts(data.contracts || []))
      .finally(() => setLoading(false));
  }, [clientId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Документы клиента: {clientName}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex justify-end mb-2">
          <Link
            href={`/contracts/upload?clientId=${clientId}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Загрузить
          </Link>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="py-8 text-center text-gray-500">Загрузка...</div>
          ) : contracts.length === 0 ? (
            <div className="py-8 text-center text-gray-500">Нет договоров. Загрузите документ.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Номер</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Дата загрузки</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Окончание</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contracts.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-4 py-2 text-sm">{typeLabels[doc.type] ?? doc.type}</td>
                    <td className="px-4 py-2 text-sm">{doc.docNumber ?? '—'}</td>
                    <td className="px-4 py-2 text-sm">{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('ru') : '—'}</td>
                    <td className="px-4 py-2 text-sm">{doc.endDate ? new Date(doc.endDate).toLocaleDateString('ru') : '—'}</td>
                    <td className="px-4 py-2 text-sm">{statusLabels[doc.status] ?? doc.status}</td>
                    <td className="px-4 py-2 text-sm">
                      <a href={`/api/contracts/${doc.id}/download`} className="text-blue-600 hover:underline mr-2">Скачать</a>
                      <Link href={`/contracts/${doc.id}`} className="text-blue-600 hover:underline">Карточка</Link>
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
