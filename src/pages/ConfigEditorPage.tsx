import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Code, Group, Loader, ScrollArea, Select, Stack, Switch, Text, TextInput, Textarea, Title } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getConfigFile, getConfigFiles, saveConfigFile } from '../lib/configApi';
import { useUiStore } from '../store/uiStore';

export function ConfigEditorPage() {
  const activePage = useUiStore((state) => state.activePage);
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
    <Card withBorder radius="sm">
      <Stack gap="sm">
        <div>
          <Title order={4}>Config Editor</Title>
          <Text c="dimmed" size="xs">
            Edit file konfigurasi utama lokal. Saat ini fokus ke <code>nginx.conf</code> dan <code>php.ini</code>, lengkap dengan backup sebelum save.
          </Text>
        </div>

        {filesQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <>
            <Select
              size="xs"
              label="Config target"
              value={selectedKey}
              onChange={setSelectedKey}
              data={(filesQuery.data ?? []).map((item) => ({
                value: item.key,
                label: item.label
              }))}
            />

            {fileQuery.isLoading ? (
              <Group justify="center" py="xl">
                <Loader />
              </Group>
            ) : fileQuery.data ? (
              <>
                <Group justify="space-between" align="flex-start">
                  <Code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '60%' }}>
                    {fileQuery.data.path}
                  </Code>
                  <Group gap="xs">
                    <Badge variant="outline">{lineCount} lines</Badge>
                    <Badge variant="outline" color={fileQuery.data.exists === false ? 'red' : 'green'}>
                      {fileQuery.data.exists === false ? 'missing' : 'available'}
                    </Badge>
                    <Badge variant="outline" color={isDirty ? 'yellow' : 'gray'}>
                      {isDirty ? 'unsaved changes' : 'synced'}
                    </Badge>
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
                <Switch
                  checked={reloadOnSave}
                  onChange={(event) => setReloadOnSave(event.currentTarget.checked)}
                  label="Reload related service after save"
                />
                <ScrollArea h="calc(100vh - 340px)" offsetScrollbars scrollbarSize={8}>
                  <Textarea
                    autosize={false}
                    minRows={18}
                    maxRows={18}
                    value={content}
                    onChange={(event) => setContent(event.currentTarget.value)}
                    styles={{ input: { fontFamily: 'Consolas, monospace', fontSize: 13 } }}
                  />
                </ScrollArea>
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
              </>
            ) : null}
          </>
        )}
      </Stack>
    </Card>
  );
}
