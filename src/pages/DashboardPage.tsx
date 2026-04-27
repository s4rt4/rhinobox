import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Group, Select, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconBrandGit, IconDatabase, IconFolder, IconRefresh, IconTerminal2, IconTool, IconWorldWww } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { controlService, getServices, setServiceVersion } from '../lib/servicesApi';
import { openExternal, openGitBash, openInTerminal } from '../lib/externalLinks';
import { useUiStore } from '../store/uiStore';
import type { ManagedService } from '../types';

function statusColor(status: ManagedService['status']) {
  if (status === 'running') return 'green';
  if (status === 'stopped') return 'red';
  return 'yellow';
}

function serviceIcon(key: string) {
  switch (key) {
    case 'nginx':
      return <IconWorldWww size={18} />;
    case 'mariadb':
      return <IconDatabase size={18} />;
    case 'postgresql':
      return <IconDatabase size={18} />;
    case 'git':
      return <IconBrandGit size={18} />;
    case 'localhost':
      return <IconWorldWww size={18} />;
    case 'phpmyadmin':
      return <IconDatabase size={18} />;
    default:
      return <IconTool size={18} />;
  }
}

function parentFolder(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return null;
  const normalized = path.replace(/\//g, '\\');
  const lastSlash = normalized.lastIndexOf('\\');
  if (lastSlash <= 2) return normalized;
  return normalized.slice(0, lastSlash);
}

export function DashboardPage() {
  const activePage = useUiStore((state) => state.activePage);
  const queryClient = useQueryClient();
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({});

  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: getServices,
    enabled: activePage === 'dashboard',
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 15000,
    placeholderData: (previousData) => previousData
  });

  const mutation = useMutation({
    mutationFn: controlService,
    onSuccess: (message) => {
      notifications.show({ color: 'green', title: 'Action complete', message });
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      void queryClient.invalidateQueries({ queryKey: ['process-metrics'] });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Action failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const versionMutation = useMutation({
    mutationFn: ({ key, version }: { key: string; version: string }) => setServiceVersion(key, version),
    onSuccess: (message) => {
      notifications.show({ color: 'blue', title: 'Version selected', message });
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Version switch failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const services = servicesQuery.data ?? [];
  const visibleServices = useMemo(
    () => services.filter((service) => !['localhost', 'phpmyadmin'].includes(service.key)),
    [services]
  );
  const running = visibleServices.filter((item) => item.status === 'running').length;

  useEffect(() => {
    if (visibleServices.length === 0) return;
    setSelectedVersions((current) => {
      const next = { ...current };
      for (const service of visibleServices) {
        if (!next[service.key]) {
          next[service.key] = service.currentVersion ?? service.versions?.[0] ?? '';
        }
      }
      return next;
    });
  }, [visibleServices]);

  const cards = useMemo(() => {
    return visibleServices.map((service) => {
      const selectedVersion = selectedVersions[service.key] ?? service.currentVersion ?? service.versions?.[0] ?? '';
      const hasVersionDropdown = (service.versions?.length ?? 0) > 0;
      const canControl = service.kind === 'process' || service.kind === 'windows-service';
      const canOpen = service.kind === 'app' || service.kind === 'runtime';
      const isRuntime = service.kind === 'runtime';
      const isGit = service.key === 'git';
      const folderTarget = parentFolder(service.launchTarget);
      return {
        ...service,
        selectedVersion,
        hasVersionDropdown,
        canControl,
        canOpen,
        isRuntime,
        isGit,
        folderTarget
      };
    });
  }, [selectedVersions, visibleServices]);

  async function runBulkAction(action: 'start' | 'stop' | 'restart') {
    const targets =
      action === 'start'
        ? services.filter((item) => item.status !== 'running')
        : action === 'stop'
          ? services.filter((item) => item.status === 'running')
          : services;

    if (targets.length === 0) {
      notifications.show({
        color: 'gray',
        title: 'No action needed',
        message: `Tidak ada service yang perlu di-${action}.`
      });
      return;
    }

    for (const target of targets) {
      // eslint-disable-next-line no-await-in-loop
      await mutation.mutateAsync({
        key: target.key,
        action,
        version: selectedVersions[target.key] ?? target.currentVersion ?? target.versions?.[0]
      });
    }
  }

  return (
    <Stack gap="sm">
      <Card withBorder radius="sm">
        <Group justify="space-between" align="center">
          <div>
            <Title order={4}>Services</Title>
            <Text c="dimmed" size="xs">
              {running}/{visibleServices.length || 0} berjalan
            </Text>
          </div>
          <Group gap="xs">
            <Button size="xs" variant="light" leftSection={<IconWorldWww size={14} />} onClick={() => void openExternal('http://localhost/')}>
              Localhost
            </Button>
            <Button size="xs" variant="light" leftSection={<IconTool size={14} />} onClick={() => void openExternal('http://localhost/phpmyadmin/')}>
              phpMyAdmin
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconDatabase size={14} />}
              onClick={() => void openExternal('C:\\Program Files\\pgAdmin 4\\runtime\\pgAdmin4.exe')}
            >
              pgAdmin
            </Button>
            <Button size="xs" variant="light" onClick={() => void runBulkAction('start')} loading={mutation.isPending}>
              Start All
            </Button>
            <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => void servicesQuery.refetch()} loading={servicesQuery.isFetching}>
              Sync
            </Button>
          </Group>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm" verticalSpacing="sm">
        {cards.map((service) => {
          const busy = mutation.isPending && mutation.variables?.key === service.key;
          const selectedVersionBusy = versionMutation.isPending && versionMutation.variables?.key === service.key;
          return (
            <Card
              key={service.key}
              withBorder
              radius="sm"
              p="md"
              style={{
                background: '#26282d',
                borderColor: '#3a3d45',
                color: '#f3f4f6',
                minHeight: 190
              }}
            >
              <Stack gap="md" h="100%" justify="space-between">
                <div>
                  <Group justify="space-between" align="flex-start" mb="sm">
                    <Group gap="xs">
                      <Badge variant="transparent" color="gray" p={0}>
                        {serviceIcon(service.key)}
                      </Badge>
                      <Text fw={700} size="sm" c="#f9fafb">
                        {service.label}
                      </Text>
                    </Group>
                    <Badge color={statusColor(service.status)} variant="light" radius="xl">
                      {service.status}
                    </Badge>
                  </Group>

                  <Title order={2} c="#f9fafb" style={{ lineHeight: 1.1 }}>
                    {service.selectedVersion || '-'}
                  </Title>
                  <Text size="xs" c="#9ca3af" mt={6}>
                    {service.detail}
                  </Text>
                  <Group gap="xs" mt="xs">
                    {service.port ? (
                      <Badge variant="outline" color="blue">
                        Port {service.port}
                      </Badge>
                    ) : null}
                    {service.pid ? (
                      <Badge variant="outline" color="gray">
                        PID {service.pid}
                      </Badge>
                    ) : null}
                  </Group>
                </div>

                {service.hasVersionDropdown ? (
                  <Select
                    size="sm"
                    value={service.selectedVersion}
                    onChange={(value) => {
                      if (!value) return;
                      setSelectedVersions((current) => ({ ...current, [service.key]: value }));
                      versionMutation.mutate({ key: service.key, version: value });
                    }}
                    data={(service.versions ?? []).map((version) => ({
                      value: version,
                      label: version
                    }))}
                    placeholder="Pilih versi"
                    disabled={selectedVersionBusy || busy}
                    styles={{
                      input: {
                        background: '#1f2126',
                        color: '#f3f4f6',
                        borderColor: '#3a3d45'
                      },
                      dropdown: {
                        background: '#1f2126',
                        borderColor: '#3a3d45'
                      },
                      option: {
                        color: '#f3f4f6'
                      }
                    }}
                  />
                ) : (
                  <Text size="xs" c="#6b7280">
                    {service.launchTarget ? service.launchTarget : service.kind}
                  </Text>
                )}

                {service.canControl ? (
                  <Group grow>
                    <Button
                      color={service.status === 'running' ? 'red' : 'green'}
                      variant="filled"
                      loading={busy}
                      onClick={() =>
                        mutation.mutate({
                          key: service.key,
                          action: service.status === 'running' ? 'stop' : 'start',
                          version: service.selectedVersion
                        })
                      }
                    >
                      {service.status === 'running' ? 'Stop' : 'Start'}
                    </Button>
                    <Button
                      color="dark"
                      variant="filled"
                      disabled={service.status !== 'running'}
                      loading={busy}
                      onClick={() => mutation.mutate({ key: service.key, action: 'restart', version: service.selectedVersion })}
                    >
                      Restart
                    </Button>
                  </Group>
                ) : service.isRuntime ? (
                  <Group grow>
                    <Button
                      color="blue"
                      variant="filled"
                      leftSection={<IconTerminal2 size={14} />}
                      disabled={!service.folderTarget}
                      onClick={() => {
                        if (!service.folderTarget) return;
                        if (service.isGit) {
                          void openGitBash(service.folderTarget);
                          return;
                        }
                        void openInTerminal(service.folderTarget);
                      }}
                    >
                      {service.isGit ? 'Git Bash' : 'Terminal'}
                    </Button>
                    <Button
                      color="dark"
                      variant="filled"
                      leftSection={<IconFolder size={14} />}
                      disabled={!service.folderTarget}
                      onClick={() => {
                        if (!service.folderTarget) return;
                        void openExternal(service.folderTarget);
                      }}
                    >
                      Folder
                    </Button>
                  </Group>
                ) : (
                  <Button
                    color="blue"
                    variant="filled"
                    disabled={!service.launchTarget}
                    onClick={() => {
                      if (!service.launchTarget) return;
                      void openExternal(service.launchTarget);
                    }}
                  >
                    Open
                  </Button>
                )}
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
