import { useMemo, useState } from 'react';
import { Badge, Button, Card, Group, Loader, ScrollArea, Stack, Tabs, Text, TextInput, Title } from '@mantine/core';
import { IconCopy, IconFileText, IconFolder, IconRefresh, IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import { getLogs } from '../lib/logsApi';
import { openExternal } from '../lib/externalLinks';
import { useUiStore } from '../store/uiStore';
import { EmptyState } from '../components/common/EmptyState';

export function LogsPage() {
  const activePage = useUiStore((state) => state.activePage);
  const globalSearch = useUiStore((state) => state.globalSearch);
  const [localSearch, setLocalSearch] = useState('');
  const logsQuery = useQuery({
    queryKey: ['logs'],
    queryFn: getLogs,
    enabled: activePage === 'logs',
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    placeholderData: (previousData) => previousData
  });

  const term = `${globalSearch} ${localSearch}`.trim().toLowerCase();
  const filteredTargets = useMemo(() => {
    const targets = logsQuery.data ?? [];
    if (!term) return targets;
    return targets
      .map((target) => ({
        ...target,
        lines: target.lines.filter((line) => line.toLowerCase().includes(term))
      }))
      .filter((target) => `${target.label} ${target.path}`.toLowerCase().includes(term) || target.lines.length > 0);
  }, [logsQuery.data, term]);

  async function copyLines(lines: string[]) {
    await navigator.clipboard.writeText(lines.join('\n'));
    notifications.show({ color: 'blue', title: 'Log copied', message: 'Visible log lines copied.' });
  }

  return (
    <Stack gap="xs">
      <Card withBorder radius="sm" p="sm" className="surface-muted">
        <Group justify="space-between" align="center" wrap="nowrap">
          <div>
            <Title order={5}>Logs</Title>
            <Text c="dimmed" size="xs">
              Tail log utama untuk diagnosa cepat{term ? ` - ${filteredTargets.length} matched` : ''}.
            </Text>
          </div>
          <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => void logsQuery.refetch()} loading={logsQuery.isFetching}>
            Refresh
          </Button>
        </Group>
      </Card>

      <TextInput
        size="xs"
        placeholder="Filter visible log lines"
        value={localSearch}
        onChange={(event) => setLocalSearch(event.currentTarget.value)}
        leftSection={<IconSearch size={14} />}
      />

      {logsQuery.isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : logsQuery.isError ? (
        <EmptyState
          icon={<IconFileText size={28} color="#ff8787" />}
          title="Logs failed to load"
          message={logsQuery.error instanceof Error ? logsQuery.error.message : 'Failed to load logs.'}
        />
      ) : filteredTargets.length === 0 ? (
        <EmptyState
          icon={<IconFileText size={28} color="#8b93a1" />}
          title="No logs matched"
          message="Coba kosongkan search atau refresh log."
        />
      ) : (
        <Card withBorder radius="sm" p="sm" className="surface-muted">
          <Tabs defaultValue={filteredTargets[0]?.key} keepMounted={false}>
            <Tabs.List grow>
              {filteredTargets.map((target) => (
                <Tabs.Tab
                  key={target.key}
                  value={target.key}
                  rightSection={
                    <Badge size="xs" variant="light" color={target.available ? 'green' : 'gray'}>
                      {target.lines.length}
                    </Badge>
                  }
                >
                  {target.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {filteredTargets.map((target) => (
              <Tabs.Panel key={target.key} value={target.key} pt="sm">
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Title order={5}>{target.label}</Title>
                      <Text c="dimmed" size="xs" className="mono-truncate" title={target.path}>
                        {target.path}
                      </Text>
                    </div>
                    <Group gap="xs" wrap="nowrap">
                      <Badge variant="light" color={target.available ? 'green' : 'gray'} className="status-pill">
                        {target.available ? 'available' : 'missing'}
                      </Badge>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconCopy size={14} />}
                        disabled={target.lines.length === 0}
                        onClick={() => void copyLines(target.lines)}
                      >
                        Copy
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconFolder size={14} />}
                        disabled={!target.available}
                        onClick={() => void openExternal(target.path)}
                      >
                        Open
                      </Button>
                    </Group>
                  </Group>

                  <ScrollArea h="calc(100vh - 270px)" offsetScrollbars scrollbarSize={5} type="auto">
                    <Text
                      component="pre"
                      size="xs"
                      ff="monospace"
                      style={{
                        background: '#111318',
                        color: '#d7dae0',
                        padding: 12,
                        borderRadius: 6,
                        minHeight: 'calc(100vh - 316px)',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {target.lines.length > 0 ? target.lines.join('\n') : 'No log lines matched.'}
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
