'use client';

import { useState, useEffect, useRef } from 'react';

export type ContactForm = {
  name: string;
  phone1: string;
  phone2: string;
  birthDate: string;
  telegram: string;
  whatsapp: string;
  position: string;
  note: string;
};

export interface Contact {
  id: string;
  name: string;
  phone1?: string | null;
  phone2?: string | null;
  birthDate?: string | null;
  telegram?: string | null;
  whatsapp?: string | null;
  position?: string | null;
  note?: string | null;
}

export default function ContactModal({
  contact,
  onClose,
  onSuccess,
  onDuplicateFound,
}: {
  contact: Contact | null;
  onClose: () => void;
  onSuccess: (createdOrUpdated?: Contact) => void;
  onDuplicateFound?: (duplicates: Contact[]) => void;
}) {
  const [formData, setFormData] = useState<ContactForm>({
    name: '',
    phone1: '',
    phone2: '',
    birthDate: '',
    telegram: '',
    whatsapp: '',
    position: '',
    note: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateConfirm, setDuplicateConfirm] = useState(false);
  const [pendingDuplicates, setPendingDuplicates] = useState<Contact[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name ?? '',
        phone1: contact.phone1 ?? '',
        phone2: contact.phone2 ?? '',
        birthDate: contact.birthDate ? new Date(contact.birthDate).toISOString().slice(0, 10) : '',
        telegram: contact.telegram ?? '',
        whatsapp: contact.whatsapp ?? '',
        position: contact.position ?? '',
        note: contact.note ?? '',
      });
    }
  }, [contact]);

  const updateField = (field: keyof ContactForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const checkDuplicates = async (): Promise<Contact[]> => {
    const opt = (s: string) => (s != null && String(s).trim() !== '' ? String(s).trim() : null);
    const phone1 = opt(formData.phone1);
    const phone2 = opt(formData.phone2);
    const telegram = opt(formData.telegram);
    const whatsapp = opt(formData.whatsapp);
    if (!phone1 && !phone2 && !telegram && !whatsapp) return [];

    const res = await fetch('/api/contacts/check-duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone1,
        phone2,
        telegram,
        whatsapp,
        excludeContactId: contact?.id ?? null,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.duplicates ?? [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const name = formData.name.trim();
    if (!name) {
      setError('Имя обязательно');
      return;
    }

    if (!duplicateConfirm) {
      const duplicates = await checkDuplicates();
      if (duplicates.length > 0 && onDuplicateFound) {
        setPendingDuplicates(duplicates);
        return;
      }
      if (duplicates.length > 0) {
        const byPhone = duplicates.some((d) => formData.phone1?.trim() && (d.phone1 === formData.phone1?.trim() || d.phone2 === formData.phone1?.trim()));
        const byTg = formData.telegram?.trim() && duplicates.some((d) => d.telegram?.toLowerCase() === formData.telegram?.trim()?.toLowerCase());
        const byWa = formData.whatsapp?.trim() && duplicates.some((d) => d.whatsapp?.toLowerCase() === formData.whatsapp?.trim()?.toLowerCase());
        const parts = [];
        if (byPhone) parts.push('телефоном');
        if (byTg) parts.push('Telegram');
        if (byWa) parts.push('WhatsApp');
        const msg = contact
          ? 'Найден другой контакт с таким же ' + parts.join(' / ') + '. Всё равно сохранить?'
          : 'Найден контакт с таким же ' + parts.join(' / ') + '. Вы уверены, что хотите создать новый?';
        if (!window.confirm(msg)) return;
        setDuplicateConfirm(true);
        return;
      }
    }

    setLoading(true);
    try {
      const opt = (s: string) => (s != null && String(s).trim() !== '' ? String(s).trim() : null);
      const payload = {
        name,
        phone1: opt(formData.phone1) ?? null,
        phone2: opt(formData.phone2) ?? null,
        birthDate: formData.birthDate || null,
        telegram: opt(formData.telegram) ?? null,
        whatsapp: opt(formData.whatsapp) ?? null,
        position: opt(formData.position) ?? null,
        note: opt(formData.note) ?? null,
      };

      const url = contact ? `/api/contacts/${contact.id}` : '/api/contacts';
      const method = contact ? 'PUT' : 'POST';
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
      onSuccess(data.contact);
    } catch (err) {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {contact ? 'Редактировать контакт' : 'Добавить контакт'}
        </h2>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Телефон 1</label>
              <input
                type="text"
                value={formData.phone1}
                onChange={(e) => updateField('phone1', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Телефон 2</label>
              <input
                type="text"
                value={formData.phone2}
                onChange={(e) => updateField('phone2', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">День рождения</label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => updateField('birthDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telegram</label>
              <input
                type="text"
                value={formData.telegram}
                onChange={(e) => updateField('telegram', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input
                type="text"
                value={formData.whatsapp}
                onChange={(e) => updateField('whatsapp', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Должность</label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => updateField('position', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Примечание</label>
            <textarea
              value={formData.note}
              onChange={(e) => updateField('note', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {pendingDuplicates != null && pendingDuplicates.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm font-medium text-amber-900 mb-2">
                Найден контакт с таким же телефоном / Telegram / WhatsApp:
              </p>
              <ul className="list-disc list-inside text-sm text-amber-800 mb-3">
                {pendingDuplicates.map((d) => (
                  <li key={d.id}>{d.name} {d.phone1 || d.telegram || d.whatsapp ? `(${[d.phone1, d.telegram, d.whatsapp].filter(Boolean).join(', ')})` : ''}</li>
                ))}
              </ul>
              <p className="text-sm text-amber-800 mb-3">Привязать его к клиенту или создать новый?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onDuplicateFound?.(pendingDuplicates);
                    setPendingDuplicates(null);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm"
                >
                  Привязать к клиенту
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingDuplicates(null);
                    setDuplicateConfirm(true);
                    setTimeout(() => formRef.current?.requestSubmit(), 0);
                  }}
                  className="px-3 py-1.5 border border-amber-600 text-amber-800 rounded-md hover:bg-amber-50 text-sm"
                >
                  Всё равно создать новый
                </button>
              </div>
            </div>
          )}

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
