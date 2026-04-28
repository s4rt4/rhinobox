import { invoke } from '@tauri-apps/api/core';
import type { VirtualHostSummary } from '../types';
import { isTauriRuntime } from './runtime';

interface RawVirtualHostSummary {
  name: string;
  domain: string;
  root: string;
  tld: string;
  configPath?: string;
  config_path?: string;
  configExists?: boolean;
  config_exists?: boolean;
  hostsEnabled?: boolean;
  hosts_enabled?: boolean;
}

function normalizeVhost(item: RawVirtualHostSummary): VirtualHostSummary {
  return {
    name: item.name,
    domain: item.domain,
    root: item.root,
    tld: item.tld,
    configPath: item.configPath ?? item.config_path ?? '',
    configExists: item.configExists ?? item.config_exists ?? false,
    hostsEnabled: item.hostsEnabled ?? item.hosts_enabled ?? false
  };
}

export async function listVirtualHosts(): Promise<VirtualHostSummary[]> {
  if (isTauriRuntime()) {
    const data = await invoke<RawVirtualHostSummary[]>('list_virtual_hosts');
    return data.map(normalizeVhost);
  }

  const response = await fetch('/api/vhosts.php', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Virtual host API failed with ${response.status}`);
  }
  const data = (await response.json()) as RawVirtualHostSummary[];
  return data.map(normalizeVhost);
}

export async function createVirtualHost(payload: { name: string; tld: string; root: string }) {
  if (isTauriRuntime()) {
    return invoke<string>('create_virtual_host', payload);
  }

  const response = await fetch('/api/vhosts.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = (await response.json()) as { ok: boolean; message?: string; error?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `Virtual host API failed with ${response.status}`);
  }
  return data.message ?? 'Virtual host created';
}

export async function removeVirtualHost(domain: string) {
  if (isTauriRuntime()) {
    return invoke<string>('remove_virtual_host', { domain });
  }

  const response = await fetch('/api/vhosts.php', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ domain })
  });
  const data = (await response.json()) as { ok: boolean; message?: string; error?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `Virtual host API failed with ${response.status}`);
  }
  return data.message ?? 'Virtual host removed';
}
