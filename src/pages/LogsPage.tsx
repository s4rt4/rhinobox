import { Badge, Button, Card, Group, Loader, ScrollArea, Stack, Tabs, Text, Title } from '@mantine/core';
import { IconFolder, IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { getLogs } from '../lib/logsApi';
import { openExternal } from '../lib/externalLinks';
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
        <Card withBorder radius="sm" style={{ minHeight: 'calc(100vh - 150px)' }}>
          <Tabs defaultValue={logsQuery.data?.[0]?.key} keepMounted={false}>
            <Tabs.List>
              {(logsQuery.data ?? []).map((target) => (
                <Tabs.Tab key={target.key} value={target.key}>
                  {target.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {(logsQuery.data ?? []).map((target) => (
              <Tabs.Panel key={target.key} value={target.key} pt="sm">
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                      <Title order={5}>{target.label}</Title>
                      <Text c="dimmed" size="xs" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        {target.path}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Badge variant="light" color={target.available ? 'green' : 'gray'}>
                        {target.available ? 'available' : 'missing'}
                      </Badge>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconFolder size={14} />}
                        disabled={!target.available}
                        onClick={() => void openExternal(target.path)}
                      >
                        Open file
                      </Button>
                    </Group>
                  </Group>

                  <ScrollArea h="calc(100vh - 340px)" offsetScrollbars scrollbarSize={8} type="auto">
                    <Text
                      component="pre"
                      size="xs"
                      ff="monospace"
                      style={{
                        background: '#111318',
                        color: '#d7dae0',
                        padding: 12,
                        borderRadius: 6,
                        minHeight: 'calc(100vh - 380px)',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {target.lines.length > 0 ? target.lines.join('\n') : 'No log lines yet.'}
                    </Text>
                  </ScrollArea>
                </Stack>
              </Tabs.Panel>
            ))}
          </Tabs>
        </Card>
      )}
    </Stack>
  );
}
