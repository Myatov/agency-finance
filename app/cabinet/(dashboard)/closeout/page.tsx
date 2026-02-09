'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';

interface Doc {
  id: string;
  originalName: string;
  docType: string;
  docDate: string | null;
  amount: number | null;
  uploadedAt: string;
  period: string | null;
}

const docTypeLabel: Record<string, string> = {
  ACT: 'Акт',
  INVOICE: 'Счёт',
  SF: 'Счёт-фактура',
  UPD: 'УПД',
  RECONCILIATION: 'Акт сверки',
  REPORT: 'Отчёт',
  OTHER: 'Прочее',
};

export default function CabinetCloseoutPage() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [showClosingDocs, setShowClosingDocs] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client-portal/closeout-documents', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setDocuments(d.documents ?? []);
        setShowClosingDocs(d.showClosingDocs ?? false);
      })
      .finally(() => setLoading(false));
  }, []);

  const openDownload = (id: string) => {
    window.open(`/api/client-portal/documents/closeout/${id}`, '_blank');
  };

  if (loading) return <div className="text-slate-500">Загрузка...</div>;

  if (!showClosingDocs) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Закрывающие документы</h2>
        <p className="text-slate-500">
          Для вашего юрлица закрывающие документы не формируются. Если нужны акты и отчёты, уточните у менеджера.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Закрывающие документы</h2>
      {documents.length === 0 ? (
        <p className="text-slate-500">Пока нет загруженных документов</p>
      ) : (
        <ul className="space-y-3">
          {documents.map((d) => (
            <li
              key={d.id}
              className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <div className="font-medium text-slate-800">{d.originalName}</div>
                <div className="text-sm text-slate-500">
                  {docTypeLabel[d.docType] ?? d.docType}
                  {d.period && ` · ${d.period}`}
                  {d.docDate && ` · ${formatDate(d.docDate)}`}
                  {d.amount != null && ` · ${(d.amount / 100).toLocaleString('ru-RU')} ₽`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openDownload(d.id)}
                className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"
              >
                Скачать
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
