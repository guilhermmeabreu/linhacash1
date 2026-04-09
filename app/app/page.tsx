import { Suspense } from 'react';
import { ContentContainer } from '@/components/layout';
import { Surface } from '@/components/ui';
import { DashboardView } from './_components/dashboard-view';

function DashboardLoadingFallback() {
  return (
    <ContentContainer width="content">
      <Surface>
        <p>Carregando dashboard...</p>
      </Surface>
    </ContentContainer>
  );
}

export default function AppDashboardPage() {
  return (
    <Suspense fallback={<DashboardLoadingFallback />}>
      <DashboardView />
    </Suspense>
  );
}
