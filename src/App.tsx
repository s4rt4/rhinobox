import { AppShell, Box } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { AppHeader } from './components/layout/AppHeader';
import { AppSidebar } from './components/layout/AppSidebar';
import { DashboardPage } from './pages/DashboardPage';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { ConfigEditorPage } from './pages/ConfigEditorPage';
import { LogsPage } from './pages/LogsPage';
import { ProcessMonitorPage } from './pages/ProcessMonitorPage';
import { runtimeMode } from './lib/runtime';
import { getServices } from './lib/servicesApi';
import { useUiStore } from './store/uiStore';

export function App() {
  const mode = runtimeMode();
  const activePage = useUiStore((state) => state.activePage);
  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: getServices,
    refetchInterval: 10000,
    refetchOnWindowFocus: false,
    staleTime: 5000
  });
  const services = servicesQuery.data ?? [];
  const running = services.filter((item) => item.status === 'running').length;
  const total = services.length;

  const page = (() => {
    switch (activePage) {
      case 'discovery':
        return <DiscoveryPage />;
      case 'config':
        return <ConfigEditorPage />;
      case 'logs':
        return <LogsPage />;
      case 'monitor':
        return <ProcessMonitorPage />;
      default:
        return <DashboardPage />;
    }
  })();

  const contentMaxWidth =
    activePage === 'dashboard' ? 780 : activePage === 'discovery' ? 980 : 960;

  return (
    <AppShell
      padding="sm"
      header={{ height: 60 }}
      navbar={{ width: 220, breakpoint: 'md' }}
    >
      <AppShell.Header>
        <AppHeader
          summaryText={`${running}/${total || 0} running`}
          refreshing={servicesQuery.isFetching}
          onRefresh={() => void servicesQuery.refetch()}
        />
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        <AppSidebar />
      </AppShell.Navbar>
      <AppShell.Main>
        <Box maw={contentMaxWidth}>{page}</Box>
      </AppShell.Main>
    </AppShell>
  );
}
