import { ActionIcon, Badge, Group, Text, Title } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

interface AppHeaderProps {
  summaryText: string;
  refreshing: boolean;
  onRefresh: () => void;
}

export function AppHeader({ summaryText, refreshing, onRefresh }: AppHeaderProps) {
  return (
    <Group justify="space-between" h="100%" px="sm">
      <Group gap="sm" wrap="nowrap">
        <img
          src="/assets/branding/rhinobox.svg"
          alt="RhinoBOX"
          style={{ width: 28, height: 28, display: 'block' }}
        />
        <div>
          <Title order={3}>RhinoBOX</Title>
          <Text c="dimmed" size="xs">
            Local environment controller
          </Text>
        </div>
      </Group>
      <Group gap="xs">
        <Badge size="md" color="lime" variant="light">
          {summaryText}
        </Badge>
        <ActionIcon variant="light" size="md" aria-label="Refresh" onClick={onRefresh} loading={refreshing}>
          <IconRefresh size={16} />
        </ActionIcon>
      </Group>
    </Group>
  );
}
