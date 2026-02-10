import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canView = await hasPermission(user, 'contacts', 'view');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
      include: {
        clientLinks: {
          include: {
            client: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Error fetching contact:', error);
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

    const canEdit = await hasPermission(user, 'contacts', 'edit');
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.contact.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const body = await request.json();
    const opt = (v: unknown) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);
    const name = body.name != null ? String(body.name).trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Имя обязательно' }, { status: 400 });
    }

    const phone1 = opt(body.phone1);
    const phone2 = opt(body.phone2);
    const telegram = opt(body.telegram);
    const whatsapp = opt(body.whatsapp);
    const position = opt(body.position);
    const note = opt(body.note);
    let birthDate: Date | null = null;
    if (body.birthDate) {
      const d = new Date(body.birthDate);
      if (!isNaN(d.getTime())) birthDate = d;
    }

    const contact = await prisma.contact.update({
      where: { id: params.id },
      data: {
        name,
        phone1,
        phone2,
        birthDate,
        telegram,
        whatsapp,
        position,
        note,
      },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Error updating contact:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canDelete = await hasPermission(user, 'contacts', 'delete');
    if (!canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.contact.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
