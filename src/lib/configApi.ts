import { invoke } from '@tauri-apps/api/core';
import type { ConfigFileDetail, ConfigFileSummary } from '../types';
import { isTauriRuntime } from './runtime';

export async function getConfigFiles(): Promise<ConfigFileSummary[]> {
  if (isTauriRuntime()) {
    return invoke<ConfigFileSummary[]>('get_config_files');
  }

  const response = await fetch('/api/config.php', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Config API failed with ${response.status}`);
  }

  return response.json() as Promise<ConfigFileSummary[]>;
}

export async function getConfigFile(key: string): Promise<ConfigFileDetail> {
  if (isTauriRuntime()) {
    return invoke<ConfigFileDetail>('get_config_file', { key });
  }

  const response = await fetch(`/api/config.php?key=${encodeURIComponent(key)}`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Config API failed with ${response.status}`);
  }

  return response.json() as Promise<ConfigFileDetail>;
}

export async function saveConfigFile(payload: { key: string; content: string; reloadService?: boolean }) {
  if (isTauriRuntime()) {
    return invoke<string>('save_config_file', { ...payload });
  }

  const response = await fetch('/api/config.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as { ok: boolean; message?: string; error?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `Config API failed with ${response.status}`);
  }

  return data.message ?? 'Saved';
}
