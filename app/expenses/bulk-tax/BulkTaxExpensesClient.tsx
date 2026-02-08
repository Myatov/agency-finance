'use client';

import { useState, useEffect, useRef } from 'react';

interface LegalEntity {
  id: string;
  name: string;
  usnPercent: number;
  vatPercent: number;
}

interface CostItem {
  id: string;
  title: string;
  costCategory?: { name: string };
}

interface IncomeRow {
  id: string;
  incomeDate: string;
  amount: number;
  amountRub: number;
  taxAmount: number;
  taxAmountRub: number;
  vatAmount: number;
  vatAmountRub: number;
  hasExistingExpense: boolean;
  productName: string;
  siteTitle: string;
  clientName: string;
  periodFrom: string | null;
  periodTo: string | null;
  accountManager: string | null;
}

export default function BulkTaxExpensesClient() {
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [legalEntityId, setLegalEntityId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [costItemId, setCostItemId] = useState('');
  const [costItemIdVat, setCostItemIdVat] = useState('');
  const [incomes, setIncomes] = useState<IncomeRow[]>([]);
  const [legalEntity, setLegalEntity] = useState<LegalEntity | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const selectableIncomes = incomes.filter((i) => !i.hasExistingExpense);

  useEffect(() => {
    Promise.all([
      fetch('/api/legal-entities').then((r) => r.json()),
      fetch('/api/cost-items').then((r) => r.json()),
    ]).then(([leRes, ciRes]) => {
      if (leRes.legalEntities) setLegalEntities(leRes.legalEntities);
      if (ciRes.costItems) setCostItems(ciRes.costItems);
    });
  }, []);

  const loadIncomes = () => {
    if (!legalEntityId || !dateFrom || !dateTo) {
      setError('Выберите юрлицо и период');
      return;
    }
    setError('');
    setSuccess(null);
    setLoading(true);
    const params = new URLSearchParams({ legalEntityId, dateFrom, dateTo });
    fetch(`/api/bulk-tax-expenses/incomes?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setIncomes([]);
          setLegalEntity(null);
        } else {
          setIncomes(data.incomes ?? []);
          setLegalEntity(data.legalEntity ?? null);
          const selectable = (data.incomes ?? []).filter((i: IncomeRow) => !i.hasExistingExpense);
          setSelectedIds(new Set(selectable.map((i: IncomeRow) => i.id)));
        }
      })
      .finally(() => setLoading(false));
  };

  const toggle = (id: string) => {
    const row = incomes.find((i) => i.id === id);
    if (row?.hasExistingExpense) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === selectableIncomes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableIncomes.map((i) => i.id)));
  };

  const createExpenses = () => {
    const toSend = Array.from(selectedIds).filter((id) => !incomes.find((i) => i.id === id)?.hasExistingExpense);
    if (!costItemId || toSend.length === 0) {
      setError('Выберите статью расхода и хотя бы один доход (без пометки «Уже создан»)');
      return;
    }
    setError('');
    setSuccess(null);
    setCreating(true);
    fetch('/api/bulk-tax-expenses/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        costItemId,
        legalEntityId,
        incomeIds: toSend,
        costItemIdVat: costItemIdVat || undefined,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setSuccess(`Создано расходов: ${data.created}`);
          loadIncomes();
        }
      })
      .finally(() => setCreating(false));
  };

  const selectedRows = incomes.filter((i) => selectedIds.has(i.id));
  const totalTax = selectedRows.reduce((s, i) => s + i.taxAmountRub, 0);
  const totalVat = selectedRows.reduce((s, i) => s + i.vatAmountRub, 0);

  const exportCsv = () => {
    const headers = [
      'Дата дохода',
      'Сумма дохода (₽)',
      'Услуга',
      'Сайт',
      'Клиент',
      'Период',
      'АМ',
      'Расход УСН (₽)',
      'Расход НДС (₽)',
    ];
    const rows = selectedRows.map((r) => [
      new Date(r.incomeDate).toLocaleDateString('ru-RU'),
      r.amountRub.toLocaleString('ru-RU'),
      r.productName,
      r.siteTitle,
      r.clientName,
      r.periodFrom && r.periodTo
        ? `${new Date(r.periodFrom).toLocaleDateString('ru-RU')} — ${new Date(r.periodTo).toLocaleDateString('ru-RU')}`
        : '—',
      r.accountManager ?? '—',
      r.taxAmountRub.toLocaleString('ru-RU'),
      r.vatAmountRub.toLocaleString('ru-RU'),
    ]);
    const csv = [headers.join(';'), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `массовые-расходы-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Массовые расходы</title>
      <style>body{font-family:sans-serif;padding:16px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ccc;padding:6px;text-align:left;} th{background:#f5f5f5;}</style>
      </head><body>
      <h1>Массовое формирование расходов (налоги)</h1>
      <p>Юрлицо: ${legalEntity?.name ?? ''} | Период: ${dateFrom} — ${dateTo}</p>
      ${printRef.current.innerHTML}
      <p>Итого УСН: ${totalTax.toLocaleString('ru-RU')} ₽ | Итого НДС: ${totalVat.toLocaleString('ru-RU')} ₽</p>
      </body></html>`);
    win.document.close();
    win.print();
    win.close();
  };

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Массовое формирование расходов (налоги с доходов)
      </h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">1. Выбор доходов</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Юрлицо</label>
            <select
              value={legalEntityId}
              onChange={(e) => setLegalEntityId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">— Выберите —</option>
              {legalEntities.map((le) => (
                <option key={le.id} value={le.id}>
                  {le.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Период с</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Период по</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={loadIncomes}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Загрузка...' : 'Загрузить доходы'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">2. Статьи расхода</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Статья для налога на доход (УСН)
            </label>
            <p className="text-xs text-gray-500 mb-1">Обычно: «Налоги на доход»</p>
            <select
              value={costItemId}
              onChange={(e) => setCostItemId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">— Выберите —</option>
              {costItems.map((ci) => (
                <option key={ci.id} value={ci.id}>
                  {ci.costCategory?.name ? `${ci.costCategory.name} → ` : ''}{ci.title}
                </option>
              ))}
            </select>
          </div>
          {legalEntity && legalEntity.vatPercent > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Статья для НДС (опционально)
              </label>
              <p className="text-xs text-gray-500 mb-1">Обычно: «НДС»</p>
              <select
                value={costItemIdVat}
                onChange={(e) => setCostItemIdVat(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">— Не создавать НДС —</option>
                {costItems.map((ci) => (
                  <option key={ci.id} value={ci.id}>
                    {ci.costCategory?.name ? `${ci.costCategory.name} → ` : ''}{ci.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {legalEntity && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-800">
          <strong>{legalEntity.name}</strong>: УСН {legalEntity.usnPercent}%
          {legalEntity.vatPercent > 0 ? `, НДС ${legalEntity.vatPercent}%` : ''}. По каждому доходу: расход УСН = доход × УСН%
          {legalEntity.vatPercent > 0 ? ', расход НДС = доход × НДС%' : ''}.
        </div>
      )}

      {incomes.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <h2 className="text-lg font-semibold text-gray-800 p-4 border-b">
            3. Доходы за период — отметьте, по каким сформировать расходы
          </h2>
          <div className="overflow-x-auto" ref={printRef}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectableIncomes.length > 0 && selectedIds.size === selectableIncomes.length}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Дата дохода</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Сумма дохода (₽)</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Услуга</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Сайт / Клиент</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Период</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">АМ</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Расход УСН (₽)</th>
                  {legalEntity && legalEntity.vatPercent > 0 && (
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Расход НДС (₽)</th>
                  )}
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {incomes.map((row) => (
                  <tr
                    key={row.id}
                    className={row.hasExistingExpense ? 'bg-gray-100' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggle(row.id)}
                        disabled={row.hasExistingExpense}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {new Date(row.incomeDate).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium">
                      {row.amountRub.toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.productName}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {row.siteTitle} / {row.clientName}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {row.periodFrom && row.periodTo
                        ? `${new Date(row.periodFrom).toLocaleDateString('ru-RU')} — ${new Date(row.periodTo).toLocaleDateString('ru-RU')}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{row.accountManager ?? '—'}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium text-green-700">
                      {row.taxAmountRub.toLocaleString('ru-RU')}
                    </td>
                    {legalEntity && legalEntity.vatPercent > 0 && (
                      <td className="px-4 py-2 text-sm text-right text-green-700">
                        {row.vatAmountRub.toLocaleString('ru-RU')}
                      </td>
                    )}
                    <td className="px-4 py-2 text-sm">
                      {row.hasExistingExpense ? (
                        <span className="text-amber-700 font-medium">Уже создан</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t flex flex-wrap justify-between items-center gap-4">
            <span className="text-sm text-gray-600">
              Выбрано: {selectedIds.size} из {selectableIncomes.length} (без учёта «Уже создан»).
              Итого УСН: <strong>{totalTax.toLocaleString('ru-RU')} ₽</strong>
              {legalEntity && legalEntity.vatPercent > 0 && (
                <> | НДС: <strong>{totalVat.toLocaleString('ru-RU')} ₽</strong></>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportCsv}
                disabled={selectedIds.size === 0}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                Скачать CSV
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={selectedIds.size === 0}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                Печать
              </button>
              <button
                type="button"
                onClick={createExpenses}
                disabled={creating || selectedIds.size === 0 || !costItemId}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {creating ? 'Создание...' : 'Сформировать расходы'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="text-red-600 bg-red-50 p-4 rounded-lg mb-4">{error}</div>}
      {success && <div className="text-green-700 bg-green-50 p-4 rounded-lg mb-4">{success}</div>}
    </div>
  );
}
