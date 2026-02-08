'use client';

import { useEffect, useState } from 'react';

interface Site {
  id: string;
  title: string;
  websiteUrl: string | null;
  niche: string;
  isActive: boolean;
}

export default function CabinetSitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client-portal/sites', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setSites(d.sites ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Загрузка...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Сайты</h2>
      {sites.length === 0 ? (
        <p className="text-slate-500">Нет сайтов</p>
      ) : (
        <ul className="space-y-3">
          {sites.map((s) => (
            <li
              key={s.id}
              className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
            >
              <div className="font-medium text-slate-800">{s.title}</div>
              {s.websiteUrl && (
                <a
                  href={s.websiteUrl.startsWith('http') ? s.websiteUrl : `https://${s.websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-teal-600 hover:underline"
                >
                  {s.websiteUrl}
                </a>
              )}
              <div className="text-sm text-slate-500 mt-1">Ниша: {s.niche}</div>
              <span
                className={`inline-block mt-2 text-xs px-2 py-1 rounded ${
                  s.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {s.isActive ? 'Активен' : 'Неактивен'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
