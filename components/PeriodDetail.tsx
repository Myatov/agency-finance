'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';

interface PeriodDetailProps {
  periodId: string;
}

interface Invoice {
  id: string;
  amount: string;
  invoiceNumber: string | null;
  legalEntity: { id: string; name: string };
  payments: Array<{ id: string; amount: string; paidAt: string }>;
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
  periodReport: { id: string; originalName: string; paymentType: string } | null;
  closeoutDocuments?: Array<{ id: string; originalName: string; docType: string; uploadedAt: string }>;
}

export default function PeriodDetail({ periodId }: PeriodDetailProps) {
  const [period, setPeriod] = useState<WorkPeriodFull | null>(null);
  const [incomes, setIncomes] = useState<IncomeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [legalEntities, setLegalEntities] = useState<Array<{ id: string; name: string }>>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showCloseoutForm, setShowCloseoutForm] = useState(false);
  const [closeoutUploading, setCloseoutUploading] = useState(false);

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

  const handleCreatePayment = async (e: React.FormEvent<HTMLFormElement>, invoiceId: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const amount = (form.querySelector('[name="amount"]') as HTMLInputElement).value;
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, amount: parseFloat(amount) }),
    });
    if (res.ok) {
      setShowPaymentForm(null);
      load();
    } else {
      const err = await res.json();
      alert(err.error || 'Ошибка');
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

  const expected = period.service.price ? Number(period.service.price) : 0;
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
        Период {period.dateFrom} — {period.dateTo}
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
        <p className="text-lg font-semibold">{formatAmount(String(expected))}</p>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Поступившие оплаты (доходы) за период</h2>
        {incomes.length === 0 ? (
          <p className="text-sm text-gray-500">Нет проведённых доходов по этому периоду</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {incomes.map((i) => (
              <li key={i.id}>
                {formatAmount(i.amount)} — внесён {i.incomeDate ? String(i.incomeDate).slice(0, 10) : '—'}
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

      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Счета</h2>
        {!showInvoiceForm && (
          <button onClick={() => setShowInvoiceForm(true)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">+ Счёт</button>
        )}
      </div>
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

      <ul className="space-y-4">
        {period.invoices.map((inv) => {
          const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
          return (
            <li key={inv.id} className="border rounded p-4">
              <div className="flex justify-between">
                <span>Счёт {inv.invoiceNumber || inv.id.slice(0, 8)} — {inv.legalEntity.name}: {formatAmount(inv.amount)}</span>
                <span className="text-gray-500">Оплачено: {formatAmount(String(paid))}</span>
              </div>
              {inv.payments.length > 0 && (
                <ul className="mt-2 text-sm text-gray-600">
                  {inv.payments.map((p) => (
                    <li key={p.id}>{formatAmount(p.amount)} — {p.paidAt.slice(0, 10)}</li>
                  ))}
                </ul>
              )}
              {showPaymentForm !== inv.id ? (
                <button onClick={() => setShowPaymentForm(inv.id)} className="mt-2 text-blue-600 hover:underline text-sm">+ Оплата</button>
              ) : (
                <form onSubmit={(e) => handleCreatePayment(e, inv.id)} className="mt-2 flex gap-2 items-end">
                  <input type="number" name="amount" step="0.01" required placeholder="Сумма (руб)" className="border rounded px-2 py-1 w-32" />
                  <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Добавить</button>
                  <button type="button" onClick={() => setShowPaymentForm(null)} className="px-3 py-1 border rounded text-sm">Отмена</button>
                </form>
              )}
            </li>
          );
        })}
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
                <span className="text-gray-400">{doc.uploadedAt?.slice(0, 10)}</span>
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
    </div>
  );
}
