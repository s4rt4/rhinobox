import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Code, Group, Loader, Stack, Switch, Text, TextInput, Textarea, Title, NavLink } from '@mantine/core';
import { IconFileCode, IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getConfigFile, getConfigFiles, saveConfigFile } from '../lib/configApi';
import { useUiStore } from '../store/uiStore';

export function ConfigEditorPage() {
  const activePage = useUiStore((state) => state.activePage);
  const pendingConfigKey = useUiStore((state) => state.pendingConfigKey);
  const clearPendingConfigKey = useUiStore((state) => state.clearPendingConfigKey);
  const queryClient = useQueryClient();
  const filesQuery = useQuery({
    queryKey: ['config-files'],
    queryFn: getConfigFiles,
    enabled: activePage === 'config',
    refetchOnWindowFocus: false,
    staleTime: 30000
  });

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const fileQuery = useQuery({
    queryKey: ['config-file', selectedKey],
    queryFn: () => getConfigFile(selectedKey ?? ''),
    enabled: activePage === 'config' && Boolean(selectedKey),
    refetchOnWindowFocus: false,
    staleTime: 30000
  });

  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [reloadOnSave, setReloadOnSave] = useState(true);

  useEffect(() => {
    if (pendingConfigKey) {
      setSelectedKey(pendingConfigKey);
      clearPendingConfigKey();
    }
  }, [pendingConfigKey, clearPendingConfigKey]);

  useEffect(() => {
    if (!selectedKey && filesQuery.data?.[0]) {
      setSelectedKey(filesQuery.data[0].key);
    }
  }, [filesQuery.data, selectedKey]);

  useEffect(() => {
    if (fileQuery.data) {
      setContent(fileQuery.data.content);
    }
  }, [fileQuery.data]);

  const isDirty = useMemo(() => {
    return fileQuery.data ? content !== fileQuery.data.content : false;
  }, [content, fileQuery.data]);

  const matchCount = useMemo(() => {
    if (!search.trim()) return 0;
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = content.match(new RegExp(escaped, 'gi'));
    return matches?.length ?? 0;
  }, [content, search]);

  const lineCount = useMemo(() => (content ? content.split('\n').length : 0), [content]);

  const saveMutation = useMutation({
    mutationFn: saveConfigFile,
    onSuccess: (message) => {
      notifications.show({ color: 'green', title: 'Config saved', message });
      void queryClient.invalidateQueries({ queryKey: ['config-file', selectedKey] });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return (
    <Stack gap="xs">
      <Card withBorder radius="sm" p="sm" className="surface-muted">
        <Group justify="space-between" align="center">
          <div>
            <Title order={5}>Config Editor</Title>
            <Text c="dimmed" size="xs">
              Edit konfigurasi utama dengan backup sebelum save.
            </Text>
          </div>
          {fileQuery.data ? (
            <Group gap="xs">
              <Badge variant="outline">{lineCount} lines</Badge>
              <Badge variant="outline" color={fileQuery.data.exists === false ? 'red' : 'green'}>
                {fileQuery.data.exists === false ? 'missing' : 'available'}
              </Badge>
              <Badge variant="outline" color={isDirty ? 'yellow' : 'gray'}>
                {isDirty ? 'unsaved' : 'synced'}
              </Badge>
            </Group>
          ) : null}
        </Group>
      </Card>

        {filesQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <Group align="stretch" gap="xs" wrap="nowrap" style={{ minHeight: 0 }}>
            <Card withBorder radius="sm" p={6} className="surface-muted" style={{ width: 210, flex: '0 0 210px' }}>
              <Stack gap={4}>
                {(filesQuery.data ?? []).map((item) => (
                  <NavLink
                    key={item.key}
                    active={selectedKey === item.key}
                    label={item.label}
                    description={item.exists === false ? 'Missing' : undefined}
                    leftSection={<IconFileCode size={16} />}
                    onClick={() => setSelectedKey(item.key)}
                    py={6}
                    styles={{
                      root: { borderRadius: 6 },
                      label: { fontSize: 13, fontWeight: selectedKey === item.key ? 700 : 500 },
                      description: { color: '#ff8787' }
                    }}
                  />
                ))}
              </Stack>
            </Card>

            {fileQuery.isLoading ? (
              <Card withBorder radius="sm" className="surface-muted" style={{ flex: 1 }}>
              <Group justify="center" py="xl">
                <Loader />
              </Group>
              </Card>
            ) : fileQuery.data ? (
              <Card withBorder radius="sm" p="sm" className="surface-muted" style={{ flex: 1, minWidth: 0 }}>
                <Stack gap="xs">
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Code
                    style={{
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                      flex: 1
                    }}
                  >
                    {fileQuery.data.path}
                  </Code>
                  <Group gap="xs" wrap="nowrap" align="center">
                    <Switch
                      size="sm"
                      checked={reloadOnSave}
                      onChange={(event) => setReloadOnSave(event.currentTarget.checked)}
                      label="Reload"
                    />
                  </Group>
                </Group>
                <Group grow align="flex-end">
                  <TextInput
                    size="xs"
                    label="Search in file"
                    placeholder="Find setting or keyword"
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    leftSection={<IconSearch size={16} />}
                  />
                  <Stack gap={4}>
                    <Text size="sm" c="dimmed">
                      Matches
                    </Text>
                    <Badge variant="light">{matchCount}</Badge>
                  </Stack>
                </Group>
                <Textarea
                  autosize={false}
                  minRows={18}
                  value={content}
                  onChange={(event) => setContent(event.currentTarget.value)}
                  styles={{
                    input: {
                      fontFamily: 'Consolas, monospace',
                      fontSize: 13,
                      minHeight: 'calc(100vh - 316px)',
                      maxHeight: 'calc(100vh - 316px)',
                      overflow: 'auto'
                    }
                  }}
                />
                <Group justify="flex-end">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setContent(fileQuery.data.content)}
                    disabled={saveMutation.isPending || !isDirty}
                  >
                    Reset
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => {
                      if (!selectedKey) return;
                      saveMutation.mutate({ key: selectedKey, content, reloadService: reloadOnSave });
                    }}
                    loading={saveMutation.isPending}
                    disabled={!isDirty}
                  >
                    Save{reloadOnSave ? ' + Reload' : ''}
                  </Button>
                </Group>
                </Stack>
              </Card>
            ) : null}
          </Group>
        )}
    </Stack>
  );
}
