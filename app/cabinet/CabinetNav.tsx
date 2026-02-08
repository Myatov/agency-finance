'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function CabinetNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = [
    { href: '/cabinet', label: 'Обзор' },
    { href: '/cabinet/sites', label: 'Сайты' },
    { href: '/cabinet/services', label: 'Услуги' },
    { href: '/cabinet/invoices', label: 'Счета' },
    { href: '/cabinet/closeout', label: 'Закрывающие документы' },
    { href: '/cabinet/reports', label: 'Отчёты' },
  ];

  const handleLogout = async () => {
    await fetch('/api/auth/client-portal-logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/cabinet/enter';
  };

  return (
    <nav className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-1">
        {nav.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              pathname === href || (href !== '/cabinet' && pathname.startsWith(href))
                ? 'bg-teal-600 text-white'
                : 'text-teal-100 hover:bg-teal-600/80'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium"
        >
          Меню
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 py-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
            {nav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-2 text-sm ${pathname === href ? 'bg-teal-50 text-teal-800 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="ml-2 px-3 py-2 rounded-lg text-teal-100 hover:bg-teal-600/80 text-sm"
      >
        Выйти
      </button>
    </nav>
  );
}
