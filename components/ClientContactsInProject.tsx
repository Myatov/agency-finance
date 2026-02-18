'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ContactModal, { type Contact } from './ContactModal';

const CONTACT_ROLES = [
  { value: 'OWNER', label: 'Владелец' },
  { value: 'MARKETING', label: 'Маркетинг' },
  { value: 'FINANCE', label: 'Финансы' },
  { value: 'IT', label: 'IT' },
  { value: 'OTHER', label: 'Другое' },
] as const;

interface ClientContactLink {
  id: string;
  contactId: string;
  role: string;
  isPrimary: boolean;
  contact?: { id: string; name: string; phone?: string | null; email?: string | null; telegram?: string | null };
}

interface ClientWithContacts {
  id: string;
  clientContacts?: Array<{
    id: string;
    contactId?: string;
    role: string | null;
    isPrimary: boolean;
    contact: { id: string; name: string; phone?: string | null; email?: string | null; telegram?: string | null };
  }>;
}

export default function ClientContactsInProject({
  client,
  onUpdate,
}: {
  client: ClientWithContacts;
  onUpdate: () => void;
}) {
  const [links, setLinks] = useState<ClientContactLink[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedClientIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastSyncedClientIdRef.current === client.id) {
      return;
    }
    lastSyncedClientIdRef.current = client.id;

    if (client.clientContacts && client.clientContacts.length > 0) {
      setLinks(
        client.clientContacts.map((cc) => ({
          id: cc.id,
          contactId: cc.contactId ?? cc.contact?.id ?? '',
          role: cc.role || 'OTHER',
          isPrimary: cc.isPrimary,
          contact: cc.contact,
        }))
      );
    } else {
      setLinks([]);
    }
  }, [client.id, client.clientContacts]);

  useEffect(() => {
    if (contactSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(async () => {
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
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [contactSearch]);

  const saveContacts = async (newLinks: ClientContactLink[]) => {
    setSaving(true);
    try {
      const payload = {
        ...getClientPayload(),
        clientContacts: newLinks.map((l) => ({ contactId: l.contactId, role: l.role, isPrimary: l.isPrimary })),
      };
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const getClientPayload = (): Record<string, unknown> => {
    const c = client as unknown as Record<string, unknown>;
    const seller = c.seller as { id: string } | undefined;
    const am = c.accountManager as { id: string } | undefined;
    const agent = c.agent as { id: string } | undefined;
    return {
      name: (c.name as string) ?? '',
      sellerEmployeeId: (c.sellerEmployeeId as string) ?? seller?.id ?? '',
      accountManagerId: (c.accountManagerId as string) ?? am?.id ?? null,
      agentId: (c.agentId as string) ?? agent?.id ?? null,
      legalEntityId: (c.legalEntityId as string) ?? null,
      legalEntityName: (c.legalEntityName as string) ?? null,
      legalAddress: (c.legalAddress as string) ?? null,
      inn: (c.inn as string) ?? null,
      kpp: (c.kpp as string) ?? null,
      ogrn: (c.ogrn as string) ?? null,
      rs: (c.rs as string) ?? null,
      bankName: (c.bankName as string) ?? null,
      bik: (c.bik as string) ?? null,
      ks: (c.ks as string) ?? null,
      paymentRequisites: (c.paymentRequisites as string) ?? null,
      contacts: (c.contacts as string) ?? null,
      isReturningClient: Boolean(c.isReturningClient),
      isKeyClient: Boolean(c.isKeyClient),
      keyClientStatusComment: (c.keyClientStatusComment as string) ?? null,
      returningClientStatusComment: (c.returningClientStatusComment as string) ?? null,
      workStartDate: (c.workStartDate as string) ?? null,
      isArchived: Boolean(c.isArchived),
    };
  };

  const addContact = (c: Contact) => {
    if (links.some((l) => l.contactId === c.id)) return;
    const newLinks = [...links, { id: `new-${c.id}`, contactId: c.id, role: 'OTHER', isPrimary: links.length === 0, contact: { id: c.id, name: c.name, phone: c.phone1, email: null, telegram: c.telegram } }];
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
    <div className="text-sm" onClick={(e) => e.stopPropagation()}>
      <span className="font-medium text-gray-700 block mb-2">Контакты:</span>
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Поиск по имени, телефону, Telegram..."
          value={contactSearch}
          onChange={(e) => setContactSearch(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          onFocus={(e) => e.stopPropagation()}
        />
        {contactSearch.trim().length >= 2 && (
          <div className="border border-gray-200 rounded bg-white shadow max-h-36 overflow-y-auto">
            {searching ? (
              <div className="px-3 py-2 text-gray-500 text-xs">Поиск...</div>
            ) : (
              <>
                {availableToAdd.slice(0, 8).map((c) => (
                  <button key={c.id} type="button" onClick={() => addContact(c)} className="w-full text-left px-3 py-2 hover:bg-gray-100 text-xs">
                    {c.name} {[c.phone1, c.telegram, c.whatsapp].filter(Boolean).join(', ')}
                  </button>
                ))}
                {availableToAdd.length === 0 && !searching && <div className="px-3 py-2 text-gray-500 text-xs">Ничего не найдено</div>}
                <div className="border-t">
                  <button type="button" onClick={() => setShowContactModal(true)} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-blue-700 text-xs font-medium">
                    ➕ Создать новый контакт
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <ul className="space-y-1.5">
          {links.map((link) => (
            <li key={link.contactId} className="flex items-center gap-2 flex-wrap p-2 bg-gray-50 rounded">
              <span className="font-medium text-gray-800">{link.contact?.name ?? link.contactId}</span>
              {link.isPrimary && <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">Основной</span>}
              <select value={link.role} onChange={(e) => setRole(link.contactId, e.target.value)} className="text-xs border border-gray-300 rounded px-1.5 py-0.5" disabled={saving}>
                {CONTACT_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <label className="text-xs flex items-center gap-1">
                <input type="radio" name="primaryContact" checked={link.isPrimary} onChange={() => setPrimary(link.contactId)} disabled={saving} />
                Осн.
              </label>
              <button type="button" onClick={() => removeContact(link.contactId)} className="text-red-600 hover:text-red-800 text-xs" disabled={saving}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
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
