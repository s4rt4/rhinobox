import { Badge, Button, Card, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { getLogs } from '../lib/logsApi';
import { useUiStore } from '../store/uiStore';

export function LogsPage() {
  const activePage = useUiStore((state) => state.activePage);
  const logsQuery = useQuery({
    queryKey: ['logs'],
    queryFn: getLogs,
    enabled: activePage === 'logs',
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
    staleTime: 10000
  });

  return (
    <Stack gap="sm">
      <Card withBorder radius="sm">
        <Group justify="space-between">
          <div>
            <Title order={4}>Logs</Title>
            <Text c="dimmed" size="xs">
              Tail log targets utama untuk diagnosa cepat tanpa harus buka file manual.
            </Text>
          </div>
          <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => void logsQuery.refetch()} loading={logsQuery.isFetching}>
            Refresh logs
          </Button>
        </Group>
      </Card>

      {logsQuery.isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : (
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="sm" verticalSpacing="sm">
          {(logsQuery.data ?? []).map((target) => (
            <Card key={target.key} withBorder radius="sm">
              <Stack gap="sm">
                <Group justify="space-between">
                  <div>
                    <Title order={5}>{target.label}</Title>
                    <Text c="dimmed" size="xs" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {target.path}
                    </Text>
                  </div>
                  <Badge variant="light" color={target.available ? 'green' : 'gray'}>
                    {target.available ? 'available' : 'missing'}
                  </Badge>
                </Group>
                <Text
                  component="pre"
                  size="xs"
                  ff="monospace"
                  style={{
                    background: '#111318',
                    color: '#d7dae0',
                    padding: 12,
                    borderRadius: 6,
                    minHeight: 220,
                    maxHeight: 220,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {target.lines.length > 0 ? target.lines.join('\n') : 'No log lines yet.'}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
