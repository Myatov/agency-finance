'use client';

/**
 * Страница добавления проекта.
 * Отдельная страница с отладкой — контакты управляются изолированно по clientId.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import ContactModal, { type Contact } from './ContactModal';

const DEBUG = true;
const log = (msg: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[AddProject] ${msg}`, data ?? '');
  }
};

interface ClientOption {
  id: string;
  name: string;
}

interface SiteOption {
  id: string;
  title: string;
  websiteUrl: string | null;
  clientId: string;
}

interface Product {
  id: string;
  name: string;
  expenseItems: Array<{
    id: string;
    expenseItemTemplateId: string;
    template: { id: string; name: string; departmentId: string | null; department: { id: string; name: string } | null };
    valueType: string;
    defaultValue: number;
  }>;
  commissions: Array<{ id: string; role: string; standardPercent: number; partnerPercent: number }>;
  accountManagerFees: Array<{ id: string; conditionMin: number | null; conditionMax: number | null; feeAmount: string }>;
}

interface User {
  id: string;
  fullName: string;
  roleCode: string;
}

const CONTACT_ROLES = [
  { value: 'OWNER', label: 'Владелец' },
  { value: 'MARKETING', label: 'Маркетинг' },
  { value: 'FINANCE', label: 'Финансы' },
  { value: 'IT', label: 'IT' },
  { value: 'OTHER', label: 'Другое' },
];

// Контакты: полностью изолированный блок. Управляет только по clientId.
function ContactsSection({
  clientId,
  onError,
}: {
  clientId: string;
  onError?: (msg: string) => void;
}) {
  const [links, setLinks] = useState<Array<{ id: string; contactId: string; role: string; isPrimary: boolean; contact?: { id: string; name: string } }>>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const fetchTriggerRef = useRef(0);

  const fetchContacts = useCallback(async () => {
    if (!clientId) {
      setLinks([]);
      setLoading(false);
      return;
    }
    const t = ++fetchTriggerRef.current;
    setLoading(true);
    log('ContactsSection: fetch client', { clientId, trigger: t });
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      const data = await res.json();
      log('ContactsSection: fetch result', { ok: res.ok, t, clientContacts: data.client?.clientContacts?.length });
      if (t !== fetchTriggerRef.current) return;
      if (!res.ok) {
        onError?.(data.error || 'Ошибка загрузки клиента');
        setLinks([]);
        return;
      }
      const cc = data.client?.clientContacts || [];
      setLinks(
        cc.map((c: any) => ({
          id: c.id,
          contactId: c.contactId ?? c.contact?.id ?? '',
          role: c.role || 'OTHER',
          isPrimary: c.isPrimary,
          contact: c.contact ? { id: c.contact.id, name: c.contact.name } : undefined,
        }))
      );
    } catch (e) {
      log('ContactsSection: fetch error', e);
      onError?.('Ошибка загрузки контактов');
      if (t === fetchTriggerRef.current) setLinks([]);
    } finally {
      if (t === fetchTriggerRef.current) setLoading(false);
    }
  }, [clientId, onError]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    if (contactSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const tid = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/contacts?q=${encodeURIComponent(contactSearch.trim())}`);
        const data = await res.json();
        setSearchResults(data.contacts || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(tid);
  }, [contactSearch]);

  const getClientPayload = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}`);
    const data = await res.json();
    if (!res.ok || !data.client) return null;
    const c = data.client;
    return {
      name: c.name ?? '',
      sellerEmployeeId: c.sellerEmployeeId ?? c.seller?.id ?? '',
      accountManagerId: c.accountManagerId ?? c.accountManager?.id ?? null,
      agentId: c.agentId ?? c.agent?.id ?? null,
      legalEntityId: c.legalEntityId ?? null,
      legalEntityName: c.legalEntityName ?? null,
      legalAddress: c.legalAddress ?? null,
      inn: c.inn ?? null,
      kpp: c.kpp ?? null,
      ogrn: c.ogrn ?? null,
      rs: c.rs ?? null,
      bankName: c.bankName ?? null,
      bik: c.bik ?? null,
      ks: c.ks ?? null,
      paymentRequisites: c.paymentRequisites ?? null,
      contacts: c.contacts ?? null,
      isReturningClient: Boolean(c.isReturningClient),
      isKeyClient: Boolean(c.isKeyClient),
      keyClientStatusComment: c.keyClientStatusComment ?? null,
      returningClientStatusComment: c.returningClientStatusComment ?? null,
      workStartDate: c.workStartDate ?? null,
      isArchived: Boolean(c.isArchived),
    };
  }, [clientId]);

  const saveContacts = async (newLinks: typeof links) => {
    setSaving(true);
    log('ContactsSection: saveContacts', { count: newLinks.length });
    try {
      const base = await getClientPayload();
      if (!base) {
        onError?.('Не удалось загрузить данные клиента');
        return;
      }
      const payload = {
        ...base,
        clientContacts: newLinks.map((l) => ({ contactId: l.contactId, role: l.role, isPrimary: l.isPrimary })),
      };
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      log('ContactsSection: save result', { ok: res.ok, error: data.error });
      if (!res.ok) {
        onError?.(data.error || 'Ошибка сохранения контактов');
        return;
      }
      await fetchContacts();
    } catch (e) {
      log('ContactsSection: save error', e);
      onError?.('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const addContact = (c: Contact) => {
    if (links.some((l) => l.contactId === c.id)) return;
    const newLinks = [
      ...links,
      { id: `new-${c.id}`, contactId: c.id, role: 'OTHER' as const, isPrimary: links.length === 0, contact: { id: c.id, name: c.name } },
    ];
    setLinks(newLinks);
    setContactSearch('');
    setSearchResults([]);
    saveContacts(newLinks);
  };

  const removeContact = (contactId: string) => {
    const newLinks = links.filter((l) => l.contactId !== contactId);
    setLinks(newLinks);
    saveContacts(newLinks);
  };

  const setRole = (contactId: string, role: string) => {
    const newLinks = links.map((l) => (l.contactId === contactId ? { ...l, role } : l));
    setLinks(newLinks);
    saveContacts(newLinks);
  };

  const setPrimary = (contactId: string) => {
    const newLinks = links.map((l) => ({ ...l, isPrimary: l.contactId === contactId }));
    setLinks(newLinks);
    saveContacts(newLinks);
  };

  const availableToAdd = searchResults.filter((c) => !links.some((l) => l.contactId === c.id));

  return (
    <div className="text-sm border border-gray-200 rounded-lg p-4 bg-white">
      <h3 className="font-semibold text-gray-800 mb-2">Контакты клиента</h3>
      <input
        type="text"
        placeholder="Поиск по имени, телефону, Telegram..."
        value={contactSearch}
        onChange={(e) => setContactSearch(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mb-2"
      />
      {contactSearch.trim().length >= 2 && (
        <div className="border border-gray-200 rounded bg-white shadow max-h-36 overflow-y-auto mb-2">
          {searching ? (
            <div className="px-3 py-2 text-gray-500 text-xs">Поиск...</div>
          ) : (
            <>
              {availableToAdd.slice(0, 8).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addContact(c)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 text-xs"
                >
                  {c.name} {[c.phone1, c.telegram, c.whatsapp].filter(Boolean).join(', ')}
                </button>
              ))}
              {availableToAdd.length === 0 && !searching && (
                <div className="px-3 py-2 text-gray-500 text-xs">Ничего не найдено</div>
              )}
              <div className="border-t">
                <button
                  type="button"
                  onClick={() => setShowContactModal(true)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-700 text-xs font-medium"
                >
                  ➕ Создать новый контакт
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {!contactSearch.trim() && (
        <button
          type="button"
          onClick={() => setShowContactModal(true)}
          className="text-blue-600 hover:text-blue-800 text-xs mb-2"
        >
          ➕ Создать новый контакт
        </button>
      )}
      {loading ? (
        <div className="text-gray-500 text-xs">Загрузка...</div>
      ) : (
        <ul className="space-y-1.5">
          {links.map((link) => (
            <li key={link.contactId} className="flex items-center gap-2 flex-wrap p-2 bg-gray-50 rounded">
              <span className="font-medium text-gray-800">{link.contact?.name ?? link.contactId}</span>
              {link.isPrimary && (
                <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">Основной</span>
              )}
              <select
                value={link.role}
                onChange={(e) => setRole(link.contactId, e.target.value)}
                className="text-xs border border-gray-300 rounded px-1.5 py-0.5"
                disabled={saving}
              >
                {CONTACT_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <label className="text-xs flex items-center gap-1">
                <input
                  type="radio"
                  name="primaryContact"
                  checked={link.isPrimary}
                  onChange={() => setPrimary(link.contactId)}
                  disabled={saving}
                />
                Осн.
              </label>
              <button
                type="button"
                onClick={() => removeContact(link.contactId)}
                className="text-red-600 hover:text-red-800 text-xs"
                disabled={saving}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {showContactModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <ContactModal
            contact={null}
            onClose={() => setShowContactModal(false)}
            onSuccess={(created) => {
              if (created) {
                addContact(created);
                setShowContactModal(false);
              }
            }}
            onDuplicateFound={(duplicates) => {
              if (duplicates.length > 0) {
                addContact(duplicates[0]);
                setShowContactModal(false);
              }
            }}
          />,
          document.body
        )}
    </div>
  );
}

export default function AddProjectPage() {
  const [user, setUser] = useState<User | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; fullName: string }>>([]);
  const [niches, setNiches] = useState<Array<{ id: string; name: string }>>([]);

  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [productId, setProductId] = useState('');
  const [price, setPrice] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [billingType, setBillingType] = useState('MONTHLY');
  const [status, setStatus] = useState('ACTIVE');
  const [soldByUserId, setSoldByUserId] = useState('');
  const [comment, setComment] = useState('');
  const [isFromPartner, setIsFromPartner] = useState(false);

  const [newClientName, setNewClientName] = useState('');
  const [newClientSellerId, setNewClientSellerId] = useState('');
  const [newSiteTitle, setNewSiteTitle] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteNiche, setNewSiteNiche] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addDebug = (msg: string) => {
    setDebugLog((prev) => [...prev.slice(-99), `${new Date().toISOString().slice(11, 23)} ${msg}`]);
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          setSoldByUserId(d.user.id);
          setNewClientSellerId(d.user.id);
        }
      })
      .catch((e) => {
        log('auth error', e);
        addDebug('auth error');
      });
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/clients?limit=500&filter=all&includeNoProjects=1').then((r) => r.json()),
      fetch('/api/products').then((r) => r.json()),
      fetch('/api/employees?limit=500').then((r) => r.json()),
      fetch('/api/niches').then((r) => r.json()),
    ])
      .then(([c, p, e, n]) => {
        setClients(c.clients || []);
        setProducts(p.products || []);
        setEmployees((e.employees || []).map((x: any) => ({ id: x.id, fullName: x.fullName })));
        setNiches((n.niches || []).map((x: any) => ({ id: x.id, name: x.name })));
        addDebug('initial data loaded');
      })
      .catch((err) => {
        log('init error', err);
        addDebug('init error');
        setError('Ошибка загрузки данных');
      });
  }, []);

  useEffect(() => {
    if (!clientId) {
      setSites([]);
      setSiteId('');
      addDebug('clientId cleared, sites reset');
      return;
    }
    addDebug(`fetching sites for client ${clientId}`);
    fetch(`/api/sites/available?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => {
        setSites(d.sites || []);
        setSiteId('');
        addDebug(`sites loaded: ${(d.sites || []).length}`);
      })
      .catch((e) => {
        log('sites error', e);
        addDebug('sites error');
      });
  }, [clientId]);

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      setError('Введите имя клиента');
      addDebug('create client: no name');
      return;
    }
    if (!newClientSellerId) {
      setError('Выберите продавца');
      addDebug('create client: no seller');
      return;
    }
    setLoading(true);
    setError('');
    addDebug(`creating client: ${newClientName}`);
    try {
      const payload: Record<string, unknown> = {
        name: newClientName.trim(),
        sellerEmployeeId: newClientSellerId,
      };
      if (user?.roleCode === 'ACCOUNT_MANAGER' && user?.id) {
        payload.accountManagerId = user.id;
      }
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      log('create client result', { ok: res.ok, clientId: data.client?.id });
      addDebug(res.ok ? `client created: ${data.client?.id}` : `client error: ${data.error}`);
      if (!res.ok) {
        setError(data.error || 'Ошибка создания клиента');
        return;
      }
      setClientId(data.client.id);
      setClients((prev) => [...prev, { id: data.client.id, name: data.client.name }]);
      setNewClientName('');
      setNewClientSellerId(user?.id || '');
      addDebug('client set, form reset');
    } catch (e) {
      log('create client catch', e);
      addDebug('create client network error');
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSite = async () => {
    if (!newSiteTitle.trim()) {
      setError('Введите название сайта');
      return;
    }
    if (!newSiteNiche) {
      setError('Выберите нишу');
      return;
    }
    if (!clientId) {
      setError('Сначала выберите клиента');
      return;
    }
    setLoading(true);
    setError('');
    addDebug(`creating site: ${newSiteTitle}`);
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSiteTitle.trim(),
          websiteUrl: newSiteUrl.trim() || null,
          nicheId: newSiteNiche,
          clientId,
        }),
      });
      const data = await res.json();
      log('create site result', { ok: res.ok, siteId: data.site?.id });
      addDebug(res.ok ? `site created: ${data.site?.id}` : `site error: ${data.error}`);
      if (!res.ok) {
        setError(data.error || 'Ошибка создания сайта');
        return;
      }
      setSiteId(data.site.id);
      setSites((prev) => [...prev, { id: data.site.id, title: data.site.title, websiteUrl: data.site.websiteUrl, clientId }]);
      setNewSiteTitle('');
      setNewSiteUrl('');
      setNewSiteNiche('');
    } catch (e) {
      log('create site catch', e);
      addDebug('create site network error');
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!clientId) {
      setError('Выберите клиента');
      addDebug('submit: no client');
      return;
    }
    if (!siteId) {
      setError('Выберите или создайте сайт');
      addDebug('submit: no site');
      return;
    }
    if (!productId) {
      setError('Выберите продукт');
      addDebug('submit: no product');
      return;
    }
    setLoading(true);
    addDebug('submitting service');
    try {
      const payload: any = {
        siteId,
        productId,
        status,
        startDate,
        billingType,
        prepaymentType: 'POSTPAY',
        price: price || null,
        autoRenew: false,
        isFromPartner,
        comment: comment || null,
        responsibleUserId: soldByUserId || null,
      };
      if (selectedProduct?.expenseItems?.length) {
        payload.expenseItems = selectedProduct.expenseItems.map((item) => ({
          expenseItemTemplateId: item.expenseItemTemplateId,
          name: item.template.name,
          valueType: item.valueType,
          value: item.defaultValue,
          responsibleUserId: null,
        }));
      }
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      log('submit result', { ok: res.ok, error: data.error });
      addDebug(res.ok ? 'service created' : `submit error: ${data.error}`);
      if (!res.ok) {
        setError(data.error || 'Ошибка сохранения');
        return;
      }
      addDebug('success, redirecting');
      window.location.href = '/projects';
    } catch (e) {
      log('submit catch', e);
      addDebug('submit network error');
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/projects"
          className="text-gray-600 hover:text-gray-900 text-sm"
        >
          ← К списку проектов
        </Link>
        <h1 className="text-2xl font-bold">Добавить проект</h1>
      </div>

      {DEBUG && (
        <div className="mb-4 border border-amber-200 rounded-lg bg-amber-50 overflow-hidden">
          <button
            type="button"
            onClick={() => setDebugOpen(!debugOpen)}
            className="w-full px-4 py-2 text-left text-sm font-medium text-amber-900"
          >
            🔧 Отладка {debugOpen ? '▼' : '▶'}
          </button>
          {debugOpen && (
            <div className="px-4 pb-4 text-xs font-mono text-amber-900 space-y-1 max-h-48 overflow-y-auto">
              <div className="font-semibold pt-2">Состояние:</div>
              <div>clientId: {clientId || '—'}</div>
              <div>siteId: {siteId || '—'}</div>
              <div>productId: {productId || '—'}</div>
              <div>sites.length: {sites.length}</div>
              <div className="font-semibold pt-2">Лог:</div>
              {debugLog.slice(-20).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Шаг 1: Клиент */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <h2 className="text-lg font-semibold mb-4">1. Клиент</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Выберите клиента</label>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  addDebug(`client selected: ${e.target.value}`);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">— Не выбран —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Или создайте нового</label>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Название"
                  className="px-3 py-2 border border-gray-300 rounded-md flex-1 min-w-[120px]"
                />
                <select
                  value={newClientSellerId}
                  onChange={(e) => setNewClientSellerId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Продавец</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCreateClient}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Создать клиента
                </button>
              </div>
            </div>
          </div>

          {clientId && (
            <div className="mt-4">
              <ContactsSection clientId={clientId} onError={setError} />
            </div>
          )}
        </div>

        {/* Шаг 2: Сайт */}
        {clientId && (
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h2 className="text-lg font-semibold mb-4">2. Сайт</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Выберите сайт</label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">— Не выбран —</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} {s.websiteUrl ? `(${s.websiteUrl})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Или создайте новый</label>
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={newSiteTitle}
                    onChange={(e) => setNewSiteTitle(e.target.value)}
                    placeholder="Название сайта"
                    className="px-3 py-2 border border-gray-300 rounded-md flex-1 min-w-[120px]"
                  />
                  <input
                    type="text"
                    value={newSiteUrl}
                    onChange={(e) => setNewSiteUrl(e.target.value)}
                    placeholder="URL"
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <select
                    value={newSiteNiche}
                    onChange={(e) => setNewSiteNiche(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Ниша</option>
                    {niches.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateSite}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Создать сайт
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Шаг 3: Услуга */}
        {clientId && siteId && (
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h2 className="text-lg font-semibold mb-4">3. Услуга</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Продукт *</label>
                <select
                  required
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">— Выберите —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Цена (руб.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип оплаты</label>
                  <select
                    value={billingType}
                    onChange={(e) => setBillingType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="MONTHLY">Ежемесячная</option>
                    <option value="ONE_TIME">Разовая</option>
                    <option value="QUARTERLY">Ежеквартальная</option>
                    <option value="YEARLY">Ежегодная</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Кто сделал продажу</label>
                  <select
                    value={soldByUserId}
                    onChange={(e) => setSoldByUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">— Выберите —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fromPartner"
                  checked={isFromPartner}
                  onChange={(e) => setIsFromPartner(e.target.checked)}
                />
                <label htmlFor="fromPartner" className="text-sm">
                  Лид от партнёра
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={2}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Link
            href="/projects"
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Отмена
          </Link>
          <button
            type="submit"
            disabled={loading || !clientId || !siteId || !productId}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Сохранение...' : 'Добавить проект'}
          </button>
        </div>
      </form>
    </div>
  );
}
