'use client';

import { useState, useEffect } from 'react';

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
  });
  const [users, setUsers] = useState<User[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchLegalEntities();
  }, []);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        legalEntityId: client.legalEntityId || '',
        sellerEmployeeId: client.sellerEmployeeId,
        legalEntityName: client.legalEntityName ?? '',
        contractBasis: client.contractBasis ?? '',
        legalAddress: client.legalAddress ?? '',
        inn: client.inn ?? '',
        kpp: client.kpp ?? '',
        ogrn: client.ogrn ?? '',
        rs: client.rs ?? '',
        bankName: client.bankName ?? '',
        bik: client.bik ?? '',
        ks: client.ks ?? '',
        paymentRequisites: client.paymentRequisites ?? '',
        contacts: client.contacts ?? '',
      });
    }
  }, [client]);

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data.users || []);
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
  // Показывать блок реквизитов при выборе любого юрлица, чтобы поля всегда сохранялись
  const showRequisitesBlock = !!formData.legalEntityId;
  const requiresRequisites = selectedLegalEntity && (selectedLegalEntity.type === 'IP' || selectedLegalEntity.type === 'OOO');
  // Для этих юрлиц поле «Основание платежа» не показываем
  const hideContractBasis = selectedLegalEntity && ['ИП Мятов Сбербанк', 'ИП Мятов ВТБ', 'ООО Велюр Груп'].includes(selectedLegalEntity.name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = client ? `/api/clients/${client.id}` : '/api/clients';
      const method = client ? 'PUT' : 'POST';

      const str = (v: string | undefined) => (v ?? '').trim() || null;
      const payload = {
        name: str(formData.name),
        legalEntityId: formData.legalEntityId || null,
        sellerEmployeeId: formData.sellerEmployeeId,
        legalEntityName: str(formData.legalEntityName),
        contractBasis: hideContractBasis ? null : str(formData.contractBasis),
        legalAddress: str(formData.legalAddress),
        inn: str(formData.inn),
        kpp: str(formData.kpp),
        ogrn: str(formData.ogrn),
        rs: str(formData.rs),
        bankName: str(formData.bankName),
        bik: str(formData.bik),
        ks: str(formData.ks),
        paymentRequisites: str(formData.paymentRequisites),
        contacts: str(formData.contacts),
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
              Название клиента *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Юрлицо *
            </label>
            <select
              required
              value={formData.legalEntityId}
              onChange={(e) => {
                const id = e.target.value;
                const le = legalEntities.find((l) => l.id === id);
                setFormData((prev) => ({ ...prev, legalEntityId: id, legalEntityName: le ? le.name : prev.legalEntityName }));
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
              Продавец *
            </label>
            <select
              required
              value={formData.sellerEmployeeId}
              onChange={(e) => setFormData((prev) => ({ ...prev, sellerEmployeeId: e.target.value }))}
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

          {requiresRequisites && (
            <>
              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-4">Реквизиты юридического лица</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Юрлицо *
                </label>
                <input
                  type="text"
                  required={requiresRequisites}
                  value={formData.legalEntityName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, legalEntityName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              {!hideContractBasis && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Основание договора *
                  </label>
                  <input
                    type="text"
                    required={requiresRequisites}
                    value={formData.contractBasis}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contractBasis: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Юридический адрес *
                </label>
                <input
                  type="text"
                  required={requiresRequisites}
                  value={formData.legalAddress}
                  onChange={(e) => setFormData((prev) => ({ ...prev, legalAddress: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ИНН *
                  </label>
                  <input
                    type="text"
                    required={requiresRequisites}
                    value={formData.inn}
                    onChange={(e) => setFormData((prev) => ({ ...prev, inn: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    КПП *
                  </label>
                  <input
                    type="text"
                    required={requiresRequisites}
                    value={formData.kpp}
                    onChange={(e) => setFormData((prev) => ({ ...prev, kpp: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ОГРН *
                  </label>
                  <input
                    type="text"
                    required={requiresRequisites}
                    value={formData.ogrn}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ogrn: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Расчетный счет (р/с) *
                </label>
                <input
                  type="text"
                  required={requiresRequisites}
                  value={formData.rs}
                  onChange={(e) => setFormData((prev) => ({ ...prev, rs: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Банк *
                </label>
                <input
                  type="text"
                  required={requiresRequisites}
                  value={formData.bankName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bankName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    БИК банка *
                  </label>
                  <input
                    type="text"
                    required={requiresRequisites}
                    value={formData.bik}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bik: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Корреспондентский счет (к/с) *
                  </label>
                  <input
                    type="text"
                    required={requiresRequisites}
                    value={formData.ks}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ks: e.target.value }))}
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
              value={formData.paymentRequisites}
              onChange={(e) => setFormData((prev) => ({ ...prev, paymentRequisites: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Контакты
            </label>
            <textarea
              value={formData.contacts}
              onChange={(e) => setFormData((prev) => ({ ...prev, contacts: e.target.value }))}
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
    </div>
  );
}
