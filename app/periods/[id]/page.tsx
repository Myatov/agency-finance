import Layout from '@/components/Layout';
import PeriodDetail from '@/components/PeriodDetail';

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Layout>
      <PeriodDetail periodId={id} />
    </Layout>
  );
}
