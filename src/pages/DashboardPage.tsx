import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Group, SegmentedControl, Select, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconBrandGit, IconDatabase, IconFolder, IconMail, IconTerminal2, IconTool, IconWorldWww } from '@tabler/icons-react';
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
    case 'pgweb':
      return <IconDatabase size={18} />;
    case 'redis':
      return <IconDatabase size={18} />;
    case 'memcached':
      return <IconDatabase size={18} />;
    case 'git':
      return <IconBrandGit size={18} />;
    case 'localhost':
      return <IconWorldWww size={18} />;
    case 'phpmyadmin':
      return <IconDatabase size={18} />;
    case 'mailpit':
      return <IconMail size={18} />;
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
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

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
  const controllableServices = useMemo(
    () => visibleServices.filter((service) => service.kind === 'process' || service.kind === 'windows-service'),
    [visibleServices]
  );
  const running = controllableServices.filter((item) => item.status === 'running').length;

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
    const candidates = controllableServices;
    const targets =
      action === 'start'
        ? candidates.filter((item) => item.status !== 'running')
        : action === 'stop'
          ? candidates.filter((item) => item.status === 'running')
          : candidates;

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

  async function openMailpitInbox() {
    const mailpit = services.find((service) => service.key === 'mailpit');
    if (mailpit && mailpit.status !== 'running') {
      await mutation.mutateAsync({
        key: 'mailpit',
        action: 'start',
        version: mailpit.currentVersion ?? mailpit.versions?.[0]
      });
    }
    await openExternal('http://localhost:8025/');
  }

  async function openPgweb() {
    const postgresql = services.find((service) => service.key === 'postgresql');
    if (postgresql && postgresql.status !== 'running') {
      await mutation.mutateAsync({
        key: 'postgresql',
        action: 'start',
        version: postgresql.currentVersion ?? postgresql.versions?.[0]
      });
    }

    const pgweb = services.find((service) => service.key === 'pgweb');
    if (pgweb && pgweb.status !== 'running') {
      await mutation.mutateAsync({
        key: 'pgweb',
        action: 'start',
        version: pgweb.currentVersion ?? pgweb.versions?.[0]
      });
    }
    await openExternal('http://localhost:8081/');
  }

  function renderVersionSelect(service: (typeof cards)[number], size: 'xs' | 'sm' = 'sm') {
    const busy = mutation.isPending && mutation.variables?.key === service.key;
    const selectedVersionBusy = versionMutation.isPending && versionMutation.variables?.key === service.key;
    if (!service.hasVersionDropdown) {
      return (
        <Text size="xs" c="#8b93a1" truncate="end">
          {service.launchTarget ? service.launchTarget : service.kind}
        </Text>
      );
    }

    return (
      <Select
        size={size}
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
    );
  }

  function renderServiceActions(service: (typeof cards)[number], compact = false) {
    const busy = mutation.isPending && mutation.variables?.key === service.key;
    const buttonSize = compact ? 'xs' : 'sm';
    const compactButtonStyle = compact ? { width: 78 } : undefined;
    if (service.canControl) {
      return (
        <Group grow={!compact} gap="xs" wrap="nowrap">
          <Button
            size={buttonSize}
            style={compactButtonStyle}
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
            size={buttonSize}
            style={compactButtonStyle}
            color="gray"
            variant="filled"
            disabled={service.status !== 'running'}
            loading={busy}
            onClick={() => mutation.mutate({ key: service.key, action: 'restart', version: service.selectedVersion })}
          >
            Restart
          </Button>
        </Group>
      );
    }

    if (service.isRuntime) {
      return (
        <Group grow={!compact} gap="xs" wrap="nowrap">
          <Button
            size={buttonSize}
            style={compactButtonStyle}
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
            size={buttonSize}
            style={compactButtonStyle}
            color="gray"
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
      );
    }

    return (
      <Button
        size={buttonSize}
        style={compactButtonStyle}
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
    );
  }

  return (
    <Stack gap="xs">
      <Card withBorder radius="sm" p="sm">
        <Group justify="space-between" align="center" wrap="nowrap">
          <div>
            <Title order={5}>Services</Title>
            <Text c="dimmed" size="xs">
              {running}/{controllableServices.length || 0} service aktif
            </Text>
          </div>
          <Group gap={6} justify="flex-end" wrap="nowrap">
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
              loading={mutation.isPending && ['postgresql', 'pgweb'].includes(mutation.variables?.key ?? '')}
              onClick={() => void openPgweb()}
            >
              Pgweb
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconMail size={14} />}
              loading={mutation.isPending && mutation.variables?.key === 'mailpit'}
              onClick={() => void openMailpitInbox()}
            >
              Mailpit
            </Button>
            <Button size="xs" variant="light" color="green" onClick={() => void runBulkAction('start')} loading={mutation.isPending}>
              Start All
            </Button>
            <SegmentedControl
              size="xs"
              value={viewMode}
              onChange={(value) => setViewMode(value as 'list' | 'card')}
              data={[
                { label: 'List', value: 'list' },
                { label: 'Card', value: 'card' }
              ]}
            />
          </Group>
        </Group>
      </Card>

      {viewMode === 'list' ? (
        <Card withBorder radius="sm" p={0} style={{ overflow: 'hidden' }}>
          <Stack gap={0}>
            {cards.map((service, index) => (
              <Stack
                key={service.key}
                gap={8}
                p="xs"
                style={{
                  borderTop: index === 0 ? 'none' : '1px solid #3a3d45',
                  background: index % 2 === 0 ? '#292b30' : '#25272c'
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Badge variant="transparent" color="gray" p={0} style={{ flex: '0 0 20px', width: 20, display: 'flex', justifyContent: 'center' }}>
                      {serviceIcon(service.key)}
                    </Badge>
                    <div style={{ minWidth: 0 }}>
                      <Text fw={700} size="sm" truncate="end" lh={1.15}>{service.label}</Text>
                      <Text size="xs" c="dimmed" truncate="end" lh={1.15}>{service.detail}</Text>
                    </div>
                  </Group>
                  <Group gap={6} wrap="nowrap">
                    <Badge color={statusColor(service.status)} variant="light" radius="xl" miw={76} size="xs" style={{ justifyContent: 'center' }}>
                      {service.status}
                    </Badge>
                    {service.port ? (
                      <Badge variant="outline" color="blue" size="xs">
                        :{service.port}
                      </Badge>
                    ) : null}
                  </Group>
                </Group>
                <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                  <div style={{ flex: '1 1 180px', minWidth: 140 }}>
                    {renderVersionSelect(service, 'xs')}
                  </div>
                  <Text size="xs" c="dimmed" style={{ flex: '0 0 auto' }}>
                    PID {service.pid ?? '-'}
                  </Text>
                  <div style={{ flex: '0 0 auto' }}>
                    {renderServiceActions(service, true)}
                  </div>
                </Group>
              </Stack>
            ))}
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" verticalSpacing="xs">
        {cards.map((service) => {
          return (
            <Card
              key={service.key}
              withBorder
              radius="sm"
              p="sm"
              style={{
                background: '#26282d',
                borderColor: '#3a3d45',
                color: '#f3f4f6',
                minHeight: 176
              }}
            >
              <Stack gap="sm" h="100%" justify="space-between">
                <div>
                  <Group justify="space-between" align="flex-start" mb={6}>
                    <Group gap="xs">
                      <Badge variant="transparent" color="gray" p={0}>
                        {serviceIcon(service.key)}
                      </Badge>
                      <Text fw={700} size="sm" c="#f9fafb">
                        {service.label}
                      </Text>
                    </Group>
                    <Badge color={statusColor(service.status)} variant="light" radius="xl" size="xs">
                      {service.status}
                    </Badge>
                  </Group>

                  <Title order={3} c="#f9fafb" lineClamp={1} style={{ lineHeight: 1.1 }}>
                    {service.selectedVersion || '-'}
                  </Title>
                  <Text size="xs" c="#9ca3af" mt={4} lineClamp={1}>
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

                {renderVersionSelect(service)}
                {renderServiceActions(service)}
              </Stack>
            </Card>
          );
        })}
        </SimpleGrid>
      )}
    </Stack>
  );
}
