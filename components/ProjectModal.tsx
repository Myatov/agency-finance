'use client';

import { useState, useEffect, useRef } from 'react';

interface Product {
  id: string;
  name: string;
  expenseItems: Array<{
    id: string;
    expenseItemTemplateId: string;
    template: {
      id: string;
      name: string;
      departmentId: string | null;
      department: { id: string; name: string } | null;
    };
    valueType: string;
    defaultValue: number;
    description: string | null;
  }>;
  commissions: Array<{
    id: string;
    role: string;
    standardPercent: number;
    partnerPercent: number;
  }>;
  accountManagerFees: Array<{
    id: string;
    conditionField: string | null;
    conditionMin: number | null;
    conditionMax: number | null;
    feeAmount: string;
    description: string | null;
  }>;
}

interface Department {
  id: string;
  name: string;
}

interface DepartmentEmployee {
  id: string;
  fullName: string;
  departmentId: string | null;
}

interface NicheOption {
  id: string;
  name: string;
}

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

interface ClientDetail {
  id: string;
  name: string;
  sellerEmployeeId: string;
  accountManagerId: string | null;
  agentId: string | null;
  legalEntityId: string | null;
  legalEntityName: string | null;
  legalAddress: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  rs: string | null;
  bankName: string | null;
  bik: string | null;
  ks: string | null;
  paymentRequisites: string | null;
  contacts: string | null;
  isReturningClient: boolean;
  isKeyClient: boolean;
  keyClientStatusComment: string | null;
  returningClientStatusComment: string | null;
  workStartDate: string | null;
  isArchived: boolean;
  isSystem: boolean;
  [key: string]: unknown;
}

interface ContractDoc {
  id: string;
  originalName: string;
  docNumber: string | null;
  docDate: string | null;
  uploadedAt: string | null;
  type: string;
  status: string;
  comment: string | null;
}

interface ExistingSiteService {
  id: string;
  productId: string;
  product: { id: string; name: string };
  status: string;
  price: string | null;
  billingType: string;
}

interface EditProject {
  id: string;
  productId: string;
  siteId: string;
  status: string;
  startDate: string;
  billingType: string;
  prepaymentType: string;
  price: string | null;
  autoRenew: boolean;
  isFromPartner: boolean;
  sellerCommissionPercent: number | null;
  accountManagerCommissionPercent: number | null;
  accountManagerFeeAmount: string | null;
  comment: string | null;
  responsibleUserId: string | null;
  site: {
    id: string;
    title: string;
    clientId: string;
    client: {
      id: string;
      name: string;
      accountManagerId: string | null;
      sellerEmployeeId: string | null;
      agentId: string | null;
    };
  };
  product: { id: string; name: string };
  expenseItems: Array<{
    id: string;
    name: string;
    valueType: string;
    value: number;
    calculatedAmount: string | null;
    template: { id: string; name: string } | null;
  }>;
}

interface User {
  id: string;
  fullName: string;
  roleCode: string;
}

export default function ProjectModal({
  project,
  onClose,
  onSuccess,
  user,
}: {
  project: EditProject | null;
  onClose: () => void;
  onSuccess: () => void;
  user: User | null;
}) {
  const [step, setStep] = useState<'main' | 'newClient' | 'newSite'>('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [siteSearch, setSiteSearch] = useState('');

  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null);
  const [showRequisites, setShowRequisites] = useState(false);
  const [requisitesForm, setRequisitesForm] = useState({
    inn: '', kpp: '', ogrn: '', legalAddress: '', rs: '', bankName: '', bik: '', ks: '',
  });
  const [savingRequisites, setSavingRequisites] = useState(false);
  const [contracts, setContracts] = useState<ContractDoc[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allEmployees, setAllEmployees] = useState<DepartmentEmployee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expenseItemResponsibles, setExpenseItemResponsibles] = useState<Record<string, string>>({});
  const [existingSiteServices, setExistingSiteServices] = useState<ExistingSiteService[]>([]);
  const [existingServicesLoading, setExistingServicesLoading] = useState(false);
  const [showExistingServices, setShowExistingServices] = useState(false);
  const [expenseItemValues, setExpenseItemValues] = useState<Record<string, { valueType: string; value: number }>>({});

  const [formData, setFormData] = useState({
    clientId: '',
    siteId: '',
    productId: '',
    status: 'ACTIVE',
    startDate: new Date().toISOString().split('T')[0],
    billingType: 'MONTHLY',
    prepaymentType: 'POSTPAY',
    price: '',
    autoRenew: false,
    isFromPartner: false,
    comment: '',
    soldByUserId: '',
  });

  const [niches, setNiches] = useState<NicheOption[]>([]);
  const [newClientName, setNewClientName] = useState('');
  const [newClientSellerId, setNewClientSellerId] = useState(user?.id || '');
  const [newSiteTitle, setNewSiteTitle] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteNiche, setNewSiteNiche] = useState('');

  useEffect(() => {
    fetchClients();
    fetchProducts();
    fetchAllEmployees();
    fetchDepartments();
    fetchNiches();
  }, []);

  useEffect(() => {
    if (formData.clientId) {
      fetchSites(formData.clientId);
      fetchClientDetail(formData.clientId);
      fetchContracts(formData.clientId);
    } else {
      setSites([]);
      setSelectedClient(null);
      setContracts([]);
      setShowRequisites(false);
    }
  }, [formData.clientId]);

  useEffect(() => {
    if (formData.siteId) {
      fetchSiteServices(formData.siteId);
    } else {
      setExistingSiteServices([]);
    }
  }, [formData.siteId]);

  useEffect(() => {
    if (project) {
      setFormData({
        clientId: project.site.clientId,
        siteId: project.siteId || project.site.id,
        productId: project.productId,
        status: project.status,
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        billingType: project.billingType,
        prepaymentType: project.prepaymentType || 'POSTPAY',
        price: project.price ? (Number(project.price) / 100).toString() : '',
        autoRenew: project.autoRenew,
        isFromPartner: project.isFromPartner,
        comment: project.comment || '',
        soldByUserId: project.site.client.sellerEmployeeId || project.site.client.accountManagerId || '',
      });
    }
  }, [project]);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients?limit=500');
      const data = await res.json();
      setClients(data.clients || []);
    } catch { /* ignore */ }
  };

  const fetchSites = async (clientId: string) => {
    try {
      const res = await fetch(`/api/sites/available?clientId=${clientId}`);
      const data = await res.json();
      setSites(data.sites || []);
    } catch { /* ignore */ }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data.products || []);
    } catch { /* ignore */ }
  };

  const fetchAllEmployees = async () => {
    try {
      const res = await fetch('/api/employees?limit=500');
      const data = await res.json();
      setAllEmployees((data.employees || []).map((e: any) => ({
        id: e.id,
        fullName: e.fullName,
        departmentId: e.departmentId || null,
      })));
    } catch { /* ignore */ }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      setDepartments((data.departments || []).map((d: any) => ({ id: d.id, name: d.name })));
    } catch { /* ignore */ }
  };

  const fetchNiches = async () => {
    try {
      const res = await fetch('/api/niches');
      const data = await res.json();
      setNiches((data.niches || []).map((n: any) => ({ id: n.id, name: n.name })));
    } catch { /* ignore */ }
  };

  const fetchSiteServices = async (siteId: string) => {
    setExistingServicesLoading(true);
    try {
      const res = await fetch(`/api/services?siteId=${siteId}`);
      const data = await res.json();
      setExistingSiteServices((data.services || []).map((s: any) => ({
        id: s.id,
        productId: s.productId,
        product: s.product,
        status: s.status,
        price: s.price,
        billingType: s.billingType,
      })));
    } catch { /* ignore */ }
    finally { setExistingServicesLoading(false); }
  };

  const fetchClientDetail = async (clientId: string) => {
    setSelectedClient(null);
    setShowRequisites(false);
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      const data = await res.json();
      if (data.client) {
        setSelectedClient(data.client);
        setRequisitesForm({
          inn: data.client.inn || '',
          kpp: data.client.kpp || '',
          ogrn: data.client.ogrn || '',
          legalAddress: data.client.legalAddress || '',
          rs: data.client.rs || '',
          bankName: data.client.bankName || '',
          bik: data.client.bik || '',
          ks: data.client.ks || '',
        });
      }
    } catch { /* ignore */ }
  };

  const fetchContracts = async (clientId: string) => {
    setContractsLoading(true);
    try {
      const res = await fetch(`/api/contracts?clientId=${clientId}`);
      const data = await res.json();
      setContracts(data.contracts || []);
    } catch { /* ignore */ }
    finally { setContractsLoading(false); }
  };

  const getClientPayload = (overrides: Record<string, unknown> = {}) => {
    if (!selectedClient) return {};
    return {
      name: selectedClient.name,
      sellerEmployeeId: selectedClient.sellerEmployeeId,
      accountManagerId: selectedClient.accountManagerId || null,
      agentId: selectedClient.agentId || null,
      legalEntityId: selectedClient.legalEntityId || null,
      legalEntityName: selectedClient.legalEntityName || null,
      legalAddress: selectedClient.legalAddress || null,
      inn: selectedClient.inn || null,
      kpp: selectedClient.kpp || null,
      ogrn: selectedClient.ogrn || null,
      rs: selectedClient.rs || null,
      bankName: selectedClient.bankName || null,
      bik: selectedClient.bik || null,
      ks: selectedClient.ks || null,
      paymentRequisites: selectedClient.paymentRequisites || null,
      contacts: selectedClient.contacts || null,
      isReturningClient: selectedClient.isReturningClient || false,
      isKeyClient: selectedClient.isKeyClient || false,
      keyClientStatusComment: selectedClient.keyClientStatusComment || null,
      returningClientStatusComment: selectedClient.returningClientStatusComment || null,
      workStartDate: selectedClient.workStartDate || null,
      isArchived: selectedClient.isArchived || false,
      ...overrides,
    };
  };

  const handleToggleActive = async (checked: boolean) => {
    if (!selectedClient) return;
    try {
      const res = await fetch(`/api/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getClientPayload({ isArchived: !checked })),
      });
      if (res.ok) {
        setSelectedClient(prev => prev ? { ...prev, isArchived: !checked } : null);
      }
    } catch { /* ignore */ }
  };

  const handleSaveRequisites = async () => {
    if (!selectedClient) return;
    setSavingRequisites(true);
    try {
      const res = await fetch(`/api/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getClientPayload({
          inn: requisitesForm.inn || null,
          kpp: requisitesForm.kpp || null,
          ogrn: requisitesForm.ogrn || null,
          legalAddress: requisitesForm.legalAddress || null,
          rs: requisitesForm.rs || null,
          bankName: requisitesForm.bankName || null,
          bik: requisitesForm.bik || null,
          ks: requisitesForm.ks || null,
        })),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.client) {
          setSelectedClient(data.client);
        }
        setShowRequisites(false);
      }
    } catch { /* ignore */ }
    finally { setSavingRequisites(false); }
  };

  const handleUploadContract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !formData.clientId) return;
    setUploadingContract(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('clientId', formData.clientId);
      const res = await fetch('/api/contracts', {
        method: 'POST',
        body: uploadData,
      });
      if (res.ok) {
        await fetchContracts(formData.clientId);
      } else {
        const data = await res.json();
        setError(data.error || 'Ошибка загрузки файла');
      }
    } catch {
      setError('Ошибка загрузки файла');
    } finally {
      setUploadingContract(false);
      e.target.value = '';
    }
  };

  const selectedProduct = products.find((p) => p.id === formData.productId);

  useEffect(() => {
    if (selectedProduct) {
      setExpenseItemValues((prev) => {
        const next: Record<string, { valueType: string; value: number }> = {};
        for (const item of selectedProduct.expenseItems) {
          next[item.expenseItemTemplateId] = prev[item.expenseItemTemplateId] || {
            valueType: item.valueType,
            value: item.defaultValue,
          };
        }
        return next;
      });
    } else {
      setExpenseItemValues({});
    }
  }, [selectedProduct]);

  const getCommission = (role: string) => {
    if (!selectedProduct) return null;
    const comm = selectedProduct.commissions.find((c) => c.role === role);
    if (!comm) return null;
    return formData.isFromPartner ? comm.partnerPercent : comm.standardPercent;
  };

  const sellerPercent = getCommission('SELLER');
  const amPercent = getCommission('ACCOUNT_MANAGER');

  const getAMFee = () => {
    if (!selectedProduct || !formData.price) return null;
    const priceKopecks = parseFloat(formData.price) * 100;
    for (const fee of selectedProduct.accountManagerFees) {
      const min = fee.conditionMin != null ? fee.conditionMin * 100 : -Infinity;
      const max = fee.conditionMax != null ? fee.conditionMax * 100 : Infinity;
      if (priceKopecks >= min && priceKopecks <= max) {
        return Number(fee.feeAmount) / 100;
      }
    }
    if (selectedProduct.accountManagerFees.length > 0) {
      return Number(selectedProduct.accountManagerFees[0].feeAmount) / 100;
    }
    return null;
  };

  const amFee = getAMFee();

  const soldByEmployee = allEmployees.find((e) => e.id === formData.soldByUserId) || null;
  const soldByDepartment = soldByEmployee && soldByEmployee.departmentId
    ? departments.find((d) => d.id === soldByEmployee.departmentId) || null
    : null;
  const isSalesDept = soldByDepartment ? soldByDepartment.name.toLowerCase().includes('продаж') : false;
  const isAMDept = soldByDepartment ? soldByDepartment.name.toLowerCase().includes('аккаунтинг') || soldByDepartment.name.toLowerCase().includes('аккаунт') : false;
  const soldByCommissionPercent = isSalesDept ? sellerPercent : isAMDept ? amPercent : null;
  const soldByCommissionRole = isSalesDept ? 'SELLER' : isAMDept ? 'ACCOUNT_MANAGER' : null;

  const expensesTotal = selectedProduct
    ? selectedProduct.expenseItems.reduce((sum, item) => {
        const priceVal = formData.price ? parseFloat(formData.price) : 0;
        const vals = expenseItemValues[item.expenseItemTemplateId] || {
          valueType: item.valueType,
          value: item.defaultValue,
        };
        if (vals.valueType === 'PERCENT') {
          return sum + (priceVal * vals.value / 100);
        }
        return sum + vals.value;
      }, 0)
    : 0;

  const commissionBase = formData.price ? parseFloat(formData.price) - expensesTotal : 0;
  const soldByCommissionAmount = soldByCommissionPercent != null && commissionBase > 0
    ? (commissionBase * soldByCommissionPercent / 100)
    : null;

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      setError('Введите имя клиента');
      return;
    }
    if (!newClientSellerId) {
      setError('Выберите продавца');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName.trim(), sellerEmployeeId: newClientSellerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка создания клиента');
        return;
      }
      await fetchClients();
      setFormData((prev) => ({ ...prev, clientId: data.client.id }));
      setNewClientName('');
      setNewClientSellerId(user?.id || '');
      setStep('main');
    } catch {
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
    setLoading(true);
    setError('');
    try {
      const selectedNiche = niches.find((n) => n.id === newSiteNiche);
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSiteTitle.trim(),
          websiteUrl: newSiteUrl.trim() || null,
          clientId: formData.clientId,
          niche: selectedNiche ? selectedNiche.name : newSiteNiche,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Ошибка создания сайта');
        return;
      }
      await fetchSites(formData.clientId);
      setFormData((prev) => ({ ...prev, siteId: data.site.id }));
      setNewSiteTitle('');
      setNewSiteUrl('');
      setNewSiteNiche('');
      setStep('main');
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.siteId || !formData.productId) {
      setError('Выберите сайт и продукт');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        siteId: formData.siteId,
        productId: formData.productId,
        status: formData.status,
        startDate: formData.startDate,
        billingType: formData.billingType,
        prepaymentType: formData.prepaymentType,
        price: formData.price || null,
        autoRenew: formData.autoRenew,
        isFromPartner: formData.isFromPartner,
        comment: formData.comment || null,
        soldByUserId: formData.soldByUserId || null,
      };

      if (soldByCommissionRole === 'SELLER' && soldByCommissionPercent != null) {
        payload.sellerCommissionPercent = soldByCommissionPercent;
        if (soldByCommissionAmount != null) {
          payload.sellerCommissionAmount = Math.round(soldByCommissionAmount * 100);
        }
      }
      if (soldByCommissionRole === 'ACCOUNT_MANAGER' && soldByCommissionPercent != null) {
        payload.accountManagerCommissionPercent = soldByCommissionPercent;
        if (soldByCommissionAmount != null) {
          payload.accountManagerCommissionAmount = Math.round(soldByCommissionAmount * 100);
        }
      }
      if (amFee != null) payload.accountManagerFeeAmount = Math.round(amFee * 100);

      if (selectedProduct && selectedProduct.expenseItems.length > 0) {
        payload.expenseItems = selectedProduct.expenseItems.map((item) => {
          const vals = expenseItemValues[item.expenseItemTemplateId] || {
            valueType: item.valueType,
            value: item.defaultValue,
          };
          return {
            expenseItemTemplateId: item.expenseItemTemplateId,
            name: item.template.name,
            valueType: vals.valueType,
            value: vals.value,
            responsibleUserId: expenseItemResponsibles[item.expenseItemTemplateId] || null,
          };
        });
      }

      const url = project ? `/api/services/${project.id}` : '/api/services';
      const method = project ? 'PUT' : 'POST';

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
    } catch {
      setError('Ошибка соединения');
      setLoading(false);
    }
  };

  const filteredClients = clients.filter((c) =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredSites = sites.filter((s) =>
    !siteSearch || s.title.toLowerCase().includes(siteSearch.toLowerCase())
  );

  const isReadOnlyCommission = user && user.roleCode !== 'OWNER' && user.roleCode !== 'CEO';

  if (step === 'newClient') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-bold mb-4">Новый клиент</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Название клиента"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Продавец (seller) *</label>
              <select
                value={newClientSellerId}
                onChange={(e) => setNewClientSellerId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Выберите сотрудника</option>
                {allEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setStep('main'); setError(''); }} className="px-4 py-2 border rounded-md hover:bg-gray-50">Назад</button>
              <button type="button" onClick={handleCreateClient} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'newSite') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-bold mb-4">Новый сайт</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
              <input
                type="text"
                value={newSiteTitle}
                onChange={(e) => setNewSiteTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Название сайта"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                type="text"
                value={newSiteUrl}
                onChange={(e) => setNewSiteUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ниша *</label>
              <select
                value={newSiteNiche}
                onChange={(e) => setNewSiteNiche(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Выберите нишу</option>
                {niches.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setStep('main'); setError(''); }} className="px-4 py-2 border rounded-md hover:bg-gray-50">Назад</button>
              <button type="button" onClick={handleCreateSite} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {project ? 'Редактировать проект' : 'Добавить проект'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Клиент
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Поиск клиента..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-1"
                />
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value, siteId: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  size={Math.min(filteredClients.length + 1, 5)}
                >
                  <option value="">Не выбран</option>
                  {filteredClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setStep('newClient')}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm whitespace-nowrap h-fit"
              >
                + Новый
              </button>
            </div>
          </div>

          {/* Client: Active checkbox + Edit requisites */}
          {formData.clientId && selectedClient && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!selectedClient.isArchived}
                    onChange={(e) => handleToggleActive(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Активный клиент</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowRequisites(!showRequisites)}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  {showRequisites ? 'Скрыть реквизиты' : 'Редактировать реквизиты'}
                </button>
              </div>

              {/* Requisites editing section (collapsible) */}
              {showRequisites && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Реквизиты клиента</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">ИНН</label>
                      <input
                        type="text"
                        value={requisitesForm.inn}
                        onChange={(e) => setRequisitesForm({ ...requisitesForm, inn: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">КПП</label>
                      <input
                        type="text"
                        value={requisitesForm.kpp}
                        onChange={(e) => setRequisitesForm({ ...requisitesForm, kpp: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">ОГРН</label>
                      <input
                        type="text"
                        value={requisitesForm.ogrn}
                        onChange={(e) => setRequisitesForm({ ...requisitesForm, ogrn: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Юридический адрес</label>
                      <input
                        type="text"
                        value={requisitesForm.legalAddress}
                        onChange={(e) => setRequisitesForm({ ...requisitesForm, legalAddress: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Расчетный счет</label>
                      <input
                        type="text"
                        value={requisitesForm.rs}
                        onChange={(e) => setRequisitesForm({ ...requisitesForm, rs: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Банк</label>
                      <input
                        type="text"
                        value={requisitesForm.bankName}
                        onChange={(e) => setRequisitesForm({ ...requisitesForm, bankName: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">БИК</label>
                      <input
                        type="text"
                        value={requisitesForm.bik}
                        onChange={(e) => setRequisitesForm({ ...requisitesForm, bik: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Кор.счет</label>
                      <input
                        type="text"
                        value={requisitesForm.ks}
                        onChange={(e) => setRequisitesForm({ ...requisitesForm, ks: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveRequisites}
                      disabled={savingRequisites}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                      {savingRequisites ? 'Сохранение...' : 'Сохранить реквизиты'}
                    </button>
                  </div>
                </div>
              )}

              {/* Contracts section */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Договора</h3>
                {contractsLoading ? (
                  <p className="text-sm text-gray-500">Загрузка...</p>
                ) : (
                  <>
                    {contracts.length > 0 ? (
                      <ul className="space-y-1 mb-3">
                        {contracts.map((c) => (
                          <li key={c.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                {c.type === 'CONTRACT' ? 'Договор' : c.type === 'ADDENDUM' ? 'Доп.согл.' : c.type === 'NDA' ? 'NDA' : 'Другое'}
                              </span>
                              <a
                                href={`/api/contracts/${c.id}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline truncate"
                                title={c.originalName}
                              >
                                {c.originalName}
                              </a>
                              {c.docNumber && <span className="text-gray-400 text-xs">№{c.docNumber}</span>}
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              {c.uploadedAt && (
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  {new Date(c.uploadedAt).toLocaleDateString('ru-RU')}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm('Удалить документ?')) return;
                                  try {
                                    const res = await fetch(`/api/contracts/${c.id}`, { method: 'DELETE' });
                                    if (res.ok) fetchContracts(formData.clientId);
                                    else { const d = await res.json(); setError(d.error || 'Ошибка удаления'); }
                                  } catch { setError('Ошибка удаления'); }
                                }}
                                className="text-red-400 hover:text-red-600 text-xs"
                                title="Удалить"
                              >
                                ✕
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-400 mb-3">Нет договоров</p>
                    )}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleUploadContract}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingContract}
                        className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-sm disabled:opacity-50"
                      >
                        {uploadingContract ? 'Загрузка...' : 'Загрузить документ'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Site Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Сайт *
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                {formData.clientId ? (
                  <>
                    <input
                      type="text"
                      value={siteSearch}
                      onChange={(e) => setSiteSearch(e.target.value)}
                      placeholder="Поиск сайта..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-1"
                    />
                    <select
                      value={formData.siteId}
                      onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      size={Math.min(filteredSites.length + 1, 5)}
                    >
                      <option value="">Выберите сайт</option>
                      {filteredSites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} {s.websiteUrl ? `(${s.websiteUrl})` : ''}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 py-2">Сначала выберите клиента</p>
                )}
              </div>
              {formData.clientId && (
                <button
                  type="button"
                  onClick={() => setStep('newSite')}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm whitespace-nowrap h-fit"
                >
                  + Новый
                </button>
              )}
            </div>
          </div>

          {/* Existing services for this site */}
          {formData.siteId && (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Существующие услуги
                  {existingSiteServices.length > 0 && (
                    <span className="text-gray-400 font-normal ml-1">({existingSiteServices.length})</span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExistingServices(!showExistingServices)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {showExistingServices ? 'Скрыть' : 'Показать'}
                </button>
              </div>
              {showExistingServices && (
                <>
                  {existingServicesLoading ? (
                    <p className="text-sm text-gray-500">Загрузка...</p>
                  ) : existingSiteServices.length > 0 ? (
                    <div className="space-y-2">
                      {existingSiteServices.map((svc) => (
                        <div key={svc.id} className="flex items-center justify-between bg-gray-50 rounded p-2.5 text-sm border border-gray-100">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-700">{svc.product.name}</span>
                            <span className="ml-2 text-xs text-gray-500">
                              {svc.price ? `${(Number(svc.price) / 100).toLocaleString('ru-RU')} руб.` : '—'}
                            </span>
                            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                              svc.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                              svc.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {svc.status === 'ACTIVE' ? 'Активна' : svc.status === 'PAUSED' ? 'Приостановлена' : 'Завершена'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {(!project || project.id !== svc.id) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    productId: svc.productId,
                                    price: svc.price ? (Number(svc.price) / 100).toString() : '',
                                    status: svc.status,
                                    billingType: svc.billingType,
                                  }));
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 whitespace-nowrap"
                              >
                                Редактировать
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm(`Удалить услугу «${svc.product.name}»?`)) return;
                                try {
                                  const res = await fetch(`/api/services/${svc.id}`, { method: 'DELETE' });
                                  if (res.ok) {
                                    fetchSiteServices(formData.siteId);
                                  } else {
                                    const d = await res.json();
                                    setError(d.error || 'Ошибка удаления услуги');
                                  }
                                } catch {
                                  setError('Ошибка удаления услуги');
                                }
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 whitespace-nowrap"
                              title="Удалить услугу"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Нет услуг для этого сайта</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        productId: '',
                        price: '',
                        status: 'ACTIVE',
                        billingType: 'MONTHLY',
                        prepaymentType: 'POSTPAY',
                        autoRenew: false,
                        isFromPartner: false,
                        comment: '',
                        soldByUserId: '',
                      }));
                      setExpenseItemResponsibles({});
                    }}
                    className="mt-3 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                  >
                    + Добавить ещё услугу
                  </button>
                </>
              )}
            </div>
          )}

          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Продукт (Услуга) *
            </label>
            <select
              required
              value={formData.productId}
              onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Выберите продукт</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Цена (руб.)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала *</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Billing & Status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип оплаты</label>
              <select
                value={formData.billingType}
                onChange={(e) => setFormData({ ...formData, billingType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="MONTHLY">Ежемесячная</option>
                <option value="ONE_TIME">Разовая</option>
                <option value="QUARTERLY">Ежеквартальная</option>
                <option value="YEARLY">Ежегодная</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Предоплата</label>
              <select
                value={formData.prepaymentType}
                onChange={(e) => setFormData({ ...formData, prepaymentType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="POSTPAY">Постоплата</option>
                <option value="FULL_PREPAY">Полная предоплата</option>
                <option value="PARTIAL_PREPAY">Частичная предоплата</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="ACTIVE">Активна</option>
                <option value="PAUSED">Приостановлена</option>
                <option value="FINISHED">Завершена</option>
              </select>
            </div>
          </div>

          {/* Partner & AutoRenew */}
          <div className="flex gap-6 items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isFromPartner}
                onChange={(e) => setFormData({ ...formData, isFromPartner: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Лид от партнёра</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoRenew}
                onChange={(e) => setFormData({ ...formData, autoRenew: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Автопродление</span>
            </label>
          </div>

          {/* Кто сделал продажу */}
          {selectedProduct && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-3">Кто сделал продажу</h3>
              <select
                value={formData.soldByUserId}
                onChange={(e) => setFormData({ ...formData, soldByUserId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
              >
                <option value="">Выберите сотрудника</option>
                {allEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
              {soldByEmployee && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Отдел:</span>
                    {soldByDepartment ? (
                      <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                        isSalesDept ? 'bg-green-100 text-green-800' :
                        isAMDept ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {soldByDepartment.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">Не указан</span>
                    )}
                  </div>
                  {soldByCommissionPercent != null && (
                    <div>
                      <span className="text-gray-600">Комиссия:</span>{' '}
                      <span className="font-medium">
                        {soldByCommissionPercent}%
                        {formData.isFromPartner ? ' (партнёр)' : ' (обычный)'}
                      </span>
                    </div>
                  )}
                  {formData.price && expensesTotal > 0 && (
                    <div>
                      <span className="text-gray-600">Итого расходы:</span>{' '}
                      <span className="font-medium">{Math.round(expensesTotal).toLocaleString('ru-RU')} руб.</span>
                      <span className="text-gray-400 ml-2">
                        (база комиссии: {Math.round(commissionBase).toLocaleString('ru-RU')} руб.)
                      </span>
                    </div>
                  )}
                  {soldByCommissionAmount != null && (
                    <div>
                      <span className="text-gray-600">Сумма комиссии:</span>{' '}
                      <span className="font-bold text-green-700">≈ {Math.round(soldByCommissionAmount).toLocaleString('ru-RU')} руб.</span>
                    </div>
                  )}
                  {amFee != null && (
                    <div>
                      <span className="text-gray-600">Ведение АМ:</span>{' '}
                      <span className="font-medium">{amFee.toLocaleString('ru-RU')} руб.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Expense Items from Product with Responsible assignment */}
          {selectedProduct && selectedProduct.expenseItems.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Статьи ожидаемых расходов и ответственные</h3>
              <div className="space-y-3">
                {selectedProduct.expenseItems.map((item) => {
                  const currentVals = expenseItemValues[item.expenseItemTemplateId] || {
                    valueType: item.valueType,
                    value: item.defaultValue,
                  };
                  const priceVal = formData.price ? parseFloat(formData.price) : 0;
                  const calculated = currentVals.valueType === 'PERCENT'
                    ? (priceVal * currentVals.value / 100).toFixed(0)
                    : currentVals.value.toFixed(0);
                  const deptId = item.template.departmentId;
                  const deptEmployees = deptId
                    ? allEmployees.filter((e) => e.departmentId === deptId)
                    : allEmployees;
                  return (
                    <div key={item.id} className="flex items-center gap-3 bg-white rounded p-2 border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">{item.template.name}</span>
                          {item.template.department && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {item.template.department.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <select
                            value={currentVals.valueType}
                            onChange={(e) => setExpenseItemValues((prev) => ({
                              ...prev,
                              [item.expenseItemTemplateId]: { ...currentVals, valueType: e.target.value },
                            }))}
                            className="px-1.5 py-0.5 border border-gray-300 rounded text-xs"
                          >
                            <option value="PERCENT">%</option>
                            <option value="FIXED">руб.</option>
                          </select>
                          <input
                            type="number"
                            step={currentVals.valueType === 'PERCENT' ? '0.01' : '1'}
                            value={currentVals.value}
                            onChange={(e) => {
                              const raw = parseFloat(e.target.value) || 0;
                              setExpenseItemValues((prev) => ({
                                ...prev,
                                [item.expenseItemTemplateId]: { ...currentVals, value: raw },
                              }));
                            }}
                            className="w-24 px-1.5 py-0.5 border border-gray-300 rounded text-xs"
                          />
                          {priceVal > 0 && (
                            <span className="text-xs text-gray-400">
                              ≈ {Number(calculated).toLocaleString('ru-RU')} руб.
                            </span>
                          )}
                        </div>
                      </div>
                      {item.template.departmentId && (
                        <select
                          value={expenseItemResponsibles[item.expenseItemTemplateId] || ''}
                          onChange={(e) => setExpenseItemResponsibles((prev) => ({
                            ...prev,
                            [item.expenseItemTemplateId]: e.target.value,
                          }))}
                          className="w-48 px-2 py-1.5 border border-gray-300 rounded text-sm"
                        >
                          <option value="">Ответственный</option>
                          {deptEmployees.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
              placeholder="Комментарий (необязательно)"
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex justify-end gap-3">
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
