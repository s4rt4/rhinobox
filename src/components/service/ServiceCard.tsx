import { Badge, Button, Card, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconBrandMysql, IconBrandPhp, IconServer, IconWorldWww } from '@tabler/icons-react';
import type { ManagedService } from '../../types';

function serviceIcon(key: string) {
  switch (key) {
    case 'nginx':
      return IconWorldWww;
    case 'php_cgi':
      return IconBrandPhp;
    case 'mariadb':
      return IconBrandMysql;
    default:
      return IconServer;
  }
}

function statusColor(status: ManagedService['status']) {
  if (status === 'running') return 'green';
  if (status === 'stopped') return 'gray';
  return 'yellow';
}

interface ServiceCardProps {
  service: ManagedService;
  busy: boolean;
  onAction: (action: 'start' | 'stop' | 'reload' | 'restart') => void;
}

export function ServiceCard({ service, busy, onAction }: ServiceCardProps) {
  const Icon = serviceIcon(service.key);

  return (
    <Card withBorder radius="sm" h="100%">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Group align="flex-start">
            <ThemeIcon size={36} radius="sm" variant="light">
              <Icon size={18} />
            </ThemeIcon>
            <div>
              <Title order={5}>{service.label}</Title>
              <Text size="xs" c="dimmed">
                {service.detail}
              </Text>
            </div>
          </Group>
          <Badge color={statusColor(service.status)} variant="light">
            {service.status}
          </Badge>
        </Group>

        <Group gap="xs">
          {service.port ? <Badge variant="outline">Port {service.port}</Badge> : null}
          {service.pid ? <Badge variant="outline">PID {service.pid}</Badge> : null}
          <Badge variant="outline">{service.kind}</Badge>
        </Group>

        <Group grow>
          <Button size="xs" variant="light" color="green" disabled={service.status === 'running'} loading={busy} onClick={() => onAction('start')}>
            Start
          </Button>
          <Button size="xs" variant="light" color="red" disabled={service.status === 'stopped'} loading={busy} onClick={() => onAction('stop')}>
            Stop
          </Button>
        </Group>

        <Group grow>
          <Button size="xs" variant="default" disabled={!service.canReload} loading={busy} onClick={() => onAction('reload')}>
            Reload
          </Button>
          <Button size="xs" variant="default" loading={busy} onClick={() => onAction('restart')}>
            Restart
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
