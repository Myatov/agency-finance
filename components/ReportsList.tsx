'use client';

import { useState } from 'react';
import { formatAmount, formatDate } from '@/lib/utils';
import { generateCSV, downloadCSV } from '@/lib/csv';

interface User {
  roleType: string;
}

export default function ReportsList() {
  const [activeTab, setActiveTab] = useState<'incomes' | 'expenses' | 'employees'>('incomes');
  const [filters, setFilters] = useState({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    accountManagerId: '',
    sellerId: '',
    siteId: '',
    serviceId: '',
    productId: '',
    legalEntityId: '',
    clientId: '',
    category: '',
  });
  const [loading, setLoading] = useState(false);
  const [incomesData, setIncomesData] = useState<any>(null);
  const [expensesData, setExpensesData] = useState<any>(null);
  const [employeesData, setEmployeesData] = useState<any>(null);

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      if (activeTab === 'incomes') {
        const res = await fetch(`/api/reports/incomes?${params}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Ошибка загрузки отчета по доходам');
        }
        const data = await res.json();
        if (!data || !data.incomes) {
          throw new Error('Некорректный формат данных отчета');
        }
        setIncomesData(data);
      } else if (activeTab === 'expenses') {
        const res = await fetch(`/api/reports/expenses?${params}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Ошибка загрузки отчета по расходам');
        }
        const data = await res.json();
        if (!data || !data.expenses) {
          throw new Error('Некорректный формат данных отчета');
        }
        setExpensesData(data);
      } else if (activeTab === 'employees') {
        const res = await fetch(`/api/reports/employees?${params}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Ошибка загрузки отчета по сотрудникам');
        }
        const data = await res.json();
        if (!data || !data.report) {
          throw new Error('Некорректный формат данных отчета');
        }
        setEmployeesData(data);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert(error instanceof Error ? error.message : 'Ошибка генерации отчета');
      // Reset data on error
      if (activeTab === 'incomes') setIncomesData(null);
      else if (activeTab === 'expenses') setExpensesData(null);
      else if (activeTab === 'employees') setEmployeesData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (activeTab === 'incomes' && incomesData && incomesData.incomes) {
      const rows = incomesData.incomes.map((inc: any) => ({
        date: formatDate(inc.incomeDate || inc.createdAt),
        amount: formatAmount(inc.amount),
        client: inc.service.site.client.name,
        site: inc.service.site.title,
        service: inc.service.product.name,
        product: inc.service.product.name,
        period: inc.workPeriod
          ? `${formatDate(inc.workPeriod.dateFrom)} — ${formatDate(inc.workPeriod.dateTo)}`
          : '',
        legalEntity: inc.legalEntity?.name || '',
        seller: inc.service.site.client.seller.fullName,
        accountManager: inc.service.site.accountManager?.fullName || '',
        comment: inc.comment || '',
        creator: inc.creator.fullName,
      }));
      const csv = generateCSV(rows, [
        'date',
        'amount',
        'client',
        'site',
        'service',
        'product',
        'period',
        'legalEntity',
        'seller',
        'accountManager',
        'comment',
        'creator',
      ]);
      downloadCSV(csv, `incomes_${filters.dateFrom}_${filters.dateTo}.csv`);
    } else if (activeTab === 'expenses' && expensesData && expensesData.expenses) {
      const rows = expensesData.expenses.map((exp: any) => ({
        date: formatDate(exp.paymentAt),
        amount: formatAmount(exp.amount),
        category: exp.costItem.costCategory?.name ?? '',
        costItem: exp.costItem.title,
        employee: exp.employee?.fullName || '',
        department: exp.employee?.department?.name || '',
        client: exp.site?.client?.name || '',
        site: exp.site?.title || '',
        legalEntity: exp.legalEntity?.name || '',
        service: exp.service?.product.name || '',
        comment: exp.comment || '',
        creator: exp.creator?.fullName || '',
      }));
      const csv = generateCSV(rows, [
        'date',
        'amount',
        'category',
        'costItem',
        'employee',
        'department',
        'client',
        'site',
        'legalEntity',
        'service',
        'comment',
        'creator',
      ]);
      downloadCSV(csv, `expenses_${filters.dateFrom}_${filters.dateTo}.csv`);
    } else if (activeTab === 'employees' && employeesData && employeesData.report) {
      const rows = employeesData.report.map((item: any) => ({
        employee: item.employee.fullName,
        department: item.employee.department?.name || '',
        incomeCount: item.incomeCount,
        incomeTotal: formatAmount(item.incomeTotal),
        expenseCount: item.expenseCount,
        expenseTotal: formatAmount(item.expenseTotal),
        difference: formatAmount(item.difference),
      }));
      const csv = generateCSV(rows, [
        'employee',
        'department',
        'incomeCount',
        'incomeTotal',
        'expenseCount',
        'expenseTotal',
        'difference',
      ]);
      downloadCSV(csv, `employees_${filters.dateFrom}_${filters.dateTo}.csv`);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Отчеты</h1>
        {(incomesData || expensesData || employeesData) && (
          <button
            onClick={handleExportCSV}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg font-medium"
          >
            Экспорт CSV
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('incomes')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'incomes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Доходы
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'expenses'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Расходы
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'employees'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              По сотрудникам
            </button>
          </nav>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата от
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата до
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          {activeTab === 'expenses' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Категория
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Все</option>
                <option value="SALARY">Зарплата</option>
                <option value="SALES_PERCENT">Проценты с продаж</option>
                <option value="OFFICE">Офис</option>
                <option value="HR">HR</option>
                <option value="AGENCY_PAYMENTS">Агентские выплаты</option>
                <option value="SERVICES">Сервисы</option>
                <option value="LINKS">Ссылки</option>
                <option value="CONTRACTOR">Подрядчик</option>
                <option value="OTHER">Другие расходы</option>
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Генерация...' : 'Сгенерировать отчет'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {activeTab === 'incomes' && incomesData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Отчет по доходам</h2>
              <div className="text-lg font-bold">
                Итого: {formatAmount(incomesData.total)} ({incomesData.count} записей)
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Дата
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сумма
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Клиент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сайт
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Услуга (Продукт)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Период работ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Юрлицо
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(incomesData.incomes || []).slice(0, 100).map((inc: any) => (
                  <tr key={inc.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(inc.incomeDate || inc.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {formatAmount(inc.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {inc.service.site.client.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {inc.service.site.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {inc.service.product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {inc.workPeriod
                        ? `${formatDate(inc.workPeriod.dateFrom)} — ${formatDate(inc.workPeriod.dateTo)}`
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {inc.legalEntity?.name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'expenses' && expensesData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Отчет по расходам</h2>
              <div className="text-lg font-bold">
                Итого: {formatAmount(expensesData.total)} ({expensesData.count} записей)
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Дата
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сумма
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Категория
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Тип расхода
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сотрудник
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Отдел
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Клиент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сайт
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Юрлицо
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Услуга
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Комментарий
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Кто внес
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(expensesData.expenses || []).slice(0, 100).map((exp: any) => (
                  <tr key={exp.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(exp.paymentAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {formatAmount(exp.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exp.costItem.costCategory?.name ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exp.costItem.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exp.employee?.fullName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exp.employee?.department?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exp.site?.client?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exp.site?.title || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exp.legalEntity?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exp.service?.product.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      {exp.comment || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exp.creator?.fullName || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'employees' && employeesData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="text-xl font-semibold">Отчет по сотрудникам</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сотрудник
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Отдел
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Доходов
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сумма доходов
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Расходов
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сумма расходов
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Разница
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(employeesData.report || []).map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {item.employee.fullName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.employee.department?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.incomeCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {formatAmount(item.incomeTotal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.expenseCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {formatAmount(item.expenseTotal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {formatAmount(item.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!incomesData && !expensesData && !employeesData && (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          Выберите параметры и нажмите "Сгенерировать отчет"
        </div>
      )}
    </div>
  );
}
