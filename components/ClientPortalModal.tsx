'use client';

import { useState, useEffect } from 'react';

interface ClientPortalModalProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
}

export default function ClientPortalModal({ clientId, clientName, onClose }: ClientPortalModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/portal-access`)
      .then((r) => r.json())
      .then((d) => {
        setHasAccess(!!d.hasAccess);
        setPortalLink(d.portalLink ?? null);
        setCreatedAt(d.createdAt ?? null);
      })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, [clientId]);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password || password.length < 4) {
      setError('Введите пароль (минимум 4 символа)');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/portal-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка');
        setSaving(false);
        return;
      }
      setHasAccess(true);
      setPortalLink(data.portalLink ?? null);
      setPassword('');
      setSaving(false);
    } catch {
      setError('Ошибка соединения');
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!portalLink) return;
    navigator.clipboard.writeText(portalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Личный кабинет клиента
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {clientName}
        </p>

        {loading ? (
          <p className="text-gray-500">Загрузка...</p>
        ) : (
          <>
            {portalLink && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ссылка для входа в личный кабинет
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={portalLink}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 whitespace-nowrap"
                  >
                    {copied ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Отправьте клиенту эту ссылку и пароль. Вход только по паролю на этой странице.
                </p>
                {createdAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Создано: {new Date(createdAt).toLocaleString('ru-RU')}
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleCreateOrUpdate} className="space-y-3">
              <div>
                <label htmlFor="portal-password" className="block text-sm font-medium text-gray-700 mb-1">
                  {hasAccess ? 'Сменить пароль' : 'Пароль для входа'}
                </label>
                <input
                  id="portal-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 4 символа"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  minLength={4}
                />
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : hasAccess ? 'Обновить пароль' : 'Создать доступ'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Закрыть
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
