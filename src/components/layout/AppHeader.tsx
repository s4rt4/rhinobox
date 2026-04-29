import { ActionIcon, Badge, Group, Text, TextInput, Tooltip } from '@mantine/core';
import { IconPower, IconRefresh, IconSearch } from '@tabler/icons-react';

const logoUrl = new URL('../../../assets/branding/rhinobox.png', import.meta.url).href;

interface AppHeaderProps {
  summaryText: string;
  refreshing: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onTerminate: () => void;
}

export function AppHeader({ summaryText, refreshing, search, onSearchChange, onRefresh, onTerminate }: AppHeaderProps) {
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
      <Group gap="xs" wrap="nowrap">
        <TextInput
          size="xs"
          leftSection={<IconSearch size={14} />}
          placeholder="Search"
          aria-label="Global search"
          value={search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          w={150}
          styles={{ input: { background: '#1f2126', borderColor: '#343943' } }}
        />
        <Badge size="sm" color="lime" variant="light" className="status-pill">
          {summaryText}
        </Badge>
        <Tooltip label="Refresh service status" withArrow openDelay={350}>
          <ActionIcon variant="light" size="sm" aria-label="Refresh service status" onClick={onRefresh} loading={refreshing}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Terminate RhinoBOX" withArrow openDelay={350}>
          <ActionIcon variant="light" color="red" size="sm" aria-label="Terminate RhinoBOX" onClick={onTerminate}>
            <IconPower size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}
