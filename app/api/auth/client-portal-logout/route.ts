import { NextResponse } from 'next/server';
import { clearClientPortalSession } from '@/lib/auth';

export async function POST() {
  await clearClientPortalSession();
  return NextResponse.json({ success: true });
}
