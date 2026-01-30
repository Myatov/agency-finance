import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Layout from '@/components/Layout';
import ExpensesList from '@/components/ExpensesList';

export default async function ExpensesPage() {
  const user = await getSession();
  
  if (!user) {
    redirect('/login');
  }

  return (
    <Layout>
      <ExpensesList />
    </Layout>
  );
}
