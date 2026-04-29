import { Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconCopy, IconFileCode, IconFolder, IconMapSearch, IconRefresh } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import { getDiscovery } from '../lib/discoveryApi';
import { openExternal } from '../lib/externalLinks';
import { useUiStore } from '../store/uiStore';
import type { DiscoveryItem } from '../types';
import { EmptyState } from '../components/common/EmptyState';
import { TooltipAction } from '../components/common/TooltipAction';

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
  const globalSearch = useUiStore((state) => state.globalSearch);
  const openConfigTarget = useUiStore((state) => state.openConfigTarget);
  const discoveryQuery = useQuery({
    queryKey: ['discovery'],
    queryFn: getDiscovery,
    enabled: activePage === 'discovery',
    refetchOnWindowFocus: false,
    staleTime: 30000
  });

  const filtered = (discoveryQuery.data ?? []).filter((item) => {
    const term = globalSearch.trim().toLowerCase();
    if (!term) return true;
    return `${itemGroup(item.key)} ${item.label} ${item.value} ${item.source}`.toLowerCase().includes(term);
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
      <Card withBorder radius="sm" p="sm" className="surface-muted">
        <Group justify="space-between" align="center" wrap="nowrap">
          <div>
            <Title order={5}>Environment Paths</Title>
            <Text c="dimmed" size="xs">
              Jalur aktif yang sedang dipakai RhinoBOX{globalSearch.trim() ? ` - ${filtered.length} matched` : ''}.
            </Text>
          </div>
          <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => void discoveryQuery.refetch()} loading={discoveryQuery.isFetching}>
            Refresh
          </Button>
        </Group>
      </Card>

      {discoveryQuery.isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : discoveryQuery.isError ? (
        <EmptyState
          icon={<IconMapSearch size={28} color="#ff8787" />}
          title="Environment scan failed"
          message={discoveryQuery.error instanceof Error ? discoveryQuery.error.message : 'Failed to load discovery data.'}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconMapSearch size={28} color="#8b93a1" />}
          title="No paths matched"
          message="Coba kosongkan search atau refresh daftar environment path."
        />
      ) : (
        <Card withBorder radius="sm" p={0} className="surface-muted" style={{ overflow: 'hidden' }}>
          {filtered.map((item) => {
            const targetKey = configTargetKey(item.key);
            const canOpenFolder = !/^[\w.-]+:\d+$/.test(item.value);
            return (
              <div className="path-row" key={item.key}>
                <Stack gap={4} style={{ minWidth: 0 }}>
                  <Group gap={5} wrap="nowrap">
                    <Badge variant="light" color="gray" size="xs">{itemGroup(item.key)}</Badge>
                    <Badge variant="light" size="xs" color={sourceColor(item.source)}>{item.source}</Badge>
                  </Group>
                  <Text fw={700} size="sm" truncate="end">{item.label}</Text>
                </Stack>

                <Stack gap={4} style={{ minWidth: 0 }}>
                  <Text className="mono-truncate" size="xs" title={item.value}>
                    {item.value}
                  </Text>
                  <Badge variant="light" size="xs" color={item.available === false ? 'red' : 'green'} w="fit-content">
                    {item.available === false ? 'missing' : 'available'}
                  </Badge>
                </Stack>

                <Group gap={6} wrap="nowrap" justify="flex-end">
                  <TooltipAction
                    label="Open folder"
                    icon={<IconFolder size={16} />}
                    disabled={!canOpenFolder}
                    onClick={() => void openExternal(folderTarget(item.value))}
                  />
                  <TooltipAction
                    label="Copy path"
                    icon={<IconCopy size={16} />}
                    onClick={() => void copyPath(item.value)}
                  />
                  {isConfigKey(item.key) && targetKey ? (
                    <TooltipAction
                      label="Open config"
                      icon={<IconFileCode size={16} />}
                      onClick={() => openConfigTarget(targetKey)}
                    />
                  ) : null}
                </Group>
              </div>
            );
          })}
        </Card>
      )}
    </Stack>
  );
}
