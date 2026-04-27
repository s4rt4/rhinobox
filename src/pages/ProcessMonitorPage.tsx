import { useMemo, useState } from 'react';
import { Button, Card, Group, Loader, ScrollArea, SegmentedControl, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProcessMetrics, killProcess } from '../lib/monitorApi';
import { useUiStore } from '../store/uiStore';
import type { ProcessMetric } from '../types';

export function ProcessMonitorPage() {
  const activePage = useUiStore((state) => state.activePage);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'light' | 'detailed'>('light');
  const isDetailed = mode === 'detailed';

  const monitorQuery = useQuery({
    queryKey: ['process-metrics', mode],
    queryFn: () => getProcessMetrics(isDetailed),
    enabled: activePage === 'monitor',
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    placeholderData: (previousData) => previousData
  });

  const killMutation = useMutation({
    mutationFn: killProcess,
    onSuccess: (message) => {
      notifications.show({ color: 'green', title: 'Process killed', message });
      void queryClient.invalidateQueries({ queryKey: ['process-metrics'] });
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Kill failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const filtered = useMemo(() => {
    const items = monitorQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const haystacks = [item.label, item.pid?.toString() ?? '', item.port?.toString() ?? ''];
      if (isDetailed) {
        haystacks.push(item.path ?? '');
      }
      return haystacks.some((value) => value.toLowerCase().includes(term));
    });
  }, [isDetailed, monitorQuery.data, search]);

  return (
    <Card withBorder radius="sm">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={4}>Process Monitor</Title>
            <Text c="dimmed" size="xs">
              Semua proses Windows yang sedang jalan, lengkap dengan aksi kill.
            </Text>
          </div>
          <Group gap="xs">
            <SegmentedControl
              size="xs"
              value={mode}
              onChange={(value) => setMode(value as 'light' | 'detailed')}
              data={[
                { label: 'Light', value: 'light' },
                { label: 'Detailed', value: 'detailed' }
              ]}
            />
            <Text size="xs" c="dimmed">
              {filtered.length}/{monitorQuery.data?.length ?? 0} proses
            </Text>
            <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => void monitorQuery.refetch()} loading={monitorQuery.isRefetching}>
              Refresh
            </Button>
          </Group>
        </Group>

        <TextInput
          size="xs"
          placeholder="Cari nama proses, PID, port, atau path"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          leftSection={<IconSearch size={14} />}
        />

        {monitorQuery.isPending && !monitorQuery.data ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : monitorQuery.isError ? (
          <Text c="red" size="sm">
            {monitorQuery.error instanceof Error ? monitorQuery.error.message : 'Failed to load process monitor.'}
          </Text>
        ) : filtered.length === 0 ? (
          <Text c="dimmed" size="sm">
            Tidak ada proses yang cocok.
          </Text>
        ) : (
          <ScrollArea h="calc(100vh - 250px)" offsetScrollbars scrollbarSize={8}>
            <Table highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={180}>Process</Table.Th>
                  <Table.Th w={90}>PID</Table.Th>
                  <Table.Th w={90}>Memory</Table.Th>
                  {isDetailed ? <Table.Th w={80}>Port</Table.Th> : null}
                  {isDetailed ? <Table.Th w={80}>CPU</Table.Th> : null}
                  {isDetailed ? <Table.Th miw={260}>Path</Table.Th> : null}
                  <Table.Th w={140} ta="center">Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((metric) => {
                  const busy = killMutation.isPending && killMutation.variables === (metric.pid ?? undefined);
                  return (
                    <Table.Tr key={metric.key}>
                      <Table.Td>
                        <Text fw={600} size="sm">
                          {metric.label}
                        </Text>
                      </Table.Td>
                      <Table.Td>{metric.pid ?? '-'}</Table.Td>
                      <Table.Td>{typeof metric.memoryMb === 'number' ? `${metric.memoryMb.toFixed(1)} MB` : '-'}</Table.Td>
                      {isDetailed ? <Table.Td>{metric.port ?? '-'}</Table.Td> : null}
                      {isDetailed ? <Table.Td>{typeof metric.cpuSeconds === 'number' ? `${metric.cpuSeconds.toFixed(1)} s` : '-'}</Table.Td> : null}
                      {isDetailed ? (
                        <Table.Td>
                          <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                            {metric.path ?? '-'}
                          </Text>
                        </Table.Td>
                      ) : null}
                      <Table.Td>
                        <Group justify="center" wrap="nowrap">
                          <Button
                            size="xs"
                            color="red"
                            variant="filled"
                            leftSection={<IconX size={12} />}
                            disabled={!metric.canKill || metric.pid === null}
                            loading={busy}
                            onClick={() => {
                              if (metric.pid === null) return;
                              killMutation.mutate(metric.pid);
                            }}
                          >
                            Kill
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Stack>
    </Card>
  );
}
