'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatAmount, formatDate } from '@/lib/utils';
import { generateCSV, downloadCSV } from '@/lib/csv';

interface User {
  roleType: string;
}

type ReportTab = 'incomes' | 'expenses' | 'employees' | 'employeeEarnings' | 'servicesWithoutPeriods';

export default function ReportsList() {
  const [activeTab, setActiveTab] = useState<ReportTab>('incomes');
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
    departmentId: '',
  });
  const [loading, setLoading] = useState(false);
  const [incomesData, setIncomesData] = useState<any>(null);
  const [expensesData, setExpensesData] = useState<any>(null);
  const [employeesData, setEmployeesData] = useState<any>(null);
  const [employeeEarningsData, setEmployeeEarningsData] = useState<any>(null);
  const [servicesWithoutPeriodsData, setServicesWithoutPeriodsData] = useState<any>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [earningsViewMode, setEarningsViewMode] = useState<'employee' | 'department'>('employee');

  useEffect(() => {
    fetch('/api/departments')
      .then((r) => r.ok ? r.json() : { departments: [] })
      .then((data) => setDepartments(data.departments || data || []))
      .catch(() => setDepartments([]));
  }, []);

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
      } else if (activeTab === 'employeeEarnings') {
        const earningsParams = new URLSearchParams();
        earningsParams.set('periodFrom', filters.dateFrom);
        earningsParams.set('periodTo', filters.dateTo);
        if (filters.departmentId) earningsParams.set('departmentId', filters.departmentId);
        const res = await fetch(`/api/reports/employee-earnings?${earningsParams}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Ошибка загрузки отчета по расчётам');
        }
        const data = await res.json();
        if (!data || !data.employees) {
          throw new Error('Некорректный формат данных отчета');
        }
        setEmployeeEarningsData(data);
      } else if (activeTab === 'servicesWithoutPeriods') {
        const res = await fetch('/api/reports/services-without-periods');
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const msg = errorData.details || errorData.error || 'Ошибка загрузки отчета';
          throw new Error(msg);
        }
        const data = await res.json();
        if (!data || !Array.isArray(data.services)) {
          throw new Error('Некорректный формат данных отчета');
        }
        setServicesWithoutPeriodsData(data);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert(error instanceof Error ? error.message : 'Ошибка генерации отчета');
      if (activeTab === 'incomes') setIncomesData(null);
      else if (activeTab === 'expenses') setExpensesData(null);
      else if (activeTab === 'employees') setEmployeesData(null);
      else if (activeTab === 'employeeEarnings') setEmployeeEarningsData(null);
      else if (activeTab === 'servicesWithoutPeriods') setServicesWithoutPeriodsData(null);
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
        seller: inc.service.site.client.seller?.fullName || '',
        accountManager: inc.service.site.client.accountManager?.fullName || '',
        partner: inc.service.site.client.agent?.name || '',
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
        'partner',
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
        accountManager: exp.site?.client?.accountManager?.fullName || '',
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
        'accountManager',
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
    } else if (activeTab === 'employeeEarnings' && employeeEarningsData?.employees) {
      const source = earningsViewMode === 'department' ? getDepartmentTotals() : employeeEarningsData.employees;
      const rows = source.map((item: any) => ({
        name: earningsViewMode === 'department' ? item.department : item.fullName,
        department: earningsViewMode === 'department' ? '' : (item.department || ''),
        fixedSalary: formatAmount(item.fixedSalary),
        expectedCommissions: formatAmount(item.expectedCommissions),
        expectedFees: formatAmount(item.expectedFees),
        motivationBonus: formatAmount(item.motivationBonus),
        totalExpected: formatAmount(item.totalExpected),
        totalPaid: formatAmount(item.totalPaid),
        balance: formatAmount(item.balance),
      }));
      const columns = earningsViewMode === 'department'
        ? ['name', 'fixedSalary', 'expectedCommissions', 'expectedFees', 'motivationBonus', 'totalExpected', 'totalPaid', 'balance']
        : ['name', 'department', 'fixedSalary', 'expectedCommissions', 'expectedFees', 'motivationBonus', 'totalExpected', 'totalPaid', 'balance'];
      const csv = generateCSV(rows, columns);
      downloadCSV(csv, `employee_earnings_${filters.dateFrom}_${filters.dateTo}.csv`);
    } else if (activeTab === 'servicesWithoutPeriods' && servicesWithoutPeriodsData?.services) {
      const rows = servicesWithoutPeriodsData.services.map((s: any) => ({
        client: s.site?.client?.name ?? '',
        site: s.site?.title ?? '',
        product: s.product?.name ?? '',
        accountManager: s.site?.client?.accountManager?.fullName ?? s.site?.accountManager?.fullName ?? '',
      }));
      const csv = generateCSV(rows, ['client', 'site', 'product', 'accountManager']);
      downloadCSV(csv, 'services_without_periods.csv');
    }
  };

  const getDepartmentTotals = () => {
    if (!employeeEarningsData?.employees) return [];
    const deptMap = new Map<string, any>();
    for (const emp of employeeEarningsData.employees) {
      const deptName = emp.department || 'Без отдела';
      const existing = deptMap.get(deptName) || {
        department: deptName,
        fixedSalary: 0,
        expectedCommissions: 0,
        expectedFees: 0,
        motivationBonus: 0,
        totalExpected: 0,
        totalPaid: 0,
        balance: 0,
        count: 0,
      };
      existing.fixedSalary += emp.fixedSalary || 0;
      existing.expectedCommissions += emp.expectedCommissions || 0;
      existing.expectedFees += emp.expectedFees || 0;
      existing.motivationBonus += emp.motivationBonus || 0;
      existing.totalExpected += emp.totalExpected || 0;
      existing.totalPaid += emp.totalPaid || 0;
      existing.balance += emp.balance || 0;
      existing.count += 1;
      deptMap.set(deptName, existing);
    }
    return Array.from(deptMap.values());
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Отчеты</h1>
        {(incomesData || expensesData || employeesData || employeeEarningsData || servicesWithoutPeriodsData) && (
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
            <button
              onClick={() => setActiveTab('employeeEarnings')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'employeeEarnings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Расчёт по сотрудникам
            </button>
            <button
              onClick={() => setActiveTab('servicesWithoutPeriods')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'servicesWithoutPeriods'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Услуги без периодов
            </button>
          </nav>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {activeTab !== 'servicesWithoutPeriods' && (
            <>
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
            </>
          )}
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
          {activeTab === 'employeeEarnings' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Отдел
              </label>
              <select
                value={filters.departmentId}
                onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Все отделы</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={`flex items-end ${activeTab === 'servicesWithoutPeriods' ? 'md:col-span-1' : ''}`}>
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Генерация...' : activeTab === 'servicesWithoutPeriods' ? 'Загрузить отчет' : 'Сгенерировать отчет'}
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
                    Аккаунт-менеджер
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Партнёр
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
                      {inc.service.site.client.accountManager?.fullName || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {inc.service.site.client.seller?.fullName || '—'}
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

      {activeTab === 'employeeEarnings' && employeeEarningsData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Расчёт по сотрудникам</h2>
              <div className="flex items-center gap-4">
                <div className="flex bg-gray-200 rounded-lg p-1">
                  <button
                    onClick={() => setEarningsViewMode('employee')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      earningsViewMode === 'employee'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    По сотрудникам
                  </button>
                  <button
                    onClick={() => setEarningsViewMode('department')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      earningsViewMode === 'department'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    По отделам
                  </button>
                </div>
                {employeeEarningsData.totals && (
                  <div className="text-sm">
                    <span className="text-gray-500">Итого ожидаемое:</span>{' '}
                    <span className="font-bold">{formatAmount(employeeEarningsData.totals.totalExpected)}</span>
                    {' | '}
                    <span className="text-gray-500">Выплачено:</span>{' '}
                    <span className="font-bold">{formatAmount(employeeEarningsData.totals.totalPaid)}</span>
                    {' | '}
                    <span className="text-gray-500">Баланс:</span>{' '}
                    <span className={`font-bold ${employeeEarningsData.totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatAmount(employeeEarningsData.totals.balance)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {earningsViewMode === 'employee' ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сотрудник</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Отдел</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Фикс. зарплата</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ожид. комиссии</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ожид. ведение</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Мотивация</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Итого ожид.</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Выплачено</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Баланс</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(employeeEarningsData.employees || []).map((emp: any) => (
                    <tr key={emp.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{emp.fullName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.department || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatAmount(emp.fixedSalary)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatAmount(emp.expectedCommissions)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatAmount(emp.expectedFees)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatAmount(emp.motivationBonus)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">{formatAmount(emp.totalExpected)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">{formatAmount(emp.totalPaid)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${emp.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatAmount(emp.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Отдел</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Сотрудников</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Фикс. зарплата</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ожид. комиссии</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ожид. ведение</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Мотивация</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Итого ожид.</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Выплачено</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Баланс</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getDepartmentTotals().map((dept: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{dept.department}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{dept.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatAmount(dept.fixedSalary)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatAmount(dept.expectedCommissions)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatAmount(dept.expectedFees)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{formatAmount(dept.motivationBonus)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">{formatAmount(dept.totalExpected)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">{formatAmount(dept.totalPaid)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${dept.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatAmount(dept.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'servicesWithoutPeriods' && servicesWithoutPeriodsData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Услуги без периодов</h2>
              <div className="text-lg font-bold">
                Активных услуг без созданных периодов: {servicesWithoutPeriodsData.count}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Клиент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Сайт
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Услуга (продукт)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Аккаунт-менеджер
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Действие
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(servicesWithoutPeriodsData.services || []).map((s: any) => (
                  <tr key={s.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {s.site?.client?.name ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {s.site?.title ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {s.product?.name ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {s.site?.accountManager?.fullName ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/services/${s.id}/periods`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Периоды →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!incomesData && !expensesData && !employeesData && !employeeEarningsData && !servicesWithoutPeriodsData && (
        <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
          {activeTab === 'servicesWithoutPeriods'
            ? 'Нажмите "Сгенерировать отчет" для загрузки активных услуг без периодов'
            : 'Выберите параметры и нажмите "Сгенерировать отчет"'}
        </div>
      )}
    </div>
  );
}
