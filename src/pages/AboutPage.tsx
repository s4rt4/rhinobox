import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconBrandGithub, IconInfoCircle, IconLicense, IconRocket, IconStack2 } from '@tabler/icons-react';
import packageJson from '../../package.json';
import { openExternal } from '../lib/externalLinks';
import { runtimeMode } from '../lib/runtime';

const logoUrl = new URL('../../assets/branding/rhinobox.png', import.meta.url).href;

export function AboutPage() {
  const mode = runtimeMode();

  return (
    <Stack gap="sm">
      <Card withBorder radius="sm" p="lg">
        <Group align="flex-start" wrap="nowrap" gap="md">
          <img src={logoUrl} alt="RhinoBOX" style={{ width: 56, height: 56, display: 'block' }} />
          <Stack gap={6} style={{ flex: 1 }}>
            <Group gap="xs">
              <Title order={3}>RhinoBOX</Title>
              <Badge variant="light" color="blue">
                v{packageJson.version}
              </Badge>
              <Badge variant="light" color="grape">
                {mode === 'tauri' ? 'Desktop' : 'Browser'}
              </Badge>
            </Group>
            <Text c="dimmed" size="sm">
              Control center untuk local development environment di Windows. Fokusnya cepat, praktis, dan enak dipakai harian.
            </Text>
            <Group gap="xs" mt="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconBrandGithub size={14} />}
                onClick={() => void openExternal('https://github.com/s4rt4/rhinobox')}
              >
                GitHub
              </Button>
            </Group>
          </Stack>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Card withBorder radius="sm">
          <Group gap="xs" mb="xs">
            <IconInfoCircle size={16} />
            <Text fw={700} size="sm">
              Ringkas
            </Text>
          </Group>
          <Stack gap={6}>
            <Text size="sm">Dibuat untuk mengelola service, runtime, config, log, dan utilitas lokal dalam satu app.</Text>
            <Text size="sm">Cocok untuk stack seperti nginx, PHP, MariaDB, PostgreSQL, Node.js, Python, Go, dan Git.</Text>
          </Stack>
        </Card>

        <Card withBorder radius="sm">
          <Group gap="xs" mb="xs">
            <IconStack2 size={16} />
            <Text fw={700} size="sm">
              Stack
            </Text>
          </Group>
          <Stack gap={6}>
            <Text size="sm">Tauri v2</Text>
            <Text size="sm">React 18 + TypeScript</Text>
            <Text size="sm">Mantine UI + TanStack Query + Zustand</Text>
          </Stack>
        </Card>

        <Card withBorder radius="sm">
          <Group gap="xs" mb="xs">
            <IconRocket size={16} />
            <Text fw={700} size="sm">
              Fokus Saat Ini
            </Text>
          </Group>
          <Stack gap={6}>
            <Text size="sm">Service switching dan control untuk stack lokal.</Text>
            <Text size="sm">Ringan saat idle dan tetap responsif saat dipakai.</Text>
            <Text size="sm">Perilaku desktop utilitas yang natural, termasuk tray mode.</Text>
          </Stack>
        </Card>

        <Card withBorder radius="sm">
          <Group gap="xs" mb="xs">
            <IconLicense size={16} />
            <Text fw={700} size="sm">
              License
            </Text>
          </Group>
          <Stack gap={6}>
            <Text size="sm">MIT License</Text>
            <Text size="sm">Source tersedia dan bisa dilanjutkan secara terbuka.</Text>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
