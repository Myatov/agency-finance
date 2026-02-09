'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatAmount, formatDate } from '@/lib/utils';

interface PeriodDetailProps {
  periodId: string;
}

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
}

interface IncomeRow {
  id: string;
  amount: string;
  incomeDate: string | null;
}

interface WorkPeriodFull {
  id: string;
  dateFrom: string;
  dateTo: string;
  periodType: string;
  invoiceNotRequired: boolean;
  expectedAmount: string | null;
  service: {
    id: string;
    price: string | null;
    site: {
      title: string;
      client: {
        id: string;
        name: string;
        legalEntityId: string | null;
        legalEntity?: { id: string; name: string } | null;
      };
    };
    product: { name: string };
  };
  invoices: Invoice[];
  periodInvoiceNotes?: PeriodInvoiceNote[];
  periodReport: { id: string; originalName: string; paymentType: string } | null;
  closeoutDocuments?: Array<{ id: string; originalName: string; docType: string; uploadedAt: string }>;
}

interface PeriodInvoiceNote {
  id: string;
  amount: string;
  invoiceNumber: string | null;
  issuedAt: string | null;
  legalEntity: { id: string; name: string };
}

export default function PeriodDetail({ periodId }: PeriodDetailProps) {
  const [period, setPeriod] = useState<WorkPeriodFull | null>(null);
  const [incomes, setIncomes] = useState<IncomeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [legalEntities, setLegalEntities] = useState<Array<{ id: string; name: string }>>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showCloseoutForm, setShowCloseoutForm] = useState(false);
  const [closeoutUploading, setCloseoutUploading] = useState(false);
  const [editingExpected, setEditingExpected] = useState(false);
  const [expectedInput, setExpectedInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showAddToInvoice, setShowAddToInvoice] = useState(false);
  const [availableInvoices, setAvailableInvoices] = useState<Array<{ id: string; invoiceNumber: string | null; amount: string; legalEntity: { name: string } }>>([]);
  const [addToInvoiceId, setAddToInvoiceId] = useState('');
  const [addToInvoiceAmount, setAddToInvoiceAmount] = useState('');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState<{ invoiceNumber: string; invoiceDate: string; lines: { id: string; serviceNameOverride: string; siteNameOverride: string }[] } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = async () => {
    setLoading(true);
    const [pRes, iRes] = await Promise.all([
      fetch(`/api/work-periods/${periodId}`),
      fetch(`/api/incomes?workPeriodId=${periodId}`),
    ]);
    const pData = await pRes.json();
    const iData = await iRes.json();
    if (pRes.ok) setPeriod(pData.workPeriod);
    setIncomes((iData.incomes || []).map((i: { id: string; amount: string; incomeDate: string | null }) => ({ id: i.id, amount: i.amount, incomeDate: i.incomeDate })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    fetch('/api/legal-entities').then((r) => r.json()).then((d) => setLegalEntities(d.legalEntities || []));
  }, [periodId]);

  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const amount = (form.querySelector('[name="amount"]') as HTMLInputElement).value;
    const legalEntityId = (form.querySelector('[name="legalEntityId"]') as HTMLSelectElement).value;
    if (!legalEntityId || !amount) return;
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workPeriodId: periodId, amount: parseFloat(amount), legalEntityId }),
    });
    if (res.ok) {
      setShowInvoiceForm(false);
      load();
    } else {
      const err = await res.json();
      alert(err.error || 'Ошибка');
    }
  };

  const loadAvailableInvoices = async () => {
    const res = await fetch(`/api/work-periods/${periodId}/available-invoices`);
    const data = await res.json();
    if (res.ok) setAvailableInvoices(data.invoices ?? []);
    else setAvailableInvoices([]);
  };

  const handleAddToInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!addToInvoiceId || !addToInvoiceAmount) return;
    const res = await fetch(`/api/invoices/${addToInvoiceId}/lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workPeriodId: periodId, amount: parseFloat(addToInvoiceAmount) }),
    });
    if (res.ok) {
      setShowAddToInvoice(false);
      setAddToInvoiceId('');
      setAddToInvoiceAmount('');
      load();
    } else {
      const err = await res.json();
      alert(err.error || 'Ошибка');
    }
  };

  const openEditInvoice = async (inv: Invoice) => {
    const res = await fetch(`/api/invoices/${inv.id}`);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Не удалось загрузить счёт');
      return;
    }
    const full = data.invoice as Invoice & { invoiceDate?: string; lines?: InvoiceLine[] };
    setEditingInvoice(full);
    setEditForm({
      invoiceNumber: full.invoiceNumber ?? '',
      invoiceDate: full.invoiceDate ? full.invoiceDate.slice(0, 10) : '',
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

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Удалить эту оплату по счёту? Доходы вносятся через раздел «Доходы».')) return;
    const res = await fetch(`/api/payments/${paymentId}`, { method: 'DELETE' });
    if (res.ok) load();
    else {
      const err = await res.json();
      alert(err.error || 'Ошибка удаления');
    }
  };

  const handleUploadCloseout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!period || closeoutUploading) return;
    const form = e.currentTarget;
    const file = (form.querySelector('[name="closeoutFile"]') as HTMLInputElement).files?.[0];
    const docType = (form.querySelector('[name="closeoutDocType"]') as HTMLSelectElement).value;
    if (!file || !docType) {
      alert('Выберите файл и тип документа');
      return;
    }
    setCloseoutUploading(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('clientId', period.service.site.client.id);
      fd.set('workPeriodId', periodId);
      fd.set('docType', docType);
      const res = await fetch('/api/closeout/documents', { method: 'POST', body: fd });
      if (res.ok) {
        setShowCloseoutForm(false);
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `Ошибка загрузки (${res.status})`);
      }
    } finally {
      setCloseoutUploading(false);
    }
  };

  const handleUploadReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.querySelector('[name="file"]') as HTMLInputElement).files?.[0];
    const paymentType = (form.querySelector('[name="paymentType"]') as HTMLSelectElement).value;
    if (!file || !paymentType) return;
    const fd = new FormData();
    fd.set('file', file);
    fd.set('workPeriodId', periodId);
    fd.set('paymentType', paymentType);
    const res = await fetch('/api/period-reports', { method: 'POST', body: fd });
    if (res.ok) {
      setShowReportForm(false);
      load();
    } else {
      const err = await res.json();
      alert(err.error || 'Ошибка');
    }
  };

  if (loading || !period) {
    return <div className="py-8 text-center">{loading ? 'Загрузка...' : 'Период не найден'}</div>;
  }

  const expected =
    period.expectedAmount != null && period.expectedAmount !== ''
      ? Number(period.expectedAmount)
      : period.service.price
        ? Number(period.service.price)
        : 0;
  const expectedRub = expected / 100;
  const totalIncomes = incomes.reduce((s, i) => s + Number(i.amount), 0);
  const paymentDone = !period.invoiceNotRequired && period.invoices.length > 0;
  const reportDone = !!period.periodReport;
  const incomesDone = expected <= 0 || totalIncomes >= expected;
  const clientLegalEntityId = period.service?.site?.client?.legalEntityId ?? null;

  return (
    <div>
      <div className="mb-4">
        <button type="button" onClick={() => window.history.back()} className="text-blue-600 hover:underline text-sm">
          ← Назад
        </button>
      </div>
      <h1 className="text-2xl font-bold mb-2">
        Период {formatDate(period.dateFrom)} — {formatDate(period.dateTo)}
      </h1>
      <p className="text-gray-600 mb-4">
        {period.service.site.client.name} · {period.service.site.title} · {period.service.product.name}
      </p>

      <div className="flex flex-wrap gap-4 mb-6 p-3 bg-gray-50 rounded">
        <span className="flex items-center gap-2">
          {reportDone ? <span className="text-green-600">✓</span> : <span className="text-gray-400">—</span>}
          <span className="text-sm">Отчёт по периоду</span>
        </span>
        <span className="flex items-center gap-2">
          {paymentDone ? <span className="text-green-600">✓</span> : <span className="text-gray-400">—</span>}
          <span className="text-sm">Счёт выставлен</span>
        </span>
        <span className="flex items-center gap-2">
          {incomesDone ? <span className="text-green-600">✓</span> : <span className="text-gray-400">—</span>}
          <span className="text-sm">Оплата за период {incomesDone ? 'выполнено' : `(осталось ${formatAmount(String(Math.max(0, expected - totalIncomes)))} )`}</span>
        </span>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-500">Ожидаемо за период</p>
        {!editingExpected ? (
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">{formatAmount(String(expected))}</p>
            <button
              type="button"
              onClick={() => {
                setExpectedInput(expectedRub > 0 ? expectedRub.toFixed(2) : '');
                setEditingExpected(true);
              }}
              className="text-sm text-blue-600 hover:underline"
            >
              Изменить
            </button>
          </div>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const v = parseFloat(expectedInput);
              if (Number.isNaN(v) || v < 0) return;
              const res = await fetch(`/api/work-periods/${periodId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expectedAmount: v }),
              });
              if (res.ok) {
                setPeriod((prev) =>
                  prev
                    ? { ...prev, expectedAmount: String(Math.round(v * 100)) }
                    : prev
                );
                setEditingExpected(false);
              } else {
                const err = await res.json();
                alert(err.error || 'Ошибка');
              }
            }}
          >
            <input
              type="number"
              step="0.01"
              min="0"
              value={expectedInput}
              onChange={(e) => setExpectedInput(e.target.value)}
              className="border rounded px-2 py-1 w-32"
            />
            <span className="text-sm text-gray-500">руб.</span>
            <button type="submit" className="px-2 py-1 bg-blue-600 text-white rounded text-sm">
              Сохранить
            </button>
            <button
              type="button"
              onClick={() => setEditingExpected(false)}
              className="px-2 py-1 border rounded text-sm"
            >
              Отмена
            </button>
          </form>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Поступившие оплаты (доходы) за период</h2>
        {incomes.length === 0 ? (
          <p className="text-sm text-gray-500">Нет проведённых доходов по этому периоду</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {incomes.map((i) => (
              <li key={i.id}>
                {formatAmount(i.amount)} — внесён {i.incomeDate ? formatDate(i.incomeDate) : '—'}
              </li>
            ))}
            <li className="font-medium mt-2">
              Всего поступило: {formatAmount(String(totalIncomes))}
              {expected > 0 && (
                <> · Осталось: {formatAmount(String(Math.max(0, expected - totalIncomes)))}</>
              )}
              {incomesDone && expected > 0 && <span className="text-green-600 ml-2">✓ выполнено</span>}
            </li>
          </ul>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Отчёт по периоду</h2>
        {period.periodReport ? (
          <p>
            <a href={`/api/period-reports/${period.periodReport.id}/download`} className="text-blue-600 hover:underline" download>
              {period.periodReport.originalName}
            </a>
            {' '}({period.periodReport.paymentType})
            <span className="text-green-600 ml-2">✓ выполнено</span>
          </p>
        ) : (
          <>
            {!showReportForm ? (
              <button onClick={() => setShowReportForm(true)} className="text-blue-600 hover:underline text-sm">Прикрепить отчёт</button>
            ) : (
              <form onSubmit={handleUploadReport} className="flex flex-wrap gap-2 items-end">
                <input type="file" name="file" required className="border rounded px-2 py-1" />
                <select name="paymentType" required className="border rounded px-2 py-1">
                  <option value="PREPAY">Предоплата</option>
                  <option value="POSTPAY">Постоплата</option>
                  <option value="FRACTIONAL">Дробная</option>
                </select>
                <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Загрузить</button>
                <button type="button" onClick={() => setShowReportForm(false)} className="px-3 py-1 border rounded text-sm">Отмена</button>
              </form>
            )}
          </>
        )}
      </div>

      <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Счета</h2>
        {!showInvoiceForm && !showAddToInvoice && (
          <>
            <button onClick={() => setShowInvoiceForm(true)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">+ Счёт</button>
            <button
              onClick={() => {
                setShowAddToInvoice(true);
                loadAvailableInvoices();
                setAddToInvoiceAmount(expectedRub > 0 ? expectedRub.toFixed(2) : '');
              }}
              className="px-3 py-1 bg-slate-600 text-white rounded text-sm"
            >
              Добавить в счёт
            </button>
          </>
        )}
      </div>
      {showAddToInvoice && (
        <form onSubmit={handleAddToInvoice} className="mb-4 p-4 border rounded flex flex-wrap gap-2 items-end bg-slate-50">
          <div>
            <label className="block text-xs text-gray-500">Счёт</label>
            <select
              name="invoiceId"
              required
              className="border rounded px-2 py-1 min-w-[200px]"
              value={addToInvoiceId}
              onChange={(e) => setAddToInvoiceId(e.target.value)}
            >
              <option value="">Выберите счёт</option>
              {availableInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  № {inv.invoiceNumber || inv.id.slice(0, 8)} — {inv.legalEntity.name} ({formatAmount(inv.amount)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500">Сумма (руб)</label>
            <input
              type="number"
              name="amount"
              step="0.01"
              required
              className="border rounded px-2 py-1 w-28"
              value={addToInvoiceAmount}
              onChange={(e) => setAddToInvoiceAmount(e.target.value)}
            />
          </div>
          <button type="submit" className="px-3 py-1 bg-slate-600 text-white rounded text-sm">Добавить</button>
          <button type="button" onClick={() => { setShowAddToInvoice(false); setAddToInvoiceId(''); }} className="px-3 py-1 border rounded text-sm">Отмена</button>
        </form>
      )}
      {showInvoiceForm && (
        <form onSubmit={handleCreateInvoice} className="mb-4 p-4 border rounded flex flex-wrap gap-2 items-end" key={`inv-${period.id}-${expectedRub}-${clientLegalEntityId ?? ''}`}>
          <div>
            <label className="block text-xs text-gray-500">Сумма (руб)</label>
            <input type="number" name="amount" step="0.01" required className="border rounded px-2 py-1 w-32" defaultValue={expectedRub > 0 ? expectedRub.toFixed(2) : ''} />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Юрлицо</label>
            <select name="legalEntityId" required className="border rounded px-2 py-1" defaultValue={clientLegalEntityId ?? ''}>
              <option value="">Выберите</option>
              {legalEntities.map((le) => (
                <option key={le.id} value={le.id}>{le.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Создать</button>
          <button type="button" onClick={() => setShowInvoiceForm(false)} className="px-3 py-1 border rounded text-sm">Отмена</button>
        </form>
      )}

      {(period.periodInvoiceNotes?.length ?? 0) > 0 && (
        <ul className="space-y-2 mb-4 text-sm text-gray-600">
          {period.periodInvoiceNotes?.map((note) => (
            <li key={note.id} className="border-l-2 border-amber-400 pl-3 py-1">
              Счёт выставлен на {formatAmount(note.amount)}
              {note.invoiceNumber && `, № ${note.invoiceNumber}`}
              {note.issuedAt && `, ${formatDate(note.issuedAt)}`}
              {' — '}
              {note.legalEntity.name}
              <span className="text-gray-400 ml-1">(без формирования счёта — ЮЛ без галочки «Формировать закрывающие документы»)</span>
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-4">
        {period.invoices.map((inv) => (
            <li key={inv.id} className="border rounded p-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span>Счёт {inv.invoiceNumber || inv.id.slice(0, 8)} — {inv.legalEntity.name}: {formatAmount(inv.amount)}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => openEditInvoice(inv)} className="text-slate-600 hover:underline text-sm">Редактировать</button>
                  <button
                    type="button"
                    onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Печать счёта
                  </button>
                </div>
              </div>
              {inv.payments.length > 0 && (
                <ul className="mt-2 text-sm text-gray-600">
                  {inv.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      {formatAmount(p.amount)} — {formatDate(p.paidAt)}
                      <button type="button" onClick={() => handleDeletePayment(p.id)} className="text-red-600 hover:underline text-xs">Удалить</button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs text-gray-500">Доходы вносятся через раздел «Доходы»</p>
            </li>
        ))}
      </ul>

      <div className="mt-6 mb-4">
        <h2 className="text-lg font-semibold mb-2">Закрывающие документы</h2>
        {(period.closeoutDocuments?.length ?? 0) > 0 ? (
          <ul className="space-y-2 text-sm">
            {period.closeoutDocuments?.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2">
                <a href={`/api/closeout/documents/${doc.id}/download`} className="text-blue-600 hover:underline" download>
                  {doc.originalName}
                </a>
                <span className="text-gray-500">({doc.docType})</span>
                <span className="text-gray-400">{doc.uploadedAt ? formatDate(doc.uploadedAt) : '—'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Нет прикреплённых закрывающих документов</p>
        )}
        {!showCloseoutForm ? (
          <button onClick={() => setShowCloseoutForm(true)} className="mt-2 text-blue-600 hover:underline text-sm">Прикрепить закрывающий документ</button>
        ) : (
          <form onSubmit={handleUploadCloseout} className="mt-2 flex flex-wrap gap-2 items-end p-4 border rounded bg-gray-50">
            <input type="file" name="closeoutFile" required className="border rounded px-2 py-1" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" />
            <select name="closeoutDocType" required className="border rounded px-2 py-1">
              <option value="ACT">Акт</option>
              <option value="INVOICE">Счёт</option>
              <option value="SF">УПД</option>
              <option value="UPD">УКД</option>
              <option value="RECONCILIATION">Акт сверки</option>
              <option value="REPORT">Отчёт</option>
              <option value="OTHER">Прочее</option>
            </select>
            <button type="submit" disabled={closeoutUploading} className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
              {closeoutUploading ? 'Загрузка…' : 'Загрузить'}
            </button>
            <button type="button" onClick={() => setShowCloseoutForm(false)} disabled={closeoutUploading} className="px-3 py-1 border rounded text-sm">Отмена</button>
          </form>
        )}
      </div>

      {editingInvoice && editForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setEditingInvoice(null); setEditForm(null); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
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
                            Период: {formatDate(line.workPeriod.dateFrom)} — {formatDate(line.workPeriod.dateTo)} · {line.workPeriod.service?.product?.name ?? ''} · {line.workPeriod.service?.site?.title ?? ''}
                          </p>
                        )}
                        <input
                          type="text"
                          placeholder="Название услуги в счёте"
                          className="border rounded px-2 py-1 w-full text-sm"
                          value={row.serviceNameOverride}
                          onChange={(e) => {
                            const next = editForm.lines.map((l) => (l.id === row.id ? { ...l, serviceNameOverride: e.target.value } : l));
                            setEditForm({ ...editForm, lines: next });
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Название / адрес сайта в счёте"
                          className="border rounded px-2 py-1 w-full text-sm"
                          value={row.siteNameOverride}
                          onChange={(e) => {
                            const next = editForm.lines.map((l) => (l.id === row.id ? { ...l, siteNameOverride: e.target.value } : l));
                            setEditForm({ ...editForm, lines: next });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm">Сохранить</button>
                <button type="button" onClick={() => { setEditingInvoice(null); setEditForm(null); }} className="px-4 py-2 border rounded text-sm">Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
