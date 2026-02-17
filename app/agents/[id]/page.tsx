import Layout from '@/components/Layout';
import AgentDetail from './AgentDetail';

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  return (
    <Layout>
      <AgentDetail agentId={params.id} />
    </Layout>
  );
}
