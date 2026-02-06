import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

function canManageAgents(roleCode: string): boolean {
  return roleCode === 'OWNER' || roleCode === 'CEO';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        _count: { select: { clients: true } },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageAgents(user.roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const opt = (v: unknown) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);
    const name = body.name != null ? String(body.name).trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Имя обязательно' }, { status: 400 });
    }

    const companyName = opt(body.companyName);
    const professionalActivity = opt(body.professionalActivity);
    const phone = opt(body.phone);
    const telegram = opt(body.telegram);
    const position = opt(body.position);
    const commissionOnTop = body.commissionOnTop === true;
    const commissionInOurAmount = body.commissionInOurAmount === true;
    const desiredCommissionPercent = body.desiredCommissionPercent != null && body.desiredCommissionPercent !== ''
      ? parseFloat(String(body.desiredCommissionPercent)) : null;
    const sellsOnBehalfOfCompany = body.sellsOnBehalfOfCompany === true;
    const transfersForClosingToUs = body.transfersForClosingToUs === true;
    const description = opt(body.description);
    const source = body.source && ['PARTNER', 'AGENT', 'REFERRER', 'EMPLOYEE'].includes(String(body.source))
      ? body.source : null;
    const status = body.status && ['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(String(body.status))
      ? body.status : 'ACTIVE';

    const agent = await prisma.agent.update({
      where: { id },
      data: {
        name,
        companyName,
        professionalActivity,
        phone,
        telegram,
        position,
        commissionOnTop,
        commissionInOurAmount,
        desiredCommissionPercent: desiredCommissionPercent != null && !isNaN(desiredCommissionPercent) ? desiredCommissionPercent : null,
        sellsOnBehalfOfCompany,
        transfersForClosingToUs,
        description,
        source,
        status,
      },
    });

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Error updating agent:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
