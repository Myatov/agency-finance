import Layout from '@/components/Layout';
import ServicePeriods from '@/components/ServicePeriods';

export default async function ServicePeriodsPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  return (
    <Layout>
      <ServicePeriods serviceId={serviceId} />
    </Layout>
  );
}
