import { invoke } from '@tauri-apps/api/core';
import type { DiscoveryItem } from '../types';
import { isTauriRuntime } from './runtime';

async function browserGetDiscovery() {
  const response = await fetch('/api/discovery.php', {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Browser discovery API failed with ${response.status}`);
  }

  return (await response.json()) as DiscoveryItem[];
}

export async function getDiscovery(): Promise<DiscoveryItem[]> {
  if (isTauriRuntime()) {
    return invoke<DiscoveryItem[]>('get_discovery');
  }

  return browserGetDiscovery();
}
