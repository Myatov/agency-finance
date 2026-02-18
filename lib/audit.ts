import { prisma } from '@/lib/db';

export async function logAudit(params: {
  userId?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId?: string;
  serviceId?: string;
  description: string;
  oldValue?: any;
  newValue?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        serviceId: params.serviceId || null,
        description: params.description,
        oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
        newValue: params.newValue ? JSON.stringify(params.newValue) : null,
      },
    });
  } catch (e) {
    console.error('Failed to write audit log:', e);
  }
}
