import { redirect } from 'next/navigation';
import { getClientPortalSession } from '@/lib/auth';
import CabinetNav from './CabinetNav';

export default async function CabinetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getClientPortalSession();
  if (!session) {
    redirect('/cabinet/enter');
  }
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-teal-700 text-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Личный кабинет</h1>
          <CabinetNav />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
