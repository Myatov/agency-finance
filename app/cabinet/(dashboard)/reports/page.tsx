'use client';

import { useEffect, useState } from 'react';

interface Report {
  id: string;
  originalName: string;
  completedAt: string;
  periodFrom: string;
  periodTo: string;
  productName: string;
  siteTitle: string;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU');
}

export default function CabinetReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client-portal/reports', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setReports(d.reports ?? []))
      .finally(() => setLoading(false));
  }, []);

  const openDownload = (id: string) => {
    window.open(`/api/client-portal/documents/report/${id}`, '_blank');
  };

  if (loading) return <div className="text-slate-500">Загрузка...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Отчёты</h2>
      {reports.length === 0 ? (
        <p className="text-slate-500">Пока нет загруженных отчётов</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <div className="font-medium text-slate-800">{r.originalName}</div>
                <div className="text-sm text-slate-500">
                  {r.productName} · {r.siteTitle}
                </div>
                <div className="text-sm text-slate-500">
                  Период: {formatDate(r.periodFrom)} — {formatDate(r.periodTo)}
                </div>
                <div className="text-sm text-slate-500">
                  Загружен: {formatDate(r.completedAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openDownload(r.id)}
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
