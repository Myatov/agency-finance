'use client';

import { useState, useEffect } from 'react';
import EmployeeModal from './EmployeeModal';

interface Employee {
  id: string;
  fullName: string;
  departmentId?: string | null;
  department: {
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
}

interface Department {
  id: string;
  name: string;
  head?: {
    id: string;
    fullName: string;
  } | null;
}

interface User {
  id: string;
  roleCode: string;
  departmentId: string | null;
}

export default function EmployeesList() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUser();
    fetchDepartments();
    fetchEmployees();
  }, []);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchDepartments = async () => {
    const res = await fetch('/api/departments');
    const data = await res.json();
    console.log('EmployeesList fetchDepartments:', res.status, data);
    if (res.ok) {
      const depts = data.departments || [];
      console.log('EmployeesList setting departments:', depts.length);
      setDepartments(depts);
    } else {
      console.error('EmployeesList fetchDepartments error:', data.error);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    const res = await fetch('/api/employees');
    const data = await res.json();
    setEmployees(data.employees || []);
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingEmployee(null);
    setShowModal(true);
  };

  const handleEdit = (employee: Employee) => {
    console.log('EmployeesList handleEdit - departments:', departments.length);
    console.log('EmployeesList handleEdit - departments data:', departments);
    setEditingEmployee(employee);
    setShowModal(true);
  };

  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Удалить сотрудника "${employee.fullName}" навсегда? Это действие нельзя отменить. Связанные проекты и клиенты будут переназначены.`)) {
      return;
    }

    const res = await fetch(`/api/employees/${employee.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchEmployees();
      fetchDepartments(); // Refresh to update head info
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  const handleChangePassword = async (employee: Employee) => {
    const newPassword = prompt(`Введите новый пароль для ${employee.fullName}:`);
    if (!newPassword) {
      return;
    }

    const res = await fetch(`/api/employees/${employee.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });

    if (res.ok) {
      alert('Пароль успешно изменен');
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка изменения пароля');
    }
  };

  const handleSetDepartmentHead = async (departmentId: string, headId: string | null) => {
    const res = await fetch(`/api/departments/${departmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headId }),
    });

    if (res.ok) {
      fetchDepartments();
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка обновления руководителя');
    }
  };

  const canManage = (employee: Employee) => {
    if (!user) return false;
    if (user.roleCode === 'OWNER' || user.roleCode === 'CEO') return true;
    // HEAD can manage employees in their own department
    if (user.roleCode === 'HEAD' && employee.department?.id === user.departmentId) return true;
    return false;
  };

  const canChangePwd = (employee: Employee) => {
    if (!user) return false;
    if (user.roleCode === 'OWNER' || user.roleCode === 'CEO') return true;
    // HEAD can change passwords for employees in their own department
    if (user.roleCode === 'HEAD' && employee.department?.id === user.departmentId) return true;
    return false;
  };

  const canManageDepartments = () => {
    if (!user) return false;
    return user.roleCode === 'OWNER' || user.roleCode === 'CEO';
  };

  const canAddEmployee = () => {
    if (!user) return false;
    if (user.roleCode === 'OWNER' || user.roleCode === 'CEO') return true;
    // HEAD can add employees to their own department
    if (user.roleCode === 'HEAD' && user.departmentId) return true;
    return false;
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group employees by department
  const groupedByDepartment = filteredEmployees.reduce((acc, emp) => {
    const deptName = emp.department?.name || 'Без отдела';
    if (!acc[deptName]) {
      acc[deptName] = [];
    }
    acc[deptName].push(emp);
    return acc;
  }, {} as Record<string, Employee[]>);

  // Sort employees within each department
  Object.keys(groupedByDepartment).forEach((deptName) => {
    const department = departments.find((d) => d.name === deptName);
    const headId = department?.head?.id;

    groupedByDepartment[deptName].sort((a, b) => {
      // Head (by department.head) goes first
      const aIsHead = a.id === headId;
      const bIsHead = b.id === headId;
      
      if (aIsHead && !bIsHead) return -1;
      if (!aIsHead && bIsHead) return 1;

      // Then active employees
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;

      // Then sort by name
      return a.fullName.localeCompare(b.fullName);
    });
  });

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Команда</h1>
        {canAddEmployee() && (
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
          >
            + Добавить сотрудника
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <input
          type="text"
          placeholder="Поиск по имени..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md"
        />
      </div>

      {/* Employees by Department */}
      <div className="space-y-6">
        {Object.entries(groupedByDepartment).map(([deptName, deptEmployees]) => {
          const department = departments.find((d) => d.name === deptName);
          const headId = department?.head?.id;
          const departmentEmployees = employees.filter(
            (e) => e.department?.id === department?.id
          );

          return (
            <div key={deptName} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold">{deptName}</h2>
                  {department?.head && (
                    <p className="text-sm text-gray-600 mt-1">
                      Руководитель: {department.head.fullName}
                    </p>
                  )}
                </div>
                {canManageDepartments() && department && (
                  <select
                    value={headId || ''}
                    onChange={(e) =>
                      handleSetDepartmentHead(department.id, e.target.value || null)
                    }
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Нет руководителя</option>
                    {departmentEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Имя
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Роль
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Статус
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {deptEmployees.map((employee) => {
                      const isHead = employee.id === headId;
                      return (
                        <tr
                          key={employee.id}
                          className={`hover:bg-gray-50 ${
                            !employee.isActive ? 'opacity-60' : ''
                          } ${isHead ? 'bg-blue-50 font-semibold' : ''}`}
                        >
                          <td
                            className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                              isHead ? 'text-blue-900' : 'text-gray-900'
                            }`}
                          >
                            {employee.fullName}
                            {isHead && (
                              <span className="ml-2 text-xs text-blue-600">(Руководитель)</span>
                            )}
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap text-sm ${
                              isHead ? 'text-blue-700 font-medium' : 'text-gray-500'
                            }`}
                          >
                            {employee.role?.name || 'Без роли'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                employee.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {employee.isActive ? 'Активен' : 'Неактивен'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {canManage(employee) && (
                              <>
                                <button
                                  onClick={() => handleEdit(employee)}
                                  className="text-blue-600 hover:text-blue-900 mr-4"
                                >
                                  Редактировать
                                </button>
                                <button
                                  onClick={() => handleDelete(employee)}
                                  className="text-red-600 hover:text-red-900 mr-4"
                                >
                                  Удалить
                                </button>
                              </>
                            )}
                            {canChangePwd(employee) && (
                              <button
                                onClick={() => handleChangePassword(employee)}
                                className="text-purple-600 hover:text-purple-900"
                              >
                                Сменить пароль
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <EmployeeModal
          employee={editingEmployee}
          departments={departments}
          onClose={() => {
            setShowModal(false);
            setEditingEmployee(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingEmployee(null);
            fetchEmployees();
            fetchDepartments();
          }}
        />
      )}
    </div>
  );
}
