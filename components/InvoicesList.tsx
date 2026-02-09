'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatAmount, formatDate, getAppUrlBase } from '@/lib/utils';

interface InvoiceLine {
  id: string;
  amount: string;
  serviceNameOverride: string | null;
  siteNameOverride: string | null;
  workPeriod?: {
    dateFrom: string;
    dateTo: string;
    service: { product: { name: string }; site: { title: string; client?: { name: string } } };
  };
}

interface Invoice {
  id: string;
  amount: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  publicToken: string | null;
  pdfGeneratedAt?: string | null;
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

type NewFormLine = {
  workPeriodId: string;
  amount: string;
  serviceNameOverride: string;
  siteNameOverride: string;
  label: string;
};

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
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<{
    invoiceDate: string;
    lines: NewFormLine[];
  }>({ invoiceDate: new Date().toISOString().slice(0, 10), lines: [] });
  const [services, setServices] = useState<Array<{ id: string; site: { client: { name: string }; title: string }; product: { name: string }; price: string | null }>>([]);
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [addPeriodServiceId, setAddPeriodServiceId] = useState('');
  const [addPeriodList, setAddPeriodList] = useState<Array<{ id: string; dateFrom: string; dateTo: string; expectedAmount: string | null }>>([]);
  const [addPeriodSelectedId, setAddPeriodSelectedId] = useState('');
  const [savingNew, setSavingNew] = useState(false);

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

  const openViewOrPrint = (id: string) => {
    window.open(`/api/invoices/${id}/download`, '_blank');
  };

  const openPrint = openViewOrPrint;

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

  const loadServices = () => {
    fetch('/api/services?status=ACTIVE')
      .then((r) => r.json())
      .then((d) => setServices(d.services ?? []));
  };

  const loadPeriodsForService = (serviceId: string) => {
    if (!serviceId) {
      setAddPeriodList([]);
      return;
    }
    fetch(`/api/work-periods?serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((d) => setAddPeriodList(d.workPeriods ?? []));
    setAddPeriodSelectedId('');
  };

  const handleAddPeriodToNewForm = () => {
    if (!addPeriodSelectedId) return;
    const period = addPeriodList.find((p) => p.id === addPeriodSelectedId);
    const svc = services.find((s) => s.id === addPeriodServiceId);
    if (!period || !svc) return;
    const amountRub = period.expectedAmount != null ? (Number(period.expectedAmount) / 100).toFixed(2) : (svc.price ? (Number(svc.price) / 100).toFixed(2) : '0');
    const label = `${svc.site.client.name} · ${svc.site.title} · ${svc.product.name} · ${formatDate(period.dateFrom)}–${formatDate(period.dateTo)}`;
    if (newForm.lines.some((l) => l.workPeriodId === period.id)) {
      alert('Этот период уже добавлен');
      return;
    }
    setNewForm({
      ...newForm,
      lines: [
        ...newForm.lines,
        {
          workPeriodId: period.id,
          amount: amountRub,
          serviceNameOverride: svc.product.name,
          siteNameOverride: svc.site.title,
          label,
        },
      ],
    });
    setShowAddPeriod(false);
    setAddPeriodServiceId('');
    setAddPeriodList([]);
    setAddPeriodSelectedId('');
  };

  const handleSaveNewInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.legalEntityId.trim()) {
      alert('Выберите юрлицо');
      return;
    }
    if (newForm.lines.length === 0) {
      alert('Добавьте хотя бы один период');
      return;
    }
    setSavingNew(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceDate: newForm.invoiceDate || null,
          lines: newForm.lines.map((l) => ({
            workPeriodId: l.workPeriodId,
            amount: parseFloat(l.amount) || 0,
            serviceNameOverride: l.serviceNameOverride.trim() || null,
            siteNameOverride: l.siteNameOverride.trim() || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка создания счёта');
        return;
      }
      setShowNewForm(false);
      setNewForm({ invoiceDate: new Date().toISOString().slice(0, 10), lines: [] });
      load();
      if (data.invoice?.id) openViewOrPrint(data.invoice.id);
    } finally {
      setSavingNew(false);
    }
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

  const handleRemoveLineFromInvoice = async (lineId: string) => {
    if (!editingInvoice) return;
    const isOnly = (editingInvoice.lines?.length ?? 0) <= 1;
    if (isOnly && !confirm('В счёте один период. Счёт будет удалён. Продолжить?')) return;
    const res = await fetch(`/api/invoices/${editingInvoice.id}/lines/${lineId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || 'Ошибка удаления');
      return;
    }
    if (data.deletedInvoice) {
      setEditingInvoice(null);
      setEditForm(null);
      load();
      return;
    }
    const fullRes = await fetch(`/api/invoices/${editingInvoice.id}`);
    const fullData = await fullRes.json();
    if (fullRes.ok && fullData.invoice) {
      const full = fullData.invoice as Invoice & { invoiceDate?: string; lines?: InvoiceLine[] };
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
    } else {
      load();
      setEditingInvoice(null);
      setEditForm(null);
    }
  };

  const clientName = (inv: Invoice) =>
    inv.workPeriod?.service?.site?.client?.name ?? inv.lines?.[0]?.workPeriod?.service?.site?.client?.name ?? '—';

  const baseUrl = mounted ? getAppUrlBase() : '';

  if (loading) return <div className="py-8 text-gray-500">Загрузка...</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Счета</h1>
          <p className="text-gray-600 mt-1">Новые счета создаются здесь. Просмотр и печать — HTML-форма с подставленными полями.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowNewForm(true);
            loadServices();
            setNewForm((prev) => ({ ...prev, invoiceDate: new Date().toISOString().slice(0, 10), lines: [] }));
          }}
          className="px-4 py-2 bg-teal-600 text-white rounded text-sm hover:bg-teal-700"
        >
          Новый счёт
        </button>
      </div>

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
                    onClick={() => openViewOrPrint(inv.id)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Просмотр счёта
                  </button>
                  {inv.pdfGeneratedAt && (
                    <button
                      type="button"
                      onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')}
                      className="px-3 py-1 bg-teal-600 text-white rounded text-sm hover:bg-teal-700"
                    >
                      Счет в PDF
                    </button>
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
            <h3 className="text-lg font-semibold mb-4">Скачать счёт (редактирование)</h3>
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
                        <div className="flex justify-between items-start gap-2">
                          {line?.workPeriod && (
                            <p className="text-xs text-gray-500 flex-1">
                              Период: {formatDate(line.workPeriod.dateFrom)} — {formatDate(line.workPeriod.dateTo)} ·{' '}
                              {line.workPeriod.service?.product?.name ?? ''} · {line.workPeriod.service?.site?.title ?? ''}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveLineFromInvoice(row.id)}
                            className="text-red-600 hover:underline text-xs shrink-0"
                          >
                            Удалить период
                          </button>
                        </div>
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
              <div className="flex gap-2 pt-2 flex-wrap">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => editingInvoice && openViewOrPrint(editingInvoice.id)}
                  className="px-4 py-2 bg-teal-600 text-white rounded text-sm"
                >
                  Печать
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

      {showNewForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowNewForm(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Скачать счёт (новый)</h3>
            <form onSubmit={handleSaveNewInvoice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата счёта</label>
                <input
                  type="date"
                  className="border rounded px-2 py-1 w-full max-w-[200px]"
                  value={newForm.invoiceDate}
                  onChange={(e) => setNewForm({ ...newForm, invoiceDate: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Юрлицо подтягивается из карточки клиента. Номер счёта генерируется автоматически (5–7 знаков).</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Периоды (строки счёта)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPeriod(true);
                      setAddPeriodServiceId('');
                      setAddPeriodList([]);
                      setAddPeriodSelectedId('');
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + Добавить период
                  </button>
                </div>
                {newForm.lines.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">Добавьте хотя бы один период</p>
                ) : (
                  <ul className="space-y-3">
                    {newForm.lines.map((line, idx) => (
                      <li key={line.workPeriodId} className="p-3 border rounded bg-gray-50 text-sm">
                        <p className="text-gray-600 mb-2">{line.label}</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="border rounded px-2 py-1 w-24"
                            value={line.amount}
                            onChange={(e) => {
                              const next = [...newForm.lines];
                              next[idx] = { ...next[idx], amount: e.target.value };
                              setNewForm({ ...newForm, lines: next });
                            }}
                          />
                          <span className="text-gray-500">руб.</span>
                          <input
                            type="text"
                            placeholder="Услуга в счёте"
                            className="border rounded px-2 py-1 flex-1 min-w-[120px]"
                            value={line.serviceNameOverride}
                            onChange={(e) => {
                              const next = [...newForm.lines];
                              next[idx] = { ...next[idx], serviceNameOverride: e.target.value };
                              setNewForm({ ...newForm, lines: next });
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Сайт в счёте"
                            className="border rounded px-2 py-1 flex-1 min-w-[120px]"
                            value={line.siteNameOverride}
                            onChange={(e) => {
                              const next = [...newForm.lines];
                              next[idx] = { ...next[idx], siteNameOverride: e.target.value };
                              setNewForm({ ...newForm, lines: next });
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setNewForm({
                                ...newForm,
                                lines: newForm.lines.filter((_, i) => i !== idx),
                              })
                            }
                            className="text-red-600 hover:underline text-xs"
                          >
                            Удалить
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-2 pt-2 flex-wrap">
                <button type="submit" disabled={savingNew || newForm.lines.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                  {savingNew ? 'Сохранение…' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="px-4 py-2 border rounded text-sm"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddPeriod && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddPeriod(false)}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold mb-3">Добавить период</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Услуга</label>
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={addPeriodServiceId}
                  onChange={(e) => {
                    setAddPeriodServiceId(e.target.value);
                    loadPeriodsForService(e.target.value);
                  }}
                >
                  <option value="">Выберите</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.site.client.name} · {s.site.title} · {s.product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Период</label>
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={addPeriodSelectedId}
                  onChange={(e) => setAddPeriodSelectedId(e.target.value)}
                  disabled={!addPeriodServiceId}
                >
                  <option value="">Выберите</option>
                  {addPeriodList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatDate(p.dateFrom)} — {formatDate(p.dateTo)}
                      {p.expectedAmount != null ? ` · ${formatAmount(p.expectedAmount)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleAddPeriodToNewForm}
                disabled={!addPeriodSelectedId}
                className="px-3 py-1 bg-teal-600 text-white rounded text-sm disabled:opacity-50"
              >
                Добавить
              </button>
              <button type="button" onClick={() => setShowAddPeriod(false)} className="px-3 py-1 border rounded text-sm">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
