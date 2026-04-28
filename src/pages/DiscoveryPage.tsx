import { Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core';
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
    <Stack gap="sm">
      <Card withBorder radius="sm">
        <Group justify="space-between" align="center">
          <div>
            <Title order={4}>Environment Paths</Title>
            <Text c="dimmed" size="xs">
              Halaman support/debug untuk melihat jalur aktif yang benar-benar dipakai RhinoBOX.
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
        <Stack gap="sm">
          {(discoveryQuery.data ?? []).map((item) => {
            const targetKey = configTargetKey(item.key);
            const canOpenFolder = !/^[\w.-]+:\d+$/.test(item.value);
            return (
              <Card key={item.key} withBorder radius="sm">
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Group gap="xs" mb={6}>
                        <Text fw={700}>{item.label}</Text>
                        <Badge variant="light" color={sourceColor(item.source)}>
                          {item.source}
                        </Badge>
                        <Badge variant="light" color={item.available === false ? 'red' : 'green'}>
                          {item.available === false ? 'missing' : 'available'}
                        </Badge>
                      </Group>
                      <Text
                        size="sm"
                        ff="monospace"
                        style={{
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word'
                        }}
                      >
                        {item.value}
                      </Text>
                    </div>
                    <Group gap="xs" wrap="nowrap" align="center">
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
                  </Group>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
