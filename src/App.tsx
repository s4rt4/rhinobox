import { useEffect } from 'react';
import { AppShell, Box } from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useDocumentVisibility } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { AppHeader } from './components/layout/AppHeader';
import { AppFooter } from './components/layout/AppFooter';
import { AppSidebar } from './components/layout/AppSidebar';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { VirtualHostsPage } from './pages/VirtualHostsPage';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { ConfigEditorPage } from './pages/ConfigEditorPage';
import { LogsPage } from './pages/LogsPage';
import { ProcessMonitorPage } from './pages/ProcessMonitorPage';
import { AboutPage } from './pages/AboutPage';
import { runtimeMode } from './lib/runtime';
import { getServices } from './lib/servicesApi';
import { getSystemMetrics } from './lib/systemMetricsApi';
import { useUiStore } from './store/uiStore';
import type { AppPage } from './types';

const appPages: AppPage[] = ['dashboard', 'projects', 'vhosts', 'discovery', 'config', 'logs', 'monitor', 'about'];

export function App() {
  const mode = runtimeMode();
  const activePage = useUiStore((state) => state.activePage);
  const globalSearch = useUiStore((state) => state.globalSearch);
  const setGlobalSearch = useUiStore((state) => state.setGlobalSearch);
  const setActivePage = useUiStore((state) => state.setActivePage);
  const documentVisibility = useDocumentVisibility();
  const isVisible = documentVisibility === 'visible';
  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: getServices,
    refetchInterval: isVisible && activePage === 'dashboard' ? 15000 : false,
    refetchOnWindowFocus: false,
    staleTime: 15000,
    placeholderData: (previousData) => previousData
  });
  const metricsQuery = useQuery({
    queryKey: ['system-metrics'],
    queryFn: getSystemMetrics,
    refetchInterval: isVisible ? 12000 : false,
    refetchOnWindowFocus: false,
    staleTime: 10000,
    placeholderData: (previousData) => previousData
  });
  const services = servicesQuery.data ?? [];
  const visibleServices = services.filter((item) => !['localhost', 'phpmyadmin'].includes(item.key));
  const controllableServices = visibleServices.filter(
    (item) => item.kind === 'process' || item.kind === 'windows-service'
  );
  const running = controllableServices.filter((item) => item.status === 'running').length;
  const total = controllableServices.length;

  useEffect(() => {
    if (mode !== 'tauri') return undefined;

    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<string>('tray:navigate', (event) => {
      if (appPages.includes(event.payload as AppPage)) {
        setActivePage(event.payload as AppPage);
      }
    }).then((handler) => {
      if (disposed) {
        handler();
        return;
      }
      unlisten = handler;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [mode, setActivePage]);

  function terminateApp() {
    if (mode === 'tauri') {
      void invoke('terminate_app');
      return;
    }
    window.close();
  }

  const page = (() => {
    switch (activePage) {
      case 'discovery':
        return <DiscoveryPage />;
      case 'config':
        return <ConfigEditorPage />;
      case 'projects':
        return <ProjectsPage />;
      case 'vhosts':
        return <VirtualHostsPage />;
      case 'logs':
        return <LogsPage />;
      case 'monitor':
        return <ProcessMonitorPage />;
      case 'about':
        return <AboutPage />;
      default:
        return <DashboardPage />;
    }
  })();

  const contentMaxWidth =
    activePage === 'dashboard'
      ? 920
      : activePage === 'projects'
        ? 1040
      : activePage === 'vhosts'
        ? 1100
      : activePage === 'discovery'
        ? 980
        : activePage === 'config'
          ? 1180
          : activePage === 'about'
            ? 980
            : 960;

  return (
    <AppShell
      padding="xs"
      header={{ height: 48 }}
      footer={{ height: 34 }}
      navbar={{ width: 184, breakpoint: 'md' }}
      style={{ height: '100vh', overflow: 'hidden' }}
      styles={{
        main: {
          height: 'calc(100vh - 82px)',
          boxSizing: 'border-box',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: 8
        }
      }}
    >
      <AppShell.Header>
        <AppHeader
          summaryText={`${running}/${total || 0} running`}
          refreshing={servicesQuery.isFetching}
          search={globalSearch}
          onSearchChange={setGlobalSearch}
          onRefresh={() => void servicesQuery.refetch()}
          onTerminate={terminateApp}
        />
      </AppShell.Header>
      <AppShell.Navbar p={8}>
        <AppSidebar />
      </AppShell.Navbar>
      <AppShell.Footer>
        <AppFooter metrics={metricsQuery.data} loading={metricsQuery.isPending} />
      </AppShell.Footer>
      <AppShell.Main>
        <Box maw={contentMaxWidth} className="app-page">
          {page}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
