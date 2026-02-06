'use client';

import { useState, useEffect, useRef } from 'react';
import ContactModal, { type Contact } from './ContactModal';

const CONTACT_ROLES = [
  { value: 'OWNER', label: 'Владелец' },
  { value: 'MARKETING', label: 'Маркетинг' },
  { value: 'FINANCE', label: 'Финансы' },
  { value: 'IT', label: 'IT' },
  { value: 'OTHER', label: 'Другое' },
] as const;

interface ClientContactLink {
  contactId: string;
  role: string;
  isPrimary: boolean;
  contact?: { id: string; name: string; phone1?: string | null; telegram?: string | null; whatsapp?: string | null };
}

interface Client {
  id: string;
  name: string;
  legalEntityId?: string | null;
  sellerEmployeeId: string;
  legalEntityName?: string | null;
  contractBasis?: string | null;
  legalAddress?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  rs?: string | null;
  bankName?: string | null;
  bik?: string | null;
  ks?: string | null;
  paymentRequisites?: string | null;
  contacts?: string | null;
  isReturningClient?: boolean;
  isKeyClient?: boolean;
  keyClientStatusComment?: string | null;
  returningClientStatusComment?: string | null;
  clientContacts?: Array<{
    contactId: string;
    role: string | null;
    isPrimary: boolean;
    contact: { id: string; name: string; phone1?: string | null; telegram?: string | null; whatsapp?: string | null };
  }>;
}

interface LegalEntity {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface User {
  id: string;
  fullName: string;
}

export default function ClientModal({
  client,
  onClose,
  onSuccess,
}: {
  client: Client | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    legalEntityId: '',
    sellerEmployeeId: '',
    legalEntityName: '',
    contractBasis: '',
    legalAddress: '',
    inn: '',
    kpp: '',
    ogrn: '',
    rs: '',
    bankName: '',
    bik: '',
    ks: '',
    paymentRequisites: '',
    contacts: '',
    isReturningClient: false,
    isKeyClient: false,
    keyClientStatusComment: '',
    returningClientStatusComment: '',
  });
  const [users, setUsers] = useState<User[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [clientContactsLinks, setClientContactsLinks] = useState<ClientContactLink[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState<Contact[]>([]);
  const [contactSearching, setContactSearching] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const contactSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchLegalEntities();
  }, []);

  useEffect(() => {
    if (client) {
      const c = client as Client & { legalEntity?: { id: string; name?: string } | null; seller?: { id: string } };
      setFormData({
        name: c.name ?? '',
        legalEntityId: c.legalEntityId ?? c.legalEntity?.id ?? '',
        sellerEmployeeId: c.sellerEmployeeId ?? c.seller?.id ?? '',
        legalEntityName: c.legalEntityName ?? c.legalEntity?.name ?? '',
        contractBasis: c.contractBasis ?? '',
        legalAddress: c.legalAddress ?? '',
        inn: c.inn ?? '',
        kpp: c.kpp ?? '',
        ogrn: c.ogrn ?? '',
        rs: c.rs ?? '',
        bankName: c.bankName ?? '',
        bik: c.bik ?? '',
        ks: c.ks ?? '',
        paymentRequisites: c.paymentRequisites ?? '',
        contacts: c.contacts ?? '',
        isReturningClient: Boolean(c.isReturningClient),
        isKeyClient: Boolean(c.isKeyClient),
        keyClientStatusComment: c.keyClientStatusComment ?? '',
        returningClientStatusComment: c.returningClientStatusComment ?? '',
      });
      if (c.clientContacts && Array.isArray(c.clientContacts)) {
        setClientContactsLinks(
          c.clientContacts.map((cc) => ({
            contactId: cc.contactId,
            role: cc.role ?? 'OTHER',
            isPrimary: cc.isPrimary,
            contact: cc.contact,
          }))
        );
      } else {
        setClientContactsLinks([]);
      }
    } else {
      setClientContactsLinks([]);
    }
  }, [client]);

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data.users || []);
  };

  useEffect(() => {
    const q = contactSearch.trim();
    if (!q || q.length < 2) {
      setContactSearchResults([]);
      return;
    }
    if (contactSearchRef.current) clearTimeout(contactSearchRef.current);
    contactSearchRef.current = setTimeout(async () => {
      setContactSearching(true);
      try {
        const res = await fetch(`/api/contacts?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const list = data.contacts || [];
        setContactSearchResults(list);
      } catch {
        setContactSearchResults([]);
      } finally {
        setContactSearching(false);
      }
      contactSearchRef.current = null;
    }, 300);
    return () => {
      if (contactSearchRef.current) clearTimeout(contactSearchRef.current);
    };
  }, [contactSearch]);

  const addContactToClient = (c: Contact) => {
    if (clientContactsLinks.some((l) => l.contactId === c.id)) return;
    setClientContactsLinks((prev) => [...prev, { contactId: c.id, role: 'OTHER', isPrimary: prev.length === 0, contact: c }]);
    setContactSearch('');
    setContactSearchResults([]);
  };

  const removeContactFromClient = (contactId: string) => {
    setClientContactsLinks((prev) => prev.filter((l) => l.contactId !== contactId));
  };

  const setContactRole = (contactId: string, role: string) => {
    setClientContactsLinks((prev) => prev.map((l) => (l.contactId === contactId ? { ...l, role } : l)));
  };

  const setPrimaryContact = (contactId: string) => {
    setClientContactsLinks((prev) => prev.map((l) => ({ ...l, isPrimary: l.contactId === contactId })));
  };

  const fetchLegalEntities = async () => {
    try {
      const res = await fetch('/api/legal-entities');
      const data = await res.json();
      if (res.ok) {
        // API already returns only active entities, but filter just in case
        setLegalEntities((data.legalEntities || []).filter((le: LegalEntity) => le.isActive));
      } else {
        console.error('Error fetching legal entities:', data.error || 'Unknown error');
        // Don't show error to user, just log it - dropdown will be empty
      }
    } catch (error) {
      console.error('Error fetching legal entities:', error);
    }
  };

  const selectedLegalEntity = legalEntities.find((le) => le.id === formData.legalEntityId);
  const showRequisitesBlock = true;
  const hideContractBasis = selectedLegalEntity && ['ИП Мятов Сбербанк', 'ИП Мятов ВТБ', 'ООО Велюр Груп'].includes(selectedLegalEntity.name);

  const toNull = (s: string | null | undefined) => (s != null && String(s).trim() !== '' ? String(s).trim() : null);

  const updateField = (field: keyof typeof formData, value: string | boolean) => {
    formDataRef.current = { ...formDataRef.current, [field]: value };
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const latest = formDataRef.current;
    const selectedLE = legalEntities.find((le) => le.id === latest.legalEntityId);
    const hideBasis = selectedLE && ['ИП Мятов Сбербанк', 'ИП Мятов ВТБ', 'ООО Велюр Груп'].includes(selectedLE.name);

    try {
      const url = client ? `/api/clients/${client.id}` : '/api/clients';
      const method = client ? 'PUT' : 'POST';

      const payload = {
        name: (latest.name ?? '').trim(),
        legalEntityId: (latest.legalEntityId ?? '').trim() || null,
        sellerEmployeeId: (latest.sellerEmployeeId ?? '').trim(),
        legalEntityName: toNull(latest.legalEntityName),
        contractBasis: hideBasis ? null : toNull(latest.contractBasis),
        legalAddress: toNull(latest.legalAddress),
        inn: toNull(latest.inn),
        kpp: toNull(latest.kpp),
        ogrn: toNull(latest.ogrn),
        rs: toNull(latest.rs),
        bankName: toNull(latest.bankName),
        bik: toNull(latest.bik),
        ks: toNull(latest.ks),
        paymentRequisites: toNull(latest.paymentRequisites),
        contacts: toNull(latest.contacts),
        isReturningClient: Boolean(latest.isReturningClient),
        isKeyClient: Boolean(latest.isKeyClient),
        keyClientStatusComment: toNull(latest.keyClientStatusComment),
        returningClientStatusComment: toNull(latest.returningClientStatusComment),
        clientContacts: clientContactsLinks.map((l) => ({ contactId: l.contactId, role: l.role, isPrimary: l.isPrimary })),
      };
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

      setLoading(false);
      onSuccess();
    } catch (err) {
      setError('Ошибка соединения');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {client ? 'Редактировать клиента' : 'Добавить клиента'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название клиента
            </label>
            <input
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Юрлицо
            </label>
            <select
              name="legalEntityId"
              required
              value={formData.legalEntityId}
              onChange={(e) => {
                const id = e.target.value;
                const next = { ...formDataRef.current, legalEntityId: id };
                formDataRef.current = next;
                setFormData(next);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Выберите юрлицо</option>
              {legalEntities.map((legalEntity) => (
                <option key={legalEntity.id} value={legalEntity.id}>
                  {legalEntity.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Продавец
            </label>
            <select
              name="sellerEmployeeId"
              required
              value={formData.sellerEmployeeId}
              onChange={(e) => updateField('sellerEmployeeId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Выберите продавца</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3">Статусы</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isReturningClient}
                  onChange={(e) => updateField('isReturningClient', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Вернувшийся клиент</span>
              </label>
              {formData.isReturningClient && (
                <div className="ml-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий к статусу (почему вернулся)</label>
                  <textarea
                    value={formData.returningClientStatusComment}
                    onChange={(e) => updateField('returningClientStatusComment', e.target.value)}
                    rows={2}
                    placeholder="Необязательно"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isKeyClient}
                  onChange={(e) => updateField('isKeyClient', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Ключевой клиент</span>
              </label>
              {formData.isKeyClient && (
                <div className="ml-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий к статусу (почему ключевой)</label>
                  <textarea
                    value={formData.keyClientStatusComment}
                    onChange={(e) => updateField('keyClientStatusComment', e.target.value)}
                    rows={2}
                    placeholder="Необязательно"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )}
            </div>
          </div>

          {showRequisitesBlock && (
            <>
              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-4">Реквизиты юридического лица</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Юрлицо (наименование)
                </label>
                <input
                  name="legalEntityName"
                  type="text"
                  value={formData.legalEntityName}
                  onChange={(e) => updateField('legalEntityName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              {!hideContractBasis && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Основание договора
                  </label>
                  <input
                    name="contractBasis"
                    type="text"
                    value={formData.contractBasis}
                    onChange={(e) => updateField('contractBasis', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Юридический адрес
                </label>
                <input
                  name="legalAddress"
                  type="text"
                  value={formData.legalAddress}
                  onChange={(e) => updateField('legalAddress', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ИНН
                  </label>
                  <input
                    name="inn"
                    type="text"
                    value={formData.inn}
                    onChange={(e) => updateField('inn', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    КПП
                  </label>
                  <input
                    name="kpp"
                    type="text"
                    value={formData.kpp}
                    onChange={(e) => updateField('kpp', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ОГРН
                  </label>
                  <input
                    name="ogrn"
                    type="text"
                    value={formData.ogrn}
                    onChange={(e) => updateField('ogrn', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Расчетный счет (р/с)
                </label>
                <input
                  name="rs"
                  type="text"
                  value={formData.rs}
                  onChange={(e) => updateField('rs', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Банк
                </label>
                <input
                  name="bankName"
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => updateField('bankName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    БИК банка
                  </label>
                  <input
                    name="bik"
                    type="text"
                    value={formData.bik}
                    onChange={(e) => updateField('bik', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Корреспондентский счет (к/с)
                  </label>
                  <input
                    name="ks"
                    type="text"
                    value={formData.ks}
                    onChange={(e) => updateField('ks', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Платежные реквизиты
            </label>
            <textarea
              name="paymentRequisites"
              value={formData.paymentRequisites}
              onChange={(e) => updateField('paymentRequisites', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-2">Контакты клиента</h3>
            <p className="text-sm text-gray-500 mb-2">
              Поиск по справочнику контактов или создание нового. Роль и «Основной контакт» задаются для этого клиента.
            </p>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Поиск контакта по имени, телефону, Telegram, WhatsApp..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              {contactSearch.trim().length >= 2 && (
                <div className="mt-1 border border-gray-200 rounded-md bg-white shadow-lg max-h-48 overflow-y-auto z-10">
                  {contactSearching ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Поиск...</div>
                  ) : (
                    <>
                      {contactSearchResults
                        .filter((c) => !clientContactsLinks.some((l) => l.contactId === c.id))
                        .slice(0, 10)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => addContactToClient(c)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                          >
                            {c.name}
                            {(c.phone1 || c.telegram || c.whatsapp) && (
                              <span className="text-gray-500 ml-2">
                                {[c.phone1, c.telegram, c.whatsapp].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </button>
                        ))}
                      {contactSearch.trim().length >= 2 &&
                        !contactSearching &&
                        contactSearchResults.filter((c) => !clientContactsLinks.some((l) => l.contactId === c.id)).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">Ничего не найдено</div>
                        )}
                      <div className="border-t">
                        <button
                          type="button"
                          onClick={() => setShowContactModal(true)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-700 text-sm font-medium"
                        >
                          ➕ Создать новый контакт
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <ul className="space-y-2">
              {clientContactsLinks.map((link) => (
                <li
                  key={link.contactId}
                  className="flex items-center gap-2 flex-wrap p-2 bg-gray-50 rounded-md"
                >
                  <span className="font-medium">{link.contact?.name ?? link.contactId}</span>
                  {link.isPrimary && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Основной</span>
                  )}
                  <select
                    value={link.role}
                    onChange={(e) => setContactRole(link.contactId, e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    {CONTACT_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <label className="text-sm flex items-center gap-1">
                    <input
                      type="radio"
                      name="primaryContact"
                      checked={link.isPrimary}
                      onChange={() => setPrimaryContact(link.contactId)}
                    />
                    Основной
                  </label>
                  <button
                    type="button"
                    onClick={() => removeContactFromClient(link.contactId)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
            {clientContactsLinks.length === 0 && (
              <p className="text-sm text-gray-500">Нет привязанных контактов. Введите поиск или создайте контакт.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Контакты (произвольный текст, устаревшее)
            </label>
            <textarea
              name="contacts"
              value={formData.contacts}
              onChange={(e) => updateField('contacts', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
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

      {showContactModal && (
        <ContactModal
          contact={null}
          onClose={() => setShowContactModal(false)}
          onSuccess={(created) => {
            setShowContactModal(false);
            if (created) addContactToClient(created);
          }}
          onDuplicateFound={(duplicates) => {
            if (duplicates.length > 0) {
              addContactToClient(duplicates[0]);
              setShowContactModal(false);
            }
          }}
        />
      )}
    </div>
  );
}
