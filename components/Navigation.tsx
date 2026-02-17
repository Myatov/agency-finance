'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

interface User {
  id: string;
  fullName: string;
  roleCode: string;
  departmentId: string | null;
}

export default function Navigation() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessibleSections, setAccessibleSections] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workMenuOpen, setWorkMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
          // OWNER видит всё, CEO — всё кроме Ролей и Юрлиц
      if (user.roleCode === 'OWNER') {
        setAccessibleSections([
          '/projects', '/sites', '/services', '/clients', '/contracts', '/invoices', '/closeout', '/storage',
          '/incomes', '/expenses', '/payments', '/employees', '/products', '/reports', '/roles', '/legal-entities', '/niches', '/contacts', '/agents',
        ]);
        return;
      }
      if (user.roleCode === 'CEO') {
        setAccessibleSections([
          '/projects', '/sites', '/services', '/clients', '/contracts', '/invoices', '/closeout', '/storage',
          '/incomes', '/expenses', '/payments', '/employees', '/products', '/reports', '/roles', '/niches', '/contacts', '/agents',
        ]);
        return;
      }

      // For other users, check permissions
      const sections = [
        { href: '/projects', section: 'projects' },
        { href: '/sites', section: 'sites' },
        { href: '/services', section: 'services' },
        { href: '/clients', section: 'clients' },
        { href: '/contracts', section: 'contracts' },
        { href: '/invoices', section: 'invoices' },
        { href: '/closeout', section: 'closeout' },
        { href: '/storage', section: 'storage' },
        { href: '/incomes', section: 'incomes' },
        { href: '/expenses', section: 'expenses' },
        { href: '/payments', section: 'payments' },
        { href: '/cost-items', section: 'cost-items' },
        { href: '/employees', section: 'employees' },
        { href: '/products', section: 'products' },
        { href: '/reports', section: 'reports' },
        { href: '/niches', section: 'niches' },
        { href: '/contacts', section: 'contacts' },
        { href: '/agents', section: 'agents' },
        { href: '/roles', section: 'roles' },
        { href: '/legal-entities', section: 'legal-entities' },
      ];

      Promise.all(
        sections.map(async (s) => {
          try {
            const res = await fetch('/api/permissions/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ section: s.section, permission: 'view' }),
            });
            if (res.ok) {
              const data = await res.json();
              return data.hasPermission ? s.href : null;
            }
          } catch (e) {
            // Ignore errors
          }
          return null;
        })
      ).then((results) => {
        setAccessibleSections(results.filter((r): r is string => r !== null));
      });
    }
  }, [user]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (settingsOpen && !target.closest('.settings-menu')) setSettingsOpen(false);
      if (workMenuOpen && !target.closest('.work-menu')) setWorkMenuOpen(false);
    };

    if (settingsOpen || workMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [settingsOpen, workMenuOpen]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  if (loading || !user) {
    return null;
  }

  const settingsItems: Array<{ href: string; label: string; section?: string }> = [
    { href: '/storage', label: 'Хранилище', section: 'storage' },
    { href: '/employees', label: 'Команда', section: 'employees' },
    { href: '/products', label: 'Продукты', section: 'products' },
    { href: '/cost-items', label: 'Статьи расходов', section: 'cost-items' },
    { href: '/niches', label: 'Ниши', section: 'niches' },
    { href: '/contacts', label: 'Контакты', section: 'contacts' },
    { href: '/agents', label: 'Агенты / Партнёры', section: 'agents' },
    { href: '/roles', label: 'Роли', section: 'roles' },
    { href: '/legal-entities', label: 'Юрлица', section: 'legal-entities' },
  ];

  const visibleSettingsItems =
    user.roleCode === 'OWNER' || user.roleCode === 'CEO'
      ? settingsItems
      : settingsItems.filter((item) => item.section && accessibleSections.includes(item.href));

  const workSubmenuAll = [
    { href: '/clients', label: 'Клиенты', section: 'clients' },
    { href: '/contracts', label: 'Договора', section: 'contracts' },
    { href: '/invoices', label: 'Счета', section: 'invoices' },
    { href: '/closeout', label: 'Закрывающие документы', section: 'closeout' },
    { href: '/sites', label: 'Сайты', section: 'sites' },
    { href: '/services', label: 'Услуги', section: 'services' },
  ];
  const workSubmenu =
    user.roleCode === 'OWNER' || user.roleCode === 'CEO'
      ? workSubmenuAll
      : workSubmenuAll.filter((item) => accessibleSections.includes(item.href));

  const baseNavItems = [
    { href: '/projects', label: 'Проекты' },
    { href: '#work', label: 'Клиенты и документы', isDropdown: true, submenu: workSubmenu },
    { href: '/incomes', label: 'Доходы' },
    { href: '/expenses', label: 'Расходы' },
    { href: '/payments', label: 'Оплаты' },
    { href: '/reports', label: 'Отчеты' },
  ];
  const navItems = baseNavItems;

  // Add Settings to nav items if there are visible settings items
  if (visibleSettingsItems.length > 0) {
    navItems.push({ href: '#', label: 'Настройки' } as { href: string; label: string });
  }

  const visibleNavItems =
    user.roleCode === 'OWNER' || user.roleCode === 'CEO'
      ? navItems
      : navItems.filter((item) => (item as any).isDropdown || item.href === '#' || accessibleSections.includes(item.href));

  return (
    <nav className="bg-white shadow-md border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Финансы агентства</h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {visibleNavItems.map((item) => {
                if ((item as any).isDropdown && (item as any).submenu) {
                  const sub = (item as any).submenu as Array<{ href: string; label: string }>;
                  const isActive = sub.some((s) => pathname === s.href);
                  return (
                    <div key="work" className="relative work-menu">
                      <button
                        onClick={() => { setWorkMenuOpen(!workMenuOpen); setSettingsOpen(false); }}
                        onMouseEnter={() => setWorkMenuOpen(true)}
                        className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                          isActive ? 'border-blue-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        }`}
                      >
                        {(item as any).label}
                        <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {workMenuOpen && (
                        <div
                          className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 py-1"
                          onMouseLeave={() => setWorkMenuOpen(false)}
                        >
                          {sub.map((subItem) => (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              onClick={() => setWorkMenuOpen(false)}
                              className={`block px-4 py-2 text-sm ${pathname === subItem.href ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-100'}`}
                            >
                              {subItem.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                if (item.label === 'Настройки') {
                  // Settings menu item
                  return (
                    <div key="settings" className="relative settings-menu">
                      <button
                        onClick={() => setSettingsOpen(!settingsOpen)}
                        className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                          visibleSettingsItems.some(item => pathname === item.href)
                            ? 'border-blue-500 text-gray-900'
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        }`}
                      >
                        {item.label}
                        <svg
                          className={`ml-1 h-4 w-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {settingsOpen && (
                        <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                          <div className="py-1">
                            {visibleSettingsItems.map((subItem) => (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                onClick={() => setSettingsOpen(false)}
                                className={`block px-4 py-2 text-sm ${
                                  pathname === subItem.href
                                    ? 'bg-blue-50 text-blue-900'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                {subItem.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                // Regular menu item
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      pathname === item.href
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">{user.fullName}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
            >
              Выход
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
