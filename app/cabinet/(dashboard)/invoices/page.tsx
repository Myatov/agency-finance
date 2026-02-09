'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

interface Invoice {
  id: string;
  amount: number;
  coverageFrom: string | null;
  coverageTo: string | null;
  invoiceNumber: string | null;
  publicToken: string | null;
  createdAt: string;
  legalEntityName: string;
  periodFrom: string;
  periodTo: string;
  productName: string;
  siteTitle: string;
}

export default function CabinetInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();

  useEffect(() => {
    fetch('/api/client-portal/invoices', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices ?? []))
      .finally(() => setLoading(false));
  }, []);

  const openDownload = (id: string) => {
    window.open(`/api/client-portal/invoices/${id}/download`, '_blank');
  };

  if (loading) return <div className="text-slate-500">Загрузка...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Счета</h2>
      {invoices.length === 0 ? (
        <p className="text-slate-500">Нет выставленных счетов</p>
      ) : (
        <ul className="space-y-3">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <div className="font-medium text-slate-800">
                  № {inv.invoiceNumber ?? '—'} · {(inv.amount / 100).toLocaleString('ru-RU')} ₽
                </div>
                <div className="text-sm text-slate-500">
                  {inv.productName} · {inv.siteTitle}
                </div>
                <div className="text-sm text-slate-500">
                  Период: {formatDate(inv.periodFrom)} — {formatDate(inv.periodTo)}
                </div>
                <div className="text-sm text-slate-500">Получатель: {inv.legalEntityName}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDownload(inv.id)}
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"
                >
                  Скачать счёт
                </button>
                {mounted && inv.publicToken && (
                  <img
                    src={`/api/qr?url=${encodeURIComponent(`${window.location.origin}/api/invoices/public/${inv.publicToken}/pdf`)}`}
                    alt="QR счёт"
                    className="w-10 h-10 border border-slate-200 rounded"
                    title="QR для скачивания счёта (можно отправить контрагенту)"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
