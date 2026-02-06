import Layout from '@/components/Layout';
import ContractCard from '@/components/ContractCard';

export default function ContractPage({ params }: { params: { id: string } }) {
  return (
    <Layout>
      <ContractCard contractId={params.id} />
    </Layout>
  );
}
