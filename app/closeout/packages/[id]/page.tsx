import Layout from '@/components/Layout';
import CloseoutPackageCard from '@/components/CloseoutPackageCard';

export default function CloseoutPackagePage({ params }: { params: { id: string } }) {
  return (
    <Layout>
      <CloseoutPackageCard packageId={params.id} />
    </Layout>
  );
}
