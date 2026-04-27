import { AppShell, Box } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { AppHeader } from './components/layout/AppHeader';
import { AppFooter } from './components/layout/AppFooter';
import { AppSidebar } from './components/layout/AppSidebar';
import { DashboardPage } from './pages/DashboardPage';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { ConfigEditorPage } from './pages/ConfigEditorPage';
import { LogsPage } from './pages/LogsPage';
import { ProcessMonitorPage } from './pages/ProcessMonitorPage';
import { runtimeMode } from './lib/runtime';
import { getServices } from './lib/servicesApi';
import { getSystemMetrics } from './lib/systemMetricsApi';
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
  const metricsQuery = useQuery({
    queryKey: ['system-metrics'],
    queryFn: getSystemMetrics,
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
    staleTime: 3000
  });
  const services = servicesQuery.data ?? [];
  const visibleServices = services.filter((item) => !['localhost', 'phpmyadmin'].includes(item.key));
  const running = visibleServices.filter((item) => item.status === 'running').length;
  const total = visibleServices.length;

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
    activePage === 'dashboard' ? 780 : activePage === 'discovery' ? 980 : activePage === 'config' ? 1180 : 960;

  return (
    <AppShell
      padding="sm"
      header={{ height: 60 }}
      footer={{ height: 34 }}
      navbar={{ width: 220, breakpoint: 'md' }}
      style={{ height: '100vh', overflow: 'hidden' }}
      styles={{
        main: {
          height: 'calc(100vh - 94px)',
          boxSizing: 'border-box',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: 'calc(0.75rem + 34px)'
        }
      }}
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
      <AppShell.Footer>
        <AppFooter metrics={metricsQuery.data} loading={metricsQuery.isLoading || metricsQuery.isFetching} />
      </AppShell.Footer>
      <AppShell.Main>
        <Box maw={contentMaxWidth} pb="xl">
          {page}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
