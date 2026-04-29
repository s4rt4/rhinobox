import type { ReactNode } from 'react';
import { Card, Stack, Text, Title } from '@mantine/core';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message: string;
}

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <Card withBorder radius="sm" p="md" className="surface-muted">
      <Stack gap={6} align="center" ta="center">
        {icon}
        <Title order={5}>{title}</Title>
        <Text c="dimmed" size="xs" maw={360}>
          {message}
        </Text>
      </Stack>
    </Card>
  );
}
