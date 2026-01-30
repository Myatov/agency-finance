'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    // Fetch user to determine default route
    fetch('/api/auth/me', {
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) {
          // Not authenticated, redirect to login
          window.location.href = '/login';
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.defaultRoute) {
          // Small delay to ensure everything is ready
          setTimeout(() => {
            window.location.href = data.defaultRoute;
          }, 100);
        } else {
          // Fallback to services
          setTimeout(() => {
            window.location.href = '/services';
          }, 100);
        }
      })
      .catch(() => {
        // On error, redirect to login
        window.location.href = '/login';
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Загрузка...</p>
      </div>
    </div>
  );
}
