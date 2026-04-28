import { Badge, Button, Card, Group, Loader, ScrollArea, Stack, Table, Text, Title } from '@mantine/core';
import { IconCopy, IconFileCode, IconFolder, IconRefresh } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import { getDiscovery } from '../lib/discoveryApi';
import { openExternal } from '../lib/externalLinks';
import { useUiStore } from '../store/uiStore';
import type { DiscoveryItem } from '../types';

function sourceColor(source: DiscoveryItem['source']) {
  switch (source) {
    case 'detected':
      return 'green';
    case 'manual':
      return 'yellow';
    case 'selected':
      return 'cyan';
    default:
      return 'blue';
  }
}

function isConfigKey(key: string) {
  return ['php_ini', 'mariadb_conf', 'postgresql_conf', 'postgresql_hba'].includes(key);
}

function itemGroup(key: string) {
  if (key.includes('nginx') || key.includes('php') || key === 'web_root' || key === 'workspace') return 'Web';
  if (key.includes('mariadb') || key.includes('postgresql')) return 'Database';
  if (key.includes('node') || key.includes('redis') || key.includes('mailpit') || key.includes('pgweb') || key.includes('memcached')) return 'Tools';
  if (key.includes('vhosts')) return 'Virtual host';
  return 'Other';
}

function configTargetKey(key: string) {
  switch (key) {
    case 'php_ini':
      return 'php';
    case 'mariadb_conf':
      return 'mariadb';
    case 'postgresql_conf':
      return 'postgresql';
    case 'postgresql_hba':
      return 'postgresql_hba';
    default:
      return null;
  }
}

function folderTarget(value: string) {
  if (/^[\w.-]+:\d+$/.test(value)) {
    return value;
  }

  const normalized = value.replace(/\//g, '\\');
  if (/\.([a-z0-9]+)$/i.test(normalized)) {
    const lastSlash = normalized.lastIndexOf('\\');
    return lastSlash > 2 ? normalized.slice(0, lastSlash) : normalized;
  }
  return normalized;
}

export function DiscoveryPage() {
  const activePage = useUiStore((state) => state.activePage);
  const openConfigTarget = useUiStore((state) => state.openConfigTarget);
  const discoveryQuery = useQuery({
    queryKey: ['discovery'],
    queryFn: getDiscovery,
    enabled: activePage === 'discovery',
    refetchOnWindowFocus: false,
    staleTime: 30000
  });

  async function copyPath(value: string) {
    await navigator.clipboard.writeText(value);
    notifications.show({
      color: 'blue',
      title: 'Path copied',
      message: value
    });
  }

  return (
    <Stack gap="xs">
      <Card withBorder radius="sm" p="sm">
        <Group justify="space-between" align="center">
          <div>
            <Title order={5}>Environment Paths</Title>
            <Text c="dimmed" size="xs">
              Jalur aktif yang sedang dipakai RhinoBOX.
            </Text>
          </div>
          <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => void discoveryQuery.refetch()} loading={discoveryQuery.isFetching}>
            Refresh paths
          </Button>
        </Group>
      </Card>

      {discoveryQuery.isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : discoveryQuery.isError ? (
        <Text c="red" size="sm">
          {discoveryQuery.error instanceof Error ? discoveryQuery.error.message : 'Failed to load discovery data.'}
        </Text>
      ) : (
        <Card withBorder radius="sm" p={0} style={{ overflow: 'hidden' }}>
          <ScrollArea type="auto" scrollbarSize={8} h="calc(100vh - 160px)">
            <Table verticalSpacing={7} highlightOnHover style={{ minWidth: 860, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 110 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 390 }} />
                <col style={{ width: 150 }} />
              </colgroup>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Group</Table.Th>
                  <Table.Th>Target</Table.Th>
                  <Table.Th>Path / Value</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
          {(discoveryQuery.data ?? []).map((item) => {
            const targetKey = configTargetKey(item.key);
            const canOpenFolder = !/^[\w.-]+:\d+$/.test(item.value);
            return (
              <Table.Tr key={item.key}>
                <Table.Td>
                  <Badge variant="light" color="gray" size="xs">{itemGroup(item.key)}</Badge>
                </Table.Td>
                <Table.Td>
                  <Stack gap={3}>
                    <Text fw={700} size="sm" truncate="end">{item.label}</Text>
                    <Group gap={4}>
                      <Badge variant="light" size="xs" color={sourceColor(item.source)}>{item.source}</Badge>
                      <Badge variant="light" size="xs" color={item.available === false ? 'red' : 'green'}>
                        {item.available === false ? 'missing' : 'available'}
                      </Badge>
                    </Group>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" ff="monospace" truncate="end" title={item.value}>
                    {item.value}
                  </Text>
                </Table.Td>
                <Table.Td>
                    <Group gap={6} wrap="nowrap" align="center">
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconFolder size={14} />}
                        disabled={!canOpenFolder}
                        onClick={() => void openExternal(folderTarget(item.value))}
                      >
                        Open folder
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconCopy size={14} />}
                        onClick={() => void copyPath(item.value)}
                      >
                        Copy path
                      </Button>
                      {isConfigKey(item.key) && targetKey ? (
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconFileCode size={14} />}
                          onClick={() => openConfigTarget(targetKey)}
                        >
                          Open config
                        </Button>
                      ) : null}
                    </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </Stack>
  );
}
