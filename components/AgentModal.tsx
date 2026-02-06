'use client';

import { useState, useEffect, useRef } from 'react';

const SOURCE_OPTIONS = [
  { value: 'PARTNER', label: 'Партнёр' },
  { value: 'AGENT', label: 'Агент' },
  { value: 'REFERRER', label: 'Рекомендатель' },
  { value: 'EMPLOYEE', label: 'Сотрудник' },
] as const;

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Активен' },
  { value: 'PAUSED', label: 'Пауза' },
  { value: 'ARCHIVED', label: 'Архив' },
] as const;

export interface Agent {
  id: string;
  name: string;
  companyName?: string | null;
  professionalActivity?: string | null;
  phone?: string | null;
  telegram?: string | null;
  position?: string | null;
  commissionOnTop?: boolean;
  commissionInOurAmount?: boolean;
  desiredCommissionPercent?: number | null;
  sellsOnBehalfOfCompany?: boolean;
  transfersForClosingToUs?: boolean;
  description?: string | null;
  source?: string | null;
  status?: string | null;
}

type FormData = {
  name: string;
  companyName: string;
  professionalActivity: string;
  phone: string;
  telegram: string;
  position: string;
  commissionOnTop: boolean;
  commissionInOurAmount: boolean;
  desiredCommissionPercent: string;
  sellsOnBehalfOfCompany: boolean;
  transfersForClosingToUs: boolean;
  description: string;
  source: string;
  status: string;
};

const initialForm: FormData = {
  name: '',
  companyName: '',
  professionalActivity: '',
  phone: '',
  telegram: '',
  position: '',
  commissionOnTop: false,
  commissionInOurAmount: false,
  desiredCommissionPercent: '',
  sellsOnBehalfOfCompany: false,
  transfersForClosingToUs: false,
  description: '',
  source: '',
  status: 'ACTIVE',
};

export default function AgentModal({
  agent,
  onClose,
  onSuccess,
  onDuplicateFound,
}: {
  agent: Agent | null;
  onClose: () => void;
  onSuccess: (createdOrUpdated?: Agent) => void;
  onDuplicateFound?: (duplicates: Agent[]) => void;
}) {
  const [formData, setFormData] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateConfirm, setDuplicateConfirm] = useState(false);
  const [pendingDuplicates, setPendingDuplicates] = useState<Agent[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name ?? '',
        companyName: agent.companyName ?? '',
        professionalActivity: agent.professionalActivity ?? '',
        phone: agent.phone ?? '',
        telegram: agent.telegram ?? '',
        position: agent.position ?? '',
        commissionOnTop: Boolean(agent.commissionOnTop),
        commissionInOurAmount: Boolean(agent.commissionInOurAmount),
        desiredCommissionPercent: agent.desiredCommissionPercent != null ? String(agent.desiredCommissionPercent) : '',
        sellsOnBehalfOfCompany: Boolean(agent.sellsOnBehalfOfCompany),
        transfersForClosingToUs: Boolean(agent.transfersForClosingToUs),
        description: agent.description ?? '',
        source: agent.source ?? '',
        status: agent.status ?? 'ACTIVE',
      });
    } else {
      setFormData(initialForm);
    }
  }, [agent]);

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const checkDuplicates = async (): Promise<Agent[]> => {
    const opt = (s: string) => (s != null && String(s).trim() !== '' ? String(s).trim() : null);
    const phone = opt(formData.phone);
    const telegram = opt(formData.telegram);
    const description = opt(formData.description);
    if (!phone && !telegram && !description) return [];

    const res = await fetch('/api/agents/check-duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        telegram,
        description,
        excludeAgentId: agent?.id ?? null,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.duplicates ?? [];
  };

  const buildDuplicateMessage = (duplicates: Agent[]) => {
    const byPhone = formData.phone?.trim() && duplicates.some((d) => d.phone?.toLowerCase() === formData.phone?.trim()?.toLowerCase());
    const byTg = formData.telegram?.trim() && duplicates.some((d) => d.telegram?.toLowerCase() === formData.telegram?.trim()?.toLowerCase());
    const byDesc = formData.description?.trim() && duplicates.some((d) => d.description?.toLowerCase() === formData.description?.trim()?.toLowerCase());
    const parts = [];
    if (byPhone) parts.push('телефоном');
    if (byTg) parts.push('Telegram');
    if (byDesc) parts.push('описанием');
    if (parts.length === 0) return null;
    return agent
      ? 'Найден другой агент с таким же ' + parts.join(' / ') + '. Всё равно сохранить?'
      : 'Найден контакт с таким же ' + parts.join(' / ') + '. Вы уверены, что хотите создать новый?';
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
        const msg = buildDuplicateMessage(duplicates);
        if (msg && !window.confirm(msg)) return;
        setDuplicateConfirm(true);
        return;
      }
    }

    setLoading(true);
    try {
      const opt = (s: string) => (s != null && String(s).trim() !== '' ? String(s).trim() : null);
      const num = (s: string) => (s !== '' && !isNaN(parseFloat(s)) ? parseFloat(s) : null);
      const payload = {
        name,
        companyName: opt(formData.companyName) ?? null,
        professionalActivity: opt(formData.professionalActivity) ?? null,
        phone: opt(formData.phone) ?? null,
        telegram: opt(formData.telegram) ?? null,
        position: opt(formData.position) ?? null,
        commissionOnTop: formData.commissionOnTop,
        commissionInOurAmount: formData.commissionInOurAmount,
        desiredCommissionPercent: num(formData.desiredCommissionPercent),
        sellsOnBehalfOfCompany: formData.sellsOnBehalfOfCompany,
        transfersForClosingToUs: formData.transfersForClosingToUs,
        description: opt(formData.description) ?? null,
        source: opt(formData.source) ?? null,
        status: formData.status || 'ACTIVE',
      };

      const url = agent ? `/api/agents/${agent.id}` : '/api/agents';
      const method = agent ? 'PUT' : 'POST';
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
      onSuccess(data.agent);
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
          {agent ? 'Редактировать агента / партнёра' : 'Добавить агента / партнёра'}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название компании</label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Основные поля профессиональной деятельности</label>
            <input
              type="text"
              placeholder="Контекстолог / разработчик / автолог / маркетолог..."
              value={formData.professionalActivity}
              onChange={(e) => updateField('professionalActivity', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Телеграм</label>
              <input
                type="text"
                value={formData.telegram}
                onChange={(e) => updateField('telegram', e.target.value)}
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

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.commissionOnTop}
                onChange={(e) => updateField('commissionOnTop', e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Начисляет свою комиссию сверху</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.commissionInOurAmount}
                onChange={(e) => updateField('commissionInOurAmount', e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Процент агента — в нашей сумме</span>
            </label>
            {formData.commissionInOurAmount && (
              <div className="ml-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Желаемый % комиссии внутри нашей суммы</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.desiredCommissionPercent}
                  onChange={(e) => updateField('desiredCommissionPercent', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md max-w-[120px]"
                />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sellsOnBehalfOfCompany}
                onChange={(e) => updateField('sellsOnBehalfOfCompany', e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Продаёт от лица своей компании</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.transfersForClosingToUs}
                onChange={(e) => updateField('transfersForClosingToUs', e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Передаёт на закрытие клиента нам</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Источник</label>
              <select
                value={formData.source}
                onChange={(e) => updateField('source', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">—</option>
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
              <select
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {pendingDuplicates != null && pendingDuplicates.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm font-medium text-amber-900 mb-2">
                Найден контакт с таким же телефоном / Telegram / описанием:
              </p>
              <ul className="list-disc list-inside text-sm text-amber-800 mb-3">
                {pendingDuplicates.map((d) => (
                  <li key={d.id}>
                    {d.name}
                    {(d.phone || d.telegram) && ` (${[d.phone, d.telegram].filter(Boolean).join(', ')})`}
                  </li>
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
