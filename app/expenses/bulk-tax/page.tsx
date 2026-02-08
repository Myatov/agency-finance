import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Layout from '@/components/Layout';
import { canAccessBulkTaxExpenses } from '@/lib/permissions';
import BulkTaxExpensesClient from './BulkTaxExpensesClient';

export default async function BulkTaxExpensesPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!canAccessBulkTaxExpenses(user)) redirect('/expenses');

  return (
    <Layout>
      <BulkTaxExpensesClient />
    </Layout>
  );
}
