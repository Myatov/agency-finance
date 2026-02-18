import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Layout from '@/components/Layout';
import HistoryLog from '@/components/HistoryLog';

export default async function HistoryPage() {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  return (
    <Layout>
      <HistoryLog />
    </Layout>
  );
}
