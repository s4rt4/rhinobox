import { Paper, Progress, RingProgress, SimpleGrid, Text, ThemeIcon, Title, Group } from '@mantine/core';
import { IconActivityHeartbeat, IconFolderSearch, IconPlugConnected } from '@tabler/icons-react';

interface OverviewCardsProps {
  running: number;
  total: number;
  ports: number;
  discovered: number;
  mode: 'browser' | 'tauri';
}

export function OverviewCards({ running, total, ports, discovered, mode }: OverviewCardsProps) {
  const runningRatio = total > 0 ? Math.round((running / total) * 100) : 0;

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" verticalSpacing="sm">
      <Paper withBorder radius="sm" p="sm">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="dimmed" size="xs">
              Active Services
            </Text>
            <Title order={3}>{running}</Title>
          </div>
          <ThemeIcon variant="light" radius="sm" size={34}>
            <IconPlugConnected size={18} />
          </ThemeIcon>
        </Group>
        <Progress mt="sm" value={runningRatio} color="lime" radius="xl" />
      </Paper>

      <Paper withBorder radius="sm" p="sm">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="dimmed" size="xs">
              Open Ports
            </Text>
            <Title order={3}>{ports}</Title>
          </div>
          <ThemeIcon variant="light" radius="sm" size={34}>
            <IconActivityHeartbeat size={18} />
          </ThemeIcon>
        </Group>
        <Text c="dimmed" size="xs" mt="sm">
          Port aktif layanan lokal.
        </Text>
      </Paper>

      <Paper withBorder radius="sm" p="sm">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="dimmed" size="xs">
              Runtime Mode
            </Text>
            <Title order={3}>{mode === 'tauri' ? 'Desktop' : 'Browser'}</Title>
          </div>
          <RingProgress size={44} thickness={5} sections={[{ value: mode === 'tauri' ? 100 : 70, color: mode === 'tauri' ? 'lime' : 'blue' }]} />
        </Group>
        <Text c="dimmed" size="xs" mt="sm">
          Runtime aktif saat ini.
        </Text>
      </Paper>

      <Paper withBorder radius="sm" p="sm">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="dimmed" size="xs">
              Discovered Paths
            </Text>
            <Title order={3}>{discovered}</Title>
          </div>
          <ThemeIcon variant="light" radius="sm" size={34}>
            <IconFolderSearch size={18} />
          </ThemeIcon>
        </Group>
        <Text c="dimmed" size="xs" mt="sm">
          Path environment terdeteksi.
        </Text>
      </Paper>
    </SimpleGrid>
  );
}
