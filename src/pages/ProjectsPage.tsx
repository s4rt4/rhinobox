import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Loader, Select, Stack, Table, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBrandVisualStudio, IconExternalLink, IconFolder, IconRefresh, IconSearch, IconTerminal2, IconWorldWww } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { listProjects } from '../lib/projectsApi';
import { openExternal, openInCode, openInTerminal } from '../lib/externalLinks';
import { useUiStore } from '../store/uiStore';

function projectColor(kind: string) {
  switch (kind.toLowerCase()) {
    case 'laravel':
      return 'red';
    case 'wordpress':
      return 'blue';
    case 'node.js':
      return 'green';
    case 'go':
      return 'cyan';
    case 'python':
      return 'yellow';
    default:
      return 'gray';
  }
}

export function ProjectsPage() {
  const activePage = useUiStore((state) => state.activePage);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
    enabled: activePage === 'projects',
    refetchOnWindowFocus: false,
    staleTime: 30000,
    placeholderData: (previousData) => previousData
  });

  const projects = projectsQuery.data ?? [];
  const kinds = useMemo(() => {
    return Array.from(new Set(projects.map((project) => project.kind))).sort((a, b) => a.localeCompare(b));
  }, [projects]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesKind = !kind || project.kind === kind;
      const haystack = `${project.name} ${project.path} ${project.domain ?? ''} ${project.kind}`.toLowerCase();
      return matchesKind && (!needle || haystack.includes(needle));
    });
  }, [kind, projects, search]);

  async function runAction(action: () => Promise<void>, label: string) {
    try {
      await action();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: `${label} failed`,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return (
    <Stack gap="xs">
      <Card withBorder radius="sm" p="sm">
        <Group justify="space-between" align="center">
          <div>
            <Title order={5}>Projects</Title>
            <Text c="dimmed" size="xs">
              Folder project di C:\www dengan quick action harian.
            </Text>
          </div>
          <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => void projectsQuery.refetch()} loading={projectsQuery.isFetching}>
            Refresh
          </Button>
        </Group>
      </Card>

      <Card withBorder radius="sm" p="sm">
        <Group grow align="flex-end">
          <TextInput
            size="xs"
            label="Search"
            placeholder="Project, domain, path"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            leftSection={<IconSearch size={14} />}
          />
          <Select
            size="xs"
            label="Type"
            placeholder="All types"
            clearable
            value={kind}
            onChange={setKind}
            data={kinds.map((item) => ({ value: item, label: item }))}
          />
        </Group>
      </Card>

      <Card withBorder radius="sm" p={0} style={{ overflow: 'hidden' }}>
        {projectsQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : filtered.length === 0 ? (
          <Stack gap={6} p="md">
            <Text fw={700} size="sm">Belum ada project yang terbaca.</Text>
            <Text c="dimmed" size="xs">
              Buat folder project di C:\www atau buat virtual domain baru dari menu Domains.
            </Text>
          </Stack>
        ) : (
          <Table verticalSpacing={7} highlightOnHover style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 230 }} />
              <col />
              <col style={{ width: 170 }} />
              <col style={{ width: 178 }} />
            </colgroup>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Project</Table.Th>
                <Table.Th>Path</Table.Th>
                <Table.Th>URL</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((project) => (
                <Table.Tr key={project.path}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <IconWorldWww size={18} />
                      <Stack gap={3} style={{ minWidth: 0 }}>
                        <Text fw={700} size="sm" truncate="end">{project.name}</Text>
                        <Group gap={4}>
                          <Badge size="xs" variant="light" color={projectColor(project.kind)}>
                            {project.kind}
                          </Badge>
                          {project.hasVhost ? (
                            <Badge size="xs" variant="light" color="green">domain</Badge>
                          ) : null}
                          {project.hasPublicDir ? (
                            <Badge size="xs" variant="light" color="blue">public</Badge>
                          ) : null}
                        </Group>
                      </Stack>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace" truncate="end" title={project.path}>
                      {project.path}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace" truncate="end" title={project.url}>
                      {project.domain ?? project.url.replace(/^https?:\/\//, '')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Tooltip label="Open in browser" withArrow>
                        <ActionIcon size="lg" variant="light" aria-label="Open in browser" onClick={() => void runAction(() => openExternal(project.url), 'Open browser')}>
                          <IconExternalLink size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Open in VS Code" withArrow>
                        <ActionIcon size="lg" variant="light" aria-label="Open in VS Code" onClick={() => void runAction(() => openInCode(project.path), 'Open VS Code')}>
                          <IconBrandVisualStudio size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Open terminal" withArrow>
                        <ActionIcon size="lg" variant="light" aria-label="Open terminal" onClick={() => void runAction(() => openInTerminal(project.path), 'Open terminal')}>
                          <IconTerminal2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Open folder" withArrow>
                        <ActionIcon size="lg" variant="light" aria-label="Open folder" onClick={() => void runAction(() => openExternal(project.path), 'Open folder')}>
                          <IconFolder size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
