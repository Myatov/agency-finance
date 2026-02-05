'use client';

import { useState, useEffect } from 'react';
import RoleModal from './RoleModal';

interface Role {
  id: string;
  name: string;
  code: string;
  isSystem: boolean;
  permissions: Array<{
    id: string;
    section: string;
    permission: string;
  }>;
  _count: {
    users: number;
  };
}

interface User {
  id: string;
  roleCode: string;
}

export default function RolesList() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUser();
    fetchRoles();
  }, []);

  // Раздел Роли только для Владельца (скрыт от CEO)
  useEffect(() => {
    if (user && user.roleCode !== 'OWNER') {
      window.location.href = '/';
    }
  }, [user]);

  const fetchUser = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
    }
  };

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      if (res.ok) {
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingRole(null);
    setShowModal(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setShowModal(true);
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystem) {
      alert('Системные роли нельзя удалять');
      return;
    }

    if (role._count.users > 0) {
      alert(`Невозможно удалить роль: она назначена ${role._count.users} пользователю(ам)`);
      return;
    }

    if (!confirm(`Удалить роль "${role.name}"?`)) {
      return;
    }

    const res = await fetch(`/api/roles/${role.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchRoles();
    } else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  const canManage = user?.roleCode === 'OWNER';

  const sections = [
    { code: 'sites', label: 'Сайты' },
    { code: 'services', label: 'Услуги' },
    { code: 'clients', label: 'Клиенты' },
    { code: 'incomes', label: 'Доходы' },
    { code: 'expenses', label: 'Расходы' },
    { code: 'cost-items', label: 'Статьи расходов' },
    { code: 'employees', label: 'Сотрудники' },
    { code: 'products', label: 'Продукты' },
    { code: 'reports', label: 'Отчеты' },
    { code: 'legal-entities', label: 'Юрлица' },
    { code: 'roles', label: 'Роли' },
  ];

  const permissionLabels: Record<string, string> = {
    view: 'Просмотр',
    view_all: 'Просмотр всех',
    create: 'Создание',
    edit: 'Редактирование',
    delete: 'Удаление',
    manage: 'Полный доступ',
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Роли и права доступа</h1>
        {canManage && (
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
          >
            + Добавить роль
          </button>
        )}
      </div>

      <div className="space-y-6">
        {roles.map((role) => {
          const rolePermissions = role.permissions.reduce((acc, p) => {
            if (!acc[p.section]) {
              acc[p.section] = [];
            }
            acc[p.section].push(p.permission);
            return acc;
          }, {} as Record<string, string[]>);

          return (
            <div key={role.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">{role.name}</h2>
                  <p className="text-sm text-gray-500">
                    Код: {role.code} {role.isSystem && '(Системная)'} • Пользователей: {role._count.users}
                  </p>
                </div>
                <div className="flex space-x-2">
                  {canManage && (
                    <>
                      <button
                        onClick={() => handleEdit(role)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      >
                        Редактировать
                      </button>
                      {!role.isSystem && role._count.users === 0 && (
                        <button
                          onClick={() => handleDelete(role)}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                        >
                          Удалить
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {sections.map((section) => {
                    const perms = rolePermissions[section.code] || [];
                    const hasManage = perms.includes('manage');
                    const otherPerms = perms.filter((p) => p !== 'manage');

                    return (
                      <div key={section.code} className="border rounded-lg p-3">
                        <h3 className="font-medium text-sm mb-2">{section.label}</h3>
                        {hasManage ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Полный доступ
                          </span>
                        ) : otherPerms.length > 0 ? (
                          <div className="space-y-1">
                            {otherPerms.map((perm) => (
                              <div key={perm} className="text-xs text-gray-600">
                                • {permissionLabels[perm] || perm}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Нет доступа</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <RoleModal
          role={editingRole}
          onClose={() => {
            setShowModal(false);
            setEditingRole(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingRole(null);
            fetchRoles();
          }}
        />
      )}
    </div>
  );
}
