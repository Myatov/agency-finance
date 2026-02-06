'use client';

import { useState, useEffect } from 'react';

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
}

interface Permission {
  section: string;
  permission: string;
}

export default function RoleModal({
  role,
  onClose,
  onSuccess,
}: {
  role: Role | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    permissions: [] as Permission[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sections = [
    { code: 'sites', label: 'Сайты' },
    { code: 'services', label: 'Услуги' },
    { code: 'clients', label: 'Клиенты' },
    { code: 'contracts', label: 'Договора' },
    { code: 'closeout', label: 'Закрывающие документы' },
    { code: 'storage', label: 'Хранилище' },
    { code: 'incomes', label: 'Доходы' },
    { code: 'expenses', label: 'Расходы' },
    { code: 'cost-items', label: 'Статьи расходов' },
    { code: 'employees', label: 'Сотрудники' },
    { code: 'products', label: 'Продукты' },
    { code: 'reports', label: 'Отчеты' },
    { code: 'legal-entities', label: 'Юрлица' },
    { code: 'roles', label: 'Роли' },
  ];

  // Разделы, для которых можно включить «Просмотр всех» (иначе — только свои/все)
  const sectionsWithViewAll = ['sites', 'services', 'clients', 'incomes', 'expenses', 'employees', 'contracts', 'closeout', 'storage'];

  const permissions = [
    { code: 'view', label: 'Просмотр' },
    { code: 'view_all', label: 'Просмотр всех' },
    { code: 'create', label: 'Создание' },
    { code: 'edit', label: 'Редактирование' },
    { code: 'delete', label: 'Удаление' },
    { code: 'manage', label: 'Полный доступ' },
  ];

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        code: role.code,
        permissions: role.permissions.map((p) => ({
          section: p.section,
          permission: p.permission,
        })),
      });
    }
  }, [role]);

  const togglePermission = (section: string, permission: string) => {
    setFormData((prev) => {
      const newPerms = [...prev.permissions];
      const index = newPerms.findIndex(
        (p) => p.section === section && p.permission === permission
      );

      if (permission === 'manage') {
        // If toggling manage, remove all other permissions for this section
        const sectionPerms = newPerms.filter((p) => p.section === section);
        sectionPerms.forEach((p) => {
          const i = newPerms.findIndex((np) => np.section === p.section && np.permission === p.permission);
          if (i >= 0) newPerms.splice(i, 1);
        });

        if (index < 0) {
          newPerms.push({ section, permission: 'manage' });
        }
      } else {
        if (permission === 'view_all') {
          const manageIdx = newPerms.findIndex((p) => p.section === section && p.permission === 'manage');
          if (index >= 0) {
            newPerms.splice(index, 1);
            if (manageIdx >= 0) {
              newPerms.splice(manageIdx, 1);
              ['view', 'create', 'edit', 'delete'].forEach((p) => newPerms.push({ section, permission: p }));
            }
          } else if (manageIdx >= 0) {
            // Снять «Просмотр всех» при наличии manage: заменить manage на view, create, edit, delete
            newPerms.splice(manageIdx, 1);
            ['view', 'create', 'edit', 'delete'].forEach((p) => newPerms.push({ section, permission: p }));
          } else {
            newPerms.push({ section, permission: 'view_all' });
          }
        } else {
          const manageIndex = newPerms.findIndex(
            (p) => p.section === section && p.permission === 'manage'
          );
          if (manageIndex >= 0) newPerms.splice(manageIndex, 1);
          if (index >= 0) newPerms.splice(index, 1);
          else newPerms.push({ section, permission });
        }
      }

      return { ...prev, permissions: newPerms };
    });
  };

  const hasPermission = (section: string, permission: string): boolean => {
    return formData.permissions.some(
      (p) => p.section === section && p.permission === permission
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = role ? `/api/roles/${role.id}` : '/api/roles';
      const method = role ? 'PUT' : 'POST';

      const payload: any = {
        name: formData.name,
        permissions: formData.permissions,
      };

      if (!role) {
        payload.code = formData.code.toUpperCase().replace(/\s+/g, '_');
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
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {role ? 'Редактировать роль' : 'Добавить роль'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название роли *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Например: Аккаунт-менеджер"
            />
          </div>

          {!role && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Код роли * (будет автоматически преобразован в верхний регистр)
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Например: ACCOUNT_MANAGER"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Права доступа
            </label>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Раздел
                    </th>
                    {permissions.map((perm) => (
                      <th
                        key={perm.code}
                        className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                      >
                        {perm.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sections.map((section) => (
                    <tr key={section.code}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {section.label}
                      </td>
                      {permissions.map((perm) => {
                        const isViewAll = perm.code === 'view_all';
                        const showCell = !isViewAll || sectionsWithViewAll.includes(section.code);
                        const checked = hasPermission(section.code, perm.code) || (isViewAll && hasPermission(section.code, 'manage'));
                        return (
                          <td key={perm.code} className="px-4 py-3 text-center">
                            {showCell ? (
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(section.code, perm.code)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
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
