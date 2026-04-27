import { NavLink, Stack, ThemeIcon } from '@mantine/core';
import {
  IconInfoCircle,
  IconFileCode,
  IconFolderSearch,
  IconGauge,
  IconLayoutDashboard,
  IconListDetails
} from '@tabler/icons-react';
import { useUiStore } from '../../store/uiStore';
import type { AppPage } from '../../types';

const items: Array<{ page: AppPage; label: string; icon: typeof IconLayoutDashboard }> = [
  { page: 'dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { page: 'config', label: 'Config Editor', icon: IconFileCode },
  { page: 'logs', label: 'Logs', icon: IconListDetails },
  { page: 'monitor', label: 'Process Monitor', icon: IconGauge },
  { page: 'discovery', label: 'Environment Paths', icon: IconFolderSearch },
  { page: 'about', label: 'About', icon: IconInfoCircle }
];

export function AppSidebar() {
  const activePage = useUiStore((state) => state.activePage);
  const setActivePage = useUiStore((state) => state.setActivePage);

  return (
    <Stack gap="xs">
      {items.map((item) => (
        <NavLink
          key={item.page}
          active={activePage === item.page}
          label={item.label}
          onClick={() => setActivePage(item.page)}
          py={8}
          leftSection={
            <ThemeIcon variant="light" radius="sm" size={28}>
              <item.icon size={16} />
            </ThemeIcon>
          }
        />
      ))}
    </Stack>
  );
}
