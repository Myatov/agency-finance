import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

export interface SessionUser {
  id: string;
  fullName: string;
  roleId: string;
  roleCode: string; // OWNER, CEO, ACCOUNT_MANAGER, etc.
  departmentId: string | null;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function login(password: string): Promise<SessionUser | null> {
  // Find user by password hash comparison
  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { role: true },
  });

  for (const user of users) {
    const isValid = await verifyPassword(password, user.passwordHash);
    if (isValid) {
      return {
        id: user.id,
        fullName: user.fullName,
        roleId: user.roleId,
        roleCode: user.role.code,
        departmentId: user.departmentId,
      };
    }
  }

  return null;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session')?.value;

  if (!sessionId) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        fullName: true,
        roleId: true,
        departmentId: true,
        isActive: true,
        role: {
          select: {
            code: true,
          },
        },
      },
    });

    if (!user || !user.isActive || !user.role) {
      return null;
    }

    return {
      id: user.id,
      fullName: user.fullName,
      roleId: user.roleId,
      roleCode: user.role.code,
      departmentId: user.departmentId,
    };
  } catch {
    return null;
  }
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  
  // Determine if we should use secure cookies
  // Check environment variable first, then fall back to NODE_ENV
  // SECURE_COOKIES should be set to 'true' if using HTTPS
  const useSecure = process.env.SECURE_COOKIES === 'true' || 
    (process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false');
  
  cookieStore.set('session', userId, {
    httpOnly: true,
    secure: useSecure,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
