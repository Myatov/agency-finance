'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CabinetEnterTokenPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === 'string' ? params.token : '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/client-portal-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка входа');
        setLoading(false);
        return;
      }
      if (data.redirectTo) {
        window.location.href = data.redirectTo;
        return;
      }
      router.push('/cabinet');
    } catch {
      setError('Ошибка соединения');
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <p className="text-slate-600">Неверная ссылка. Используйте ссылку от менеджера.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
      <div className="max-w-sm w-full bg-white rounded-xl shadow-sm p-8 border border-slate-200">
        <h1 className="text-xl font-semibold text-slate-800 text-center mb-2">
          Вход в личный кабинет
        </h1>
        <p className="text-slate-500 text-sm text-center mb-6">
          Введите пароль, который вам сообщил менеджер
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="sr-only">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              autoFocus
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
