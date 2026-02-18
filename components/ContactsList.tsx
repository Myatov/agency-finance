'use client';

import { useState, useEffect, useCallback } from 'react';
import ContactModal, { type Contact } from './ContactModal';
import { formatDate } from '@/lib/utils';

interface ContactWithCount extends Contact {
  _count?: { clientLinks: number };
}

interface UserWithPermissions {
  roleCode: string;
  permissions?: {
    contacts?: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      manage: boolean;
      view_all: boolean;
    };
  };
}

export default function ContactsList() {
  const [contacts, setContacts] = useState<ContactWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [user, setUser] = useState<UserWithPermissions | null>(null);

  const canCreate = !!(user?.permissions?.contacts?.create || user?.permissions?.contacts?.manage);
  const canEdit = !!(user?.permissions?.contacts?.edit || user?.permissions?.contacts?.manage);
  const canDelete = !!(user?.permissions?.contacts?.delete || user?.permissions?.contacts?.manage);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const url = search.trim() ? `/api/contacts?q=${encodeURIComponent(search.trim())}` : '/api/contacts';
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    setContacts(data.contacts || []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => d.user && setUser(d.user));
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleAdd = () => {
    setEditingContact(null);
    setShowModal(true);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setShowModal(true);
  };

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Удалить контакт "${contact.name}"?`)) return;
    const res = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
    if (res.ok) fetchContacts();
    else {
      const data = await res.json();
      alert(data.error || 'Ошибка удаления');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Контакты клиентов</h1>
        <div className="flex items-center gap-4">
          <input
            type="search"
            placeholder="Поиск по имени, телефону, Telegram, WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md min-w-[280px]"
          />
          {canCreate && (
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-medium"
            >
              + Добавить контакт
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Имя</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Телефоны</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">День рождения</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telegram / WhatsApp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Должность</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Клиенты</th>
                {(canEdit || canDelete) && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {[c.phone1, c.phone2].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(c.birthDate)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {[c.telegram, c.whatsapp].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{c.position || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{c._count?.clientLinks ?? 0}</td>
                  {(canEdit || canDelete) && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {canEdit && (
                        <button onClick={() => handleEdit(c)} className="text-blue-600 hover:text-blue-900 mr-4">
                          Редактировать
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(c)} className="text-red-600 hover:text-red-900">
                          Удалить
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && contacts.length === 0 && (
          <div className="text-center py-8 text-gray-500">Контакты не найдены</div>
        )}
      </div>

      {showModal && (
        <ContactModal
          contact={editingContact}
          onClose={() => {
            setShowModal(false);
            setEditingContact(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingContact(null);
            fetchContacts();
          }}
        />
      )}
    </div>
  );
}
