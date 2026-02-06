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

interface CloseoutPackage {
  id: string;
  clientId: string;
  period: string;
  status: string;
  amount: number | null;
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
  const [tab, setTab] = useState<'contracts' | 'closeout'>('contracts');
  const [contracts, setContracts] = useState<ContractDoc[]>([]);
  const [packages, setPackages] = useState<CloseoutPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/contracts?clientId=${clientId}`).then((r) => r.json()),
      fetch(`/api/closeout/packages?clientId=${clientId}`).then((r) => r.json()),
    ]).then(([contractsRes, closeoutRes]) => {
      setContracts(contractsRes.contracts || []);
      setPackages(closeoutRes.packages || []);
    }).finally(() => setLoading(false));
  }, [clientId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Документы клиента: {clientName}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex gap-2 border-b mb-4">
          <button
            type="button"
            onClick={() => setTab('contracts')}
            className={`px-4 py-2 rounded-t ${tab === 'contracts' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}
          >
            Договора
          </button>
          <button
            type="button"
            onClick={() => setTab('closeout')}
            className={`px-4 py-2 rounded-t ${tab === 'closeout' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}
          >
            Закрывающие документы
          </button>
        </div>

        <div className="flex justify-end mb-2">
          {tab === 'contracts' ? (
            <Link
              href={`/contracts/upload?clientId=${clientId}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Загрузить
            </Link>
          ) : (
            <Link
              href={`/closeout?clientId=${clientId}`}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
            >
              К разделу Закрывающие
            </Link>
          )}
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="py-8 text-center text-gray-500">Загрузка...</div>
          ) : tab === 'contracts' ? (
            contracts.length === 0 ? (
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
            )
          ) : (
            packages.length === 0 ? (
              <div className="py-8 text-center text-gray-500">Нет пакетов закрытия.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Период</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Сумма</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {packages.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-sm">{p.period}</td>
                      <td className="px-4 py-2 text-sm">{p.status}</td>
                      <td className="px-4 py-2 text-sm">{p.amount != null ? Number(p.amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
}
