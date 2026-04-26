import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './runtime';

export async function openExternal(url: string) {
  if (isTauriRuntime()) {
    await invoke('open_external', { url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
