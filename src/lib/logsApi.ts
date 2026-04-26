import { invoke } from '@tauri-apps/api/core';
import type { LogTarget } from '../types';
import { isTauriRuntime } from './runtime';

export async function getLogs(): Promise<LogTarget[]> {
  if (isTauriRuntime()) {
    return invoke<LogTarget[]>('get_logs');
  }

  const response = await fetch('/api/logs.php', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Logs API failed with ${response.status}`);
  }

  return response.json() as Promise<LogTarget[]>;
}
