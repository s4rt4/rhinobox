import type { ReactNode } from 'react';
import { Group, Text } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconCpu, IconDeviceSdCard, IconServer } from '@tabler/icons-react';
import type { SystemMetrics } from '../../types';

interface AppFooterProps {
  metrics?: SystemMetrics;
  loading?: boolean;
}

function formatGb(used: number | null | undefined, total: number | null | undefined) {
  if (used == null || total == null) return '--';
  return `${used.toFixed(1)}/${total.toFixed(1)} GB`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '--';
  return `${value.toFixed(0)}%`;
}

function formatSpeed(value: number | null | undefined) {
  if (value == null) return '--';
  if (value >= 1024) return `${(value / 1024).toFixed(2)} MB/s`;
  return `${value.toFixed(0)} KB/s`;
}

function Item({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Group gap={6} wrap="nowrap">
      {icon}
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="xs" fw={600}>
        {value}
      </Text>
    </Group>
  );
}

export function AppFooter({ metrics, loading }: AppFooterProps) {
  const initialLoading = loading && !metrics;

  return (
    <Group justify="space-between" h="100%" px="sm" wrap="nowrap">
      <Group gap="md" wrap="nowrap">
        <Item icon={<IconCpu size={14} />} label="CPU" value={initialLoading ? '...' : formatPercent(metrics?.cpuPercent)} />
        <Item icon={<IconServer size={14} />} label="RAM" value={initialLoading ? '...' : formatGb(metrics?.memoryUsedGb, metrics?.memoryTotalGb)} />
        <Item icon={<IconDeviceSdCard size={14} />} label="Disk" value={initialLoading ? '...' : formatGb(metrics?.diskUsedGb, metrics?.diskTotalGb)} />
      </Group>
      <Group gap="md" wrap="nowrap">
        <Item icon={<IconArrowDown size={14} />} label="Down" value={initialLoading ? '...' : formatSpeed(metrics?.downloadKbps)} />
        <Item icon={<IconArrowUp size={14} />} label="Up" value={initialLoading ? '...' : formatSpeed(metrics?.uploadKbps)} />
      </Group>
    </Group>
  );
}
