import { useMemo, useState } from 'react';
import { Badge, Button, Card, Group, Loader, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconExternalLink, IconFolder, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { openExternal } from '../lib/externalLinks';
import { createVirtualHost, listVirtualHosts, removeVirtualHost } from '../lib/vhostsApi';
import { useUiStore } from '../store/uiStore';

function defaultRoot(name: string) {
  const clean = projectSlug(name);
  return clean ? `C:\\www\\${clean}` : 'C:\\www\\myapp';
}

function projectSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\.(test|local)$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function VirtualHostsPage() {
  const activePage = useUiStore((state) => state.activePage);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [tld, setTld] = useState('test');
  const [customRoot, setCustomRoot] = useState('');

  const root = customRoot.trim() || defaultRoot(name);
  const previewDomain = useMemo(() => {
    const clean = projectSlug(name);
    return clean ? `${clean}.${tld}` : `myapp.${tld}`;
  }, [name, tld]);

  const vhostsQuery = useQuery({
    queryKey: ['virtual-hosts'],
    queryFn: listVirtualHosts,
    enabled: activePage === 'vhosts',
    refetchOnWindowFocus: false,
    staleTime: 30000,
    placeholderData: (previousData) => previousData
  });

  const createMutation = useMutation({
    mutationFn: createVirtualHost,
    onSuccess: (message) => {
      notifications.show({ color: 'green', title: 'Virtual domain ready', message });
      setName('');
      setCustomRoot('');
      void queryClient.invalidateQueries({ queryKey: ['virtual-hosts'] });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Virtual domain failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const removeMutation = useMutation({
    mutationFn: removeVirtualHost,
    onSuccess: (message) => {
      notifications.show({ color: 'green', title: 'Virtual domain removed', message });
      void queryClient.invalidateQueries({ queryKey: ['virtual-hosts'] });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Remove failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return (
    <Stack gap="sm">
      <Card withBorder radius="sm">
        <Group justify="space-between" align="center">
          <div>
            <Title order={4}>Virtual Domains</Title>
            <Text c="dimmed" size="xs">
              Buat domain lokal `.test` atau `.local` untuk project di `C:\www`.
            </Text>
          </div>
          <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => void vhostsQuery.refetch()} loading={vhostsQuery.isFetching}>
            Refresh
          </Button>
        </Group>
      </Card>

      <Card withBorder radius="sm">
        <Stack gap="sm">
          <Group grow align="flex-end">
            <TextInput
              size="xs"
              label="Project"
              placeholder="myapp"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              onBlur={() => setName((current) => projectSlug(current) || current)}
            />
            <Select
              size="xs"
              label="Domain"
              value={tld}
              onChange={(value) => setTld(value ?? 'test')}
              data={[
                { value: 'test', label: '.test' },
                { value: 'local', label: '.local' }
              ]}
            />
            <TextInput
              size="xs"
              label="Root"
              value={customRoot}
              placeholder={root}
              onChange={(event) => setCustomRoot(event.currentTarget.value)}
            />
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              loading={createMutation.isPending}
              onClick={() => {
                const cleanName = projectSlug(name);
                createMutation.mutate({ name: cleanName, tld, root: customRoot.trim() || defaultRoot(cleanName) });
              }}
              disabled={!projectSlug(name)}
            >
              Create
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Preview: <Text span ff="monospace">{previewDomain}</Text> {'->'} <Text span ff="monospace">{root}</Text>
          </Text>
        </Stack>
      </Card>

      <Card withBorder radius="sm">
        {vhostsQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Domain</Table.Th>
                <Table.Th>Root</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ width: 230 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(vhostsQuery.data ?? []).length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" size="sm">Belum ada virtual domain.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                (vhostsQuery.data ?? []).map((item) => (
                  <Table.Tr key={item.domain}>
                    <Table.Td>
                      <Text fw={700}>{item.domain}</Text>
                      <Text size="xs" c="dimmed" ff="monospace">{item.configPath}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace" style={{ overflowWrap: 'anywhere' }}>{item.root}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Badge color={item.configExists ? 'green' : 'red'} variant="light">
                          config
                        </Badge>
                        <Badge color={item.hostsEnabled ? 'green' : 'yellow'} variant="light">
                          hosts
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Button size="xs" variant="light" leftSection={<IconExternalLink size={14} />} onClick={() => void openExternal(`http://${item.domain}/`)}>
                          Open
                        </Button>
                        <Button size="xs" variant="light" leftSection={<IconFolder size={14} />} onClick={() => void openExternal(item.root)}>
                          Folder
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="filled"
                          leftSection={<IconTrash size={14} />}
                          loading={removeMutation.isPending && removeMutation.variables === item.domain}
                          onClick={() => removeMutation.mutate(item.domain)}
                        >
                          Remove
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
