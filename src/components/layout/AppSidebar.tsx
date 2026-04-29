import { NavLink, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconInfoCircle,
  IconFileCode,
  IconFolderSearch,
  IconGauge,
  IconFolderCode,
  IconLink,
  IconLayoutDashboard,
  IconListDetails
} from '@tabler/icons-react';
import { useUiStore } from '../../store/uiStore';
import type { AppPage } from '../../types';

const items: Array<{ page: AppPage; label: string; icon: typeof IconLayoutDashboard }> = [
  { page: 'dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  { page: 'projects', label: 'Projects', icon: IconFolderCode },
  { page: 'vhosts', label: 'Virtual Domains', icon: IconLink },
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
    <Stack gap={6}>
      <Text size="10px" fw={800} tt="uppercase" c="dimmed" px={8} mt={2}>
        Workspace
      </Text>
      {items.map((item) => (
        <NavLink
          key={item.page}
          active={activePage === item.page}
          label={item.label}
          onClick={() => setActivePage(item.page)}
          py={6}
          px={8}
          styles={{
            root: {
              borderRadius: 6,
              minHeight: 34
            },
            label: {
              fontSize: 12,
              fontWeight: activePage === item.page ? 700 : 500
            }
          }}
          leftSection={
            <ThemeIcon variant={activePage === item.page ? 'filled' : 'light'} radius="sm" size={24}>
              <item.icon size={16} />
            </ThemeIcon>
          }
        />
      ))}
    </Stack>
  );
}
