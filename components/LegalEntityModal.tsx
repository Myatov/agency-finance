'use client';

import { useState, useEffect } from 'react';

interface LegalEntity {
  id: string;
  name: string;
  type: string;
  usnPercent: number;
  vatPercent: number;
  isActive: boolean;
  generateClosingDocs?: boolean;
  closingDocPerInvoice?: boolean | null;
  fullName?: string | null;
  contactInfo?: string | null;
  generalDirector?: string | null;
  activityBasis?: string | null;
  legalAddress?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  rs?: string | null;
  bankName?: string | null;
  bik?: string | null;
  ks?: string | null;
  paymentInfo?: string | null;
}

const TYPE_OPTIONS = [
  { value: 'IP', label: 'ИП' },
  { value: 'OOO', label: 'ООО' },
  { value: 'CARD', label: 'Карта' },
  { value: 'CRYPTO', label: 'Крипта' },
  { value: 'BARTER', label: 'Бартер' },
];

export default function LegalEntityModal({
  legalEntity,
  onClose,
  onSuccess,
}: {
  legalEntity: LegalEntity | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'IP',
    usnPercent: '0',
    vatPercent: '0',
    isActive: true,
    generateClosingDocs: false,
    closingDocPerInvoice: null as boolean | null,
    fullName: '',
    contactInfo: '',
    // Поля для ИП и ООО
    generalDirector: '',
    activityBasis: '',
    legalAddress: '',
    inn: '',
    kpp: '',
    ogrn: '',
    rs: '',
    bankName: '',
    bik: '',
    ks: '',
    // Поле для остальных типов
    paymentInfo: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (legalEntity) {
      setFormData({
        name: legalEntity.name,
        type: legalEntity.type,
        usnPercent: legalEntity.usnPercent.toString(),
        vatPercent: legalEntity.vatPercent.toString(),
        isActive: legalEntity.isActive,
        generateClosingDocs: legalEntity.generateClosingDocs ?? false,
        closingDocPerInvoice: legalEntity.closingDocPerInvoice ?? null,
        fullName: legalEntity.fullName || '',
        contactInfo: legalEntity.contactInfo || '',
        generalDirector: legalEntity.generalDirector || '',
        activityBasis: legalEntity.activityBasis || '',
        legalAddress: legalEntity.legalAddress || '',
        inn: legalEntity.inn || '',
        kpp: legalEntity.kpp || '',
        ogrn: legalEntity.ogrn || '',
        rs: legalEntity.rs || '',
        bankName: legalEntity.bankName || '',
        bik: legalEntity.bik || '',
        ks: legalEntity.ks || '',
        paymentInfo: legalEntity.paymentInfo || '',
      });
    } else {
      setFormData({
        name: '',
        type: 'IP',
        usnPercent: '0',
        vatPercent: '0',
        isActive: true,
        generateClosingDocs: false,
        closingDocPerInvoice: null,
        fullName: '',
        contactInfo: '',
        generalDirector: '',
        activityBasis: '',
        legalAddress: '',
        inn: '',
        kpp: '',
        ogrn: '',
        rs: '',
        bankName: '',
        bik: '',
        ks: '',
        paymentInfo: '',
      });
    }
  }, [legalEntity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = legalEntity ? `/api/legal-entities/${legalEntity.id}` : '/api/legal-entities';
      const method = legalEntity ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          usnPercent: formData.usnPercent,
          vatPercent: formData.vatPercent,
          isActive: formData.isActive,
          generateClosingDocs: formData.generateClosingDocs,
          closingDocPerInvoice: formData.generateClosingDocs ? formData.closingDocPerInvoice : null,
          fullName: formData.fullName || null,
          contactInfo: formData.contactInfo || null,
          generalDirector: formData.type === 'OOO' ? formData.generalDirector || null : null,
          activityBasis: formData.type === 'OOO' ? formData.activityBasis || null : null,
          legalAddress: formData.type === 'IP' || formData.type === 'OOO' ? formData.legalAddress || null : null,
          inn: formData.type === 'IP' || formData.type === 'OOO' ? formData.inn || null : null,
          kpp: formData.type === 'IP' || formData.type === 'OOO' ? formData.kpp || null : null,
          ogrn: formData.type === 'IP' || formData.type === 'OOO' ? formData.ogrn || null : null,
          rs: formData.type === 'IP' || formData.type === 'OOO' ? formData.rs || null : null,
          bankName: formData.type === 'IP' || formData.type === 'OOO' ? formData.bankName || null : null,
          bik: formData.type === 'IP' || formData.type === 'OOO' ? formData.bik || null : null,
          ks: formData.type === 'IP' || formData.type === 'OOO' ? formData.ks || null : null,
          paymentInfo: formData.type !== 'IP' && formData.type !== 'OOO' ? formData.paymentInfo || null : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.details ? `${data.error}: ${data.details}` : (data.error || 'Ошибка сохранения');
        setError(errorMessage);
        setLoading(false);
        console.error('Error response:', data);
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Ошибка соединения');
      setLoading(false);
    }
  };

  const totalTaxLoad = (parseFloat(formData.usnPercent) || 0) + (parseFloat(formData.vatPercent) || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {legalEntity ? 'Редактировать юрлицо' : 'Добавить юрлицо'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Полное название юридического лица
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Необязательно"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Контактные данные
            </label>
            <input
              type="text"
              value={formData.contactInfo}
              onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Необязательно"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип *
            </label>
            <select
              required
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                УСН %
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.usnPercent}
                onChange={(e) => setFormData({ ...formData, usnPercent: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                НДС %
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.vatPercent}
                onChange={(e) => setFormData({ ...formData, vatPercent: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Итоговая налоговая нагрузка %
            </label>
            <input
              type="text"
              value={totalTaxLoad.toFixed(1) + '%'}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
            />
          </div>

          {/* Поля для ООО */}
          {formData.type === 'OOO' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Генеральный директор
                </label>
                <input
                  type="text"
                  value={formData.generalDirector}
                  onChange={(e) => setFormData({ ...formData, generalDirector: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Основание деятельности
                </label>
                <input
                  type="text"
                  value={formData.activityBasis}
                  onChange={(e) => setFormData({ ...formData, activityBasis: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </>
          )}

          {/* Поля для ИП и ООО */}
          {(formData.type === 'IP' || formData.type === 'OOO') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Адрес юридический
                </label>
                <input
                  type="text"
                  value={formData.legalAddress}
                  onChange={(e) => setFormData({ ...formData, legalAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ИНН
                  </label>
                  <input
                    type="text"
                    value={formData.inn}
                    onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    КПП
                  </label>
                  <input
                    type="text"
                    value={formData.kpp}
                    onChange={(e) => setFormData({ ...formData, kpp: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ОГРН
                </label>
                <input
                  type="text"
                  value={formData.ogrn}
                  onChange={(e) => setFormData({ ...formData, ogrn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Р/счет
                </label>
                <input
                  type="text"
                  value={formData.rs}
                  onChange={(e) => setFormData({ ...formData, rs: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Банк
                </label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    БИК банка
                  </label>
                  <input
                    type="text"
                    value={formData.bik}
                    onChange={(e) => setFormData({ ...formData, bik: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    К/счет
                  </label>
                  <input
                    type="text"
                    value={formData.ks}
                    onChange={(e) => setFormData({ ...formData, ks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </>
          )}

          {/* Поле для остальных типов (Карта, Крипта, Бартер) */}
          {formData.type !== 'IP' && formData.type !== 'OOO' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Как платить
              </label>
              <textarea
                value={formData.paymentInfo}
                onChange={(e) => setFormData({ ...formData, paymentInfo: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          )}

          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Закрывающие документы</p>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.generateClosingDocs}
                onChange={(e) => setFormData({ ...formData, generateClosingDocs: e.target.checked, closingDocPerInvoice: e.target.checked ? formData.closingDocPerInvoice : null })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Формировать закрывающие документы</span>
            </label>
            {formData.generateClosingDocs && (
              <label className="flex items-center ml-4">
                <input
                  type="checkbox"
                  checked={formData.closingDocPerInvoice === true}
                  onChange={(e) => setFormData({ ...formData, closingDocPerInvoice: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Закрывающий документ на каждый счёт (иначе — один на период)</span>
              </label>
            )}
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Активно</span>
            </label>
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
