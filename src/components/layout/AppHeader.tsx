import { ActionIcon, Badge, Group, Text } from '@mantine/core';
import { IconPower, IconRefresh } from '@tabler/icons-react';

const logoUrl = new URL('../../../assets/branding/rhinobox.png', import.meta.url).href;

interface AppHeaderProps {
  summaryText: string;
  refreshing: boolean;
  onRefresh: () => void;
  onTerminate: () => void;
}

export function AppHeader({ summaryText, refreshing, onRefresh, onTerminate }: AppHeaderProps) {
  return (
    <Group justify="space-between" h="100%" px="xs">
      <Group gap="xs" wrap="nowrap">
        <img
          src={logoUrl}
          alt="RhinoBOX"
          style={{ width: 26, height: 26, display: 'block' }}
        />
        <Text fw={800} size="lg" lh={1}>RhinoBOX</Text>
      </Group>
      <Group gap="xs">
        <Badge size="sm" color="lime" variant="light">
          {summaryText}
        </Badge>
        <ActionIcon variant="light" size="sm" aria-label="Refresh" onClick={onRefresh} loading={refreshing}>
          <IconRefresh size={16} />
        </ActionIcon>
        <ActionIcon variant="light" color="red" size="sm" aria-label="Terminate RhinoBOX" onClick={onTerminate}>
          <IconPower size={16} />
        </ActionIcon>
      </Group>
    </Group>
  );
}
