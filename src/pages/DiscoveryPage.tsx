import { Badge, Button, Card, Group, Loader, ScrollArea, Stack, Table, Text, Title } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { getDiscovery } from '../lib/discoveryApi';
import { useUiStore } from '../store/uiStore';
import type { DiscoveryItem } from '../types';

function sourceColor(source: DiscoveryItem['source']) {
  switch (source) {
    case 'detected':
      return 'green';
    case 'manual':
      return 'yellow';
    default:
      return 'blue';
  }
}

export function DiscoveryPage() {
  const activePage = useUiStore((state) => state.activePage);
  const discoveryQuery = useQuery({
    queryKey: ['discovery'],
    queryFn: getDiscovery,
    enabled: activePage === 'discovery',
    refetchOnWindowFocus: false,
    staleTime: 30000
  });

  return (
    <Card withBorder radius="sm">
      <Stack gap="sm">
        <Group justify="space-between">
          <div>
            <Title order={4}>Discovery</Title>
            <Text c="dimmed" size="xs">
              Daftar path dan identifier environment yang saat ini sudah dibaca RhinoBOX dari setup lokal kamu.
            </Text>
          </div>
          <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => void discoveryQuery.refetch()} loading={discoveryQuery.isFetching}>
            Refresh paths
          </Button>
        </Group>

        {discoveryQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : discoveryQuery.isError ? (
          <Text c="red" size="sm">
            {discoveryQuery.error instanceof Error ? discoveryQuery.error.message : 'Failed to load discovery data.'}
          </Text>
        ) : (
          <ScrollArea h="calc(100vh - 210px)" offsetScrollbars scrollbarSize={8}>
            <Table highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={180}>Target</Table.Th>
                  <Table.Th miw={420}>Path / Value</Table.Th>
                  <Table.Th w={110}>Source</Table.Th>
                  <Table.Th w={110}>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(discoveryQuery.data ?? []).map((item) => (
                  <Table.Tr key={item.key}>
                    <Table.Td>{item.label}</Table.Td>
                    <Table.Td>
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
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={sourceColor(item.source)}>
                        {item.source}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={item.available === false ? 'red' : 'green'}>
                        {item.available === false ? 'missing' : 'available'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Stack>
    </Card>
  );
}
