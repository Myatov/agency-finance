import { prisma } from './db';
import { SessionUser } from './auth';

const SECTIONS_VIEW_ALL = ['sites', 'services', 'clients', 'incomes', 'expenses', 'employees', 'contracts', 'closeout', 'storage'] as const;

// Проверка: может ли пользователь видеть все элементы раздела (иначе — только свои/назначенные)
export async function hasViewAllPermission(
  user: SessionUser,
  section: string
): Promise<boolean> {
  if (!SECTIONS_VIEW_ALL.includes(section as any)) return true;
  if (user.roleCode === 'OWNER') return true;
  if (user.roleCode === 'CEO') {
    if (section === 'roles' || section === 'legal-entities') return false;
    return true;
  }
  const hasManage = await prisma.rolePermission.findFirst({
    where: { roleId: user.roleId, section, permission: 'manage' },
  });
  if (hasManage) return true;
  const hasViewAll = await prisma.rolePermission.findFirst({
    where: { roleId: user.roleId, section, permission: 'view_all' },
  });
  return !!hasViewAll;
}

// Check if user has specific permission for a section
export async function hasPermission(
  user: SessionUser,
  section: string,
  permission: 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'view_all'
): Promise<boolean> {
  // System roles: OWNER and CEO have full access (except roles/legal-entities for CEO)
  if (user.roleCode === 'OWNER') {
    return true;
  }
  if (user.roleCode === 'CEO') {
    if (section === 'roles' || section === 'legal-entities') return false;
    return true;
  }

  // Check if user has 'manage' permission (implies all other permissions including view_all)
  const hasManage = await prisma.rolePermission.findFirst({
    where: {
      roleId: user.roleId,
      section,
      permission: 'manage',
    },
  });

  if (hasManage) {
    return true;
  }

  // Check specific permission
  const hasPermissionCheck = await prisma.rolePermission.findFirst({
    where: {
      roleId: user.roleId,
      section,
      permission,
    },
  });

  return !!hasPermissionCheck;
}

// Helper function to check section access (view or higher)
export async function canViewSection(user: SessionUser, section: string): Promise<boolean> {
  return hasPermission(user, section, 'view');
}

// Может ли пользователь управлять сотрудниками (добавлять/редактировать/удалять)
export async function canManageUsers(user: SessionUser, targetUserId?: string, targetDepartmentId?: string | null): Promise<boolean> {
  if (user.roleCode === 'OWNER' || user.roleCode === 'CEO') {
    return true;
  }
  const canManage = await hasPermission(user, 'employees', 'manage');
  if (canManage) return true;
  // Руководитель отдела — только сотрудники своего отдела
  if (user.roleCode === 'HEAD' && targetDepartmentId === user.departmentId) {
    return true;
  }
  return false;
}

export async function canEditEmployee(user: SessionUser, targetDepartmentId?: string | null): Promise<boolean> {
  if (await canManageUsers(user, undefined, targetDepartmentId)) return true;
  return hasPermission(user, 'employees', 'edit');
}

export async function canDeleteEmployee(user: SessionUser, targetDepartmentId?: string | null): Promise<boolean> {
  if (await canManageUsers(user, undefined, targetDepartmentId)) return true;
  return hasPermission(user, 'employees', 'delete');
}

export async function canManageProducts(user: SessionUser): Promise<boolean> {
  return hasPermission(user, 'products', 'manage');
}

export async function canManageAccounts(user: SessionUser): Promise<boolean> {
  // This is now handled by roles, but keep for backward compatibility
  return user.roleCode === 'OWNER' || user.roleCode === 'CEO';
}

export async function canViewAccounts(user: SessionUser): Promise<boolean> {
  return canManageAccounts(user);
}

export async function canAssignAccountManager(user: SessionUser): Promise<boolean> {
  return hasPermission(user, 'sites', 'manage');
}

export async function canEditSite(user: SessionUser, siteCreatorId: string, siteAccountManagerId?: string | null): Promise<boolean> {
  const canManage = await hasPermission(user, 'sites', 'manage');
  if (canManage) {
    return true;
  }

  const canEdit = await hasPermission(user, 'sites', 'edit');
  if (canEdit && siteCreatorId === user.id) {
    return true;
  }

  // Account manager can edit their sites
  if (canEdit && siteAccountManagerId === user.id) {
    return true;
  }

  return false;
}

export async function canDeleteSite(user: SessionUser): Promise<boolean> {
  return hasPermission(user, 'sites', 'delete');
}

// Legacy aliases for backward compatibility
export async function canEditProject(user: SessionUser, projectCreatorId: string, projectAccountManagerId?: string | null): Promise<boolean> {
  return canEditSite(user, projectCreatorId, projectAccountManagerId);
}

export async function canDeleteProject(user: SessionUser): Promise<boolean> {
  return canDeleteSite(user);
}

export async function canAddClient(user: SessionUser): Promise<boolean> {
  return hasPermission(user, 'clients', 'create');
}

export async function canEditClient(user: SessionUser): Promise<boolean> {
  return hasPermission(user, 'clients', 'edit');
}

export async function canDeleteClient(user: SessionUser): Promise<boolean> {
  return hasPermission(user, 'clients', 'delete');
}

export async function canAddIncome(
  user: SessionUser,
  serviceSiteAccountManagerId?: string | null,
  serviceSiteClientSellerId?: string
): Promise<boolean> {
  const canCreate = await hasPermission(user, 'incomes', 'create');
  if (canCreate) {
    // If user can create, check if they can create for any service or only specific ones
    // For account managers, check if they manage the site of this service
    if (user.roleCode === 'ACCOUNT_MANAGER' && serviceSiteAccountManagerId !== user.id) {
      return false;
    }
    // For sellers, check if they are the seller for the client of this service's site
    if (user.roleCode === 'SELLER' && serviceSiteClientSellerId !== user.id) {
      return false;
    }
    return true;
  }

  return false;
}

export async function canEditIncome(user: SessionUser, incomeCreatorId: string): Promise<boolean> {
  const canManage = await hasPermission(user, 'incomes', 'manage');
  if (canManage) {
    return true;
  }

  const canEdit = await hasPermission(user, 'incomes', 'edit');
  return canEdit && incomeCreatorId === user.id;
}

export async function canEditExpense(user: SessionUser, expenseCreatorId: string): Promise<boolean> {
  const canManage = await hasPermission(user, 'expenses', 'manage');
  if (canManage) {
    return true;
  }

  const canEdit = await hasPermission(user, 'expenses', 'edit');
  return canEdit && expenseCreatorId === user.id;
}

export async function canManageCostItems(user: SessionUser): Promise<boolean> {
  return (await hasPermission(user, 'cost-items', 'manage')) || (await hasPermission(user, 'expenses', 'manage'));
}

export async function canViewCostItems(user: SessionUser): Promise<boolean> {
  return (await hasPermission(user, 'cost-items', 'view')) || (await hasPermission(user, 'expenses', 'view'));
}

export async function canViewReports(user: SessionUser): Promise<boolean> {
  return hasPermission(user, 'reports', 'view');
}

export async function canChangePassword(user: SessionUser, targetUserId?: string): Promise<boolean> {
  if (user.roleCode === 'OWNER' || user.roleCode === 'CEO') {
    return true;
  }

  return targetUserId === user.id;
}

export async function getDefaultRoute(user: SessionUser): Promise<string> {
  if (user.roleCode === 'OWNER' || user.roleCode === 'CEO') {
    return '/expenses';
  }

  if (user.roleCode === 'ACCOUNT_MANAGER') {
    return '/services';
  }

  if (user.roleCode === 'SELLER') {
    return '/clients';
  }

  return '/services';
}
