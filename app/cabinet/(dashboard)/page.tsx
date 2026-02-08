import { getClientPortalSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export default async function CabinetHomePage() {
  const session = await getClientPortalSession();
  if (!session) return null;

  const [client, sitesCount, servicesCount, invoicesCount, closeoutCount, reportsCount] = await Promise.all([
    prisma.client.findUnique({
      where: { id: session.clientId },
      select: { name: true },
    }),
    prisma.site.count({ where: { clientId: session.clientId } }),
    prisma.service.count({ where: { site: { clientId: session.clientId } } }),
    prisma.invoice.count({
      where: { workPeriod: { service: { site: { clientId: session.clientId } } } },
    }),
    prisma.client.findUnique({
      where: { id: session.clientId },
      select: { legalEntity: { select: { generateClosingDocs: true } } },
    }).then((c) =>
      c?.legalEntity?.generateClosingDocs
        ? prisma.closeoutDocument.count({ where: { clientId: session.clientId } })
        : Promise.resolve(0)
    ),
    prisma.workPeriodReport.count({
      where: { workPeriod: { service: { site: { clientId: session.clientId } } } },
    }),
  ]);

  const cards = [
    { href: '/cabinet/sites', label: 'Сайты', count: sitesCount },
    { href: '/cabinet/services', label: 'Услуги', count: servicesCount },
    { href: '/cabinet/invoices', label: 'Счета', count: invoicesCount },
    { href: '/cabinet/closeout', label: 'Закрывающие документы', count: closeoutCount },
    { href: '/cabinet/reports', label: 'Отчёты', count: reportsCount },
  ];

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-800 mb-1">
        {client?.name ?? 'Клиент'}
      </h2>
      <p className="text-slate-500 text-sm mb-8">Здесь собраны ваши проекты, счета и документы.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ href, label, count }) => (
          <Link
            key={href}
            href={href}
            className="block p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-teal-300 hover:shadow transition"
          >
            <div className="font-medium text-slate-800">{label}</div>
            <div className="text-2xl font-semibold text-teal-600 mt-1">{count}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
