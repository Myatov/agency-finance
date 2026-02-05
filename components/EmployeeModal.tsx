'use client';

import { useState, useEffect } from 'react';

interface Employee {
  id: string;
  fullName: string;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  roleId: string;
  role: {
    id: string;
    name: string;
    code: string;
  };
  isActive: boolean;
  birthDate?: string | null;
  workStartDate?: string | null;
  emailWork?: string | null;
  emailGoogle?: string | null;
  phonePersonal?: string | null;
  phoneWork?: string | null;
  telegramPersonal?: string | null;
  telegramWork?: string | null;
  hasSpouse?: boolean | null;
  hasChildren?: boolean | null;
  childrenCount?: number | null;
  childrenBirthDates?: string | null;
}

interface Department {
  id: string;
  name: string;
  head?: {
    id: string;
    fullName: string;
  } | null;
}

interface Role {
  id: string;
  name: string;
  code: string;
}

export default function EmployeeModal({
  employee,
  departments,
  onClose,
  onSuccess,
}: {
  employee: Employee | null;
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    fullName: '',
    departmentId: '',
    roleId: '',
    password: '',
    isActive: true,
    birthDate: '',
    workStartDate: '',
    emailWork: '',
    emailGoogle: '',
    phonePersonal: '',
    phoneWork: '',
    telegramPersonal: '',
    telegramWork: '',
    hasSpouse: false,
    hasChildren: false,
    childrenCount: '' as string | number,
    childrenBirthDates: '',
  });
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localDepartments, setLocalDepartments] = useState<Department[]>([]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments', {
        credentials: 'include', // Ensure cookies are sent
      });
      const data = await res.json();
      if (res.ok && data.departments) {
        console.log('EmployeeModal fetchDepartments success:', data.departments.length);
        setLocalDepartments(data.departments);
      } else {
        console.error('EmployeeModal fetchDepartments error:', data.error);
      }
    } catch (err) {
      console.error('EmployeeModal fetchDepartments exception:', err);
    }
  };

  useEffect(() => {
    fetchRoles();
    // Always fetch departments when modal opens
    fetchDepartments();
  }, []);

  // Use departments from props if available, otherwise use local
  useEffect(() => {
    if (departments && departments.length > 0) {
      setLocalDepartments(departments);
    }
  }, [departments]);

  const toDateStr = (d: string | Date | null | undefined) =>
    !d ? '' : typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);

  useEffect(() => {
    if (employee) {
      setFormData({
        fullName: employee.fullName,
        departmentId: employee.departmentId || employee.department?.id || '',
        roleId: employee.roleId,
        password: '',
        isActive: employee.isActive,
        birthDate: toDateStr(employee.birthDate),
        workStartDate: toDateStr(employee.workStartDate),
        emailWork: employee.emailWork || '',
        emailGoogle: employee.emailGoogle || '',
        phonePersonal: employee.phonePersonal || '',
        phoneWork: employee.phoneWork || '',
        telegramPersonal: employee.telegramPersonal || '',
        telegramWork: employee.telegramWork || '',
        hasSpouse: employee.hasSpouse ?? false,
        hasChildren: employee.hasChildren ?? false,
        childrenCount: employee.childrenCount ?? '',
        childrenBirthDates: employee.childrenBirthDates || '',
      });
    } else {
      setFormData({
        fullName: '',
        departmentId: '',
        roleId: '',
        password: '',
        isActive: true,
        birthDate: '',
        workStartDate: '',
        emailWork: '',
        emailGoogle: '',
        phonePersonal: '',
        phoneWork: '',
        telegramPersonal: '',
        telegramWork: '',
        hasSpouse: false,
        hasChildren: false,
        childrenCount: '',
        childrenBirthDates: '',
      });
    }
  }, [employee]);

  const fetchRoles = async () => {
    const res = await fetch('/api/roles');
    if (res.ok) {
      const data = await res.json();
      setRoles(data.roles || []);
      // Set default role if not editing
      if (!employee && data.roles && data.roles.length > 0) {
        const defaultRole = data.roles.find((r: Role) => r.code === 'EMPLOYEE') || data.roles[2]; // First non-system role
        if (defaultRole) {
          setFormData((prev) => ({ ...prev, roleId: defaultRole.id }));
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = employee ? `/api/employees/${employee.id}` : '/api/employees';
      const method = employee ? 'PUT' : 'POST';

      const payload: any = {
        fullName: formData.fullName,
        departmentId: formData.departmentId || null,
        roleId: formData.roleId,
        isActive: formData.isActive,
        birthDate: formData.birthDate || null,
        workStartDate: formData.workStartDate || null,
        emailWork: formData.emailWork || null,
        emailGoogle: formData.emailGoogle || null,
        phonePersonal: formData.phonePersonal || null,
        phoneWork: formData.phoneWork || null,
        telegramPersonal: formData.telegramPersonal || null,
        telegramWork: formData.telegramWork || null,
        hasSpouse: formData.hasSpouse,
        hasChildren: formData.hasChildren,
        childrenCount: formData.childrenCount === '' ? null : Number(formData.childrenCount),
        childrenBirthDates: formData.childrenBirthDates || null,
      };

      if (!employee) {
        payload.password = formData.password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка сохранения');
        setLoading(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Ошибка соединения');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {employee ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ФИО *
            </label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Отдел
            </label>
            <select
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Без отдела</option>
              {localDepartments && Array.isArray(localDepartments) && localDepartments.length > 0
                ? localDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))
                : null}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Роль *
            </label>
            <select
              required
              value={formData.roleId}
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          {!employee && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Пароль *
              </label>
              <input
                type="password"
                required={!employee}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
              Активен
            </label>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Дополнительно (необязательно)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Дата рождения</label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Дата старта работы</label>
                <input
                  type="date"
                  value={formData.workStartDate}
                  onChange={(e) => setFormData({ ...formData, workStartDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email рабочий</label>
                <input
                  type="email"
                  value={formData.emailWork}
                  onChange={(e) => setFormData({ ...formData, emailWork: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email для Google документов</label>
                <input
                  type="email"
                  value={formData.emailGoogle}
                  onChange={(e) => setFormData({ ...formData, emailGoogle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Телефон личный</label>
                <input
                  type="text"
                  value={formData.phonePersonal}
                  onChange={(e) => setFormData({ ...formData, phonePersonal: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Телефон рабочий</label>
                <input
                  type="text"
                  value={formData.phoneWork}
                  onChange={(e) => setFormData({ ...formData, phoneWork: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">ТГ аккаунт личный</label>
                <input
                  type="text"
                  value={formData.telegramPersonal}
                  onChange={(e) => setFormData({ ...formData, telegramPersonal: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">ТГ аккаунт рабочий</label>
                <input
                  type="text"
                  value={formData.telegramWork}
                  onChange={(e) => setFormData({ ...formData, telegramWork: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasSpouse}
                    onChange={(e) => setFormData({ ...formData, hasSpouse: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Наличие супруга/супруги</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.hasChildren}
                    onChange={(e) => setFormData({ ...formData, hasChildren: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Наличие ребёнка</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Сколько детей</label>
                <input
                  type="number"
                  min={0}
                  value={formData.childrenCount}
                  onChange={(e) => setFormData({ ...formData, childrenCount: e.target.value })}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Даты рождения детей (строка)</label>
                <input
                  type="text"
                  value={formData.childrenBirthDates}
                  onChange={(e) => setFormData({ ...formData, childrenBirthDates: e.target.value })}
                  placeholder="Например: 01.05.2020, 15.03.2022"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
