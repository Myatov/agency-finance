'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatAmount, formatDate, getAppUrlBase } from '@/lib/utils';

interface InvoiceLine {
  id: string;
  amount: string;
  serviceNameOverride: string | null;
  siteNameOverride: string | null;
  workPeriod?: { dateFrom: string; dateTo: string; service: { product: { name: string }; site: { title: string } } };
}

interface Invoice {
  id: string;
  amount: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  publicToken: string | null;
  legalEntity: { id: string; name: string };
  payments: Array<{ id: string; amount: string; paidAt: string }>;
  lines?: InvoiceLine[];
  workPeriod?: {
    service: {
      site: {
        client?: { id: string; name: string };
        title?: string;
      };
    };
  };
}

export default function InvoicesList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState<{
    invoiceNumber: string;
    invoiceDate: string;
    lines: { id: string; serviceNameOverride: string; siteNameOverride: string }[];
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = () => {
    setLoading(true);
    fetch('/api/invoices')
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openPrint = (id: string) => {
    window.open(`/api/invoices/${id}/pdf`, '_blank');
  };

  const openEditInvoice = async (inv: Invoice) => {
    const res = await fetch(`/api/invoices/${inv.id}`);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Не удалось загрузить счёт');
      return;
    }
    const full = data.invoice as Invoice & { invoiceDate?: string };
    setEditingInvoice(full);
    setEditForm({
      invoiceNumber: full.invoiceNumber ?? '',
      invoiceDate: full.invoiceDate ? String(full.invoiceDate).slice(0, 10) : '',
      lines: (full.lines ?? []).map((l) => ({
        id: l.id,
        serviceNameOverride: l.serviceNameOverride ?? '',
        siteNameOverride: l.siteNameOverride ?? '',
      })),
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice || !editForm) return;
    const resInv = await fetch(`/api/invoices/${editingInvoice.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: editForm.invoiceNumber.trim() || null,
        invoiceDate: editForm.invoiceDate || null,
      }),
    });
    if (!resInv.ok) {
      const err = await resInv.json();
      alert(err.error || 'Ошибка сохранения счёта');
      return;
    }
    for (const row of editForm.lines) {
      await fetch(`/api/invoices/${editingInvoice.id}/lines/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceNameOverride: row.serviceNameOverride.trim() || null,
          siteNameOverride: row.siteNameOverride.trim() || null,
        }),
      });
    }
    setEditingInvoice(null);
    setEditForm(null);
    load();
  };

  const clientName = (inv: Invoice) => inv.workPeriod?.service?.site?.client?.name ?? '—';

  const baseUrl = mounted ? getAppUrlBase() : '';

  if (loading) return <div className="py-8 text-gray-500">Загрузка...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Счета</h1>
      <p className="text-gray-600 mb-6">Все выставленные счета. Печать счёта открывает PDF в новом окне для скачивания или печати.</p>

      {invoices.length === 0 ? (
        <p className="text-gray-500">Нет выставленных счетов.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {invoices.map((inv) => (
              <li key={inv.id} className="p-4 hover:bg-gray-50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="font-medium">№ {inv.invoiceNumber || inv.id.slice(0, 8)}</span>
                  <span className="text-gray-500 mx-2">—</span>
                  <span>{clientName(inv)}</span>
                  <span className="text-gray-500 mx-2">·</span>
                  <span>{inv.legalEntity.name}</span>
                  <span className="text-gray-500 mx-2">·</span>
                  <span>{formatAmount(inv.amount)}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openEditInvoice(inv)}
                    className="text-slate-600 hover:underline text-sm"
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    onClick={() => openPrint(inv.id)}
                    className="px-3 py-1 bg-teal-600 text-white rounded text-sm hover:bg-teal-700"
                  >
                    Печать счёта
                  </button>
                  {inv.publicToken && baseUrl && (
                    <span className="inline-flex items-center gap-1" title="QR для скачивания счёта в PDF">
                      <img
                        src={`/api/qr?url=${encodeURIComponent(`${baseUrl}/api/invoices/public/${inv.publicToken}/pdf`)}`}
                        alt="QR счёт"
                        className="w-9 h-9 border border-gray-200 rounded"
                      />
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editingInvoice && editForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setEditingInvoice(null);
            setEditForm(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Редактирование счёта</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Номер счёта</label>
                <input
                  type="text"
                  className="border rounded px-2 py-1 w-full"
                  value={editForm.invoiceNumber}
                  onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата счёта</label>
                <input
                  type="date"
                  className="border rounded px-2 py-1 w-full"
                  value={editForm.invoiceDate}
                  onChange={(e) => setEditForm({ ...editForm, invoiceDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Строки счёта (название услуги / сайта в счёте)</label>
                <div className="space-y-3">
                  {editForm.lines.map((row, idx) => {
                    const line = editingInvoice.lines?.[idx];
                    return (
                      <div key={row.id} className="p-3 border rounded bg-gray-50 space-y-2">
                        {line?.workPeriod && (
                          <p className="text-xs text-gray-500">
                            Период: {formatDate(line.workPeriod.dateFrom)} — {formatDate(line.workPeriod.dateTo)} ·{' '}
                            {line.workPeriod.service?.product?.name ?? ''} · {line.workPeriod.service?.site?.title ?? ''}
                          </p>
                        )}
                        <input
                          type="text"
                          placeholder="Название услуги в счёте"
                          className="border rounded px-2 py-1 w-full text-sm"
                          value={row.serviceNameOverride}
                          onChange={(e) => {
                            const next = editForm.lines.map((l) =>
                              l.id === row.id ? { ...l, serviceNameOverride: e.target.value } : l
                            );
                            setEditForm({ ...editForm, lines: next });
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Название / адрес сайта в счёте"
                          className="border rounded px-2 py-1 w-full text-sm"
                          value={row.siteNameOverride}
                          onChange={(e) => {
                            const next = editForm.lines.map((l) =>
                              l.id === row.id ? { ...l, siteNameOverride: e.target.value } : l
                            );
                            setEditForm({ ...editForm, lines: next });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingInvoice(null);
                    setEditForm(null);
                  }}
                  className="px-4 py-2 border rounded text-sm"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
