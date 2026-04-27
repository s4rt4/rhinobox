import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './runtime';

export async function openExternal(url: string) {
  if (isTauriRuntime()) {
    await invoke('open_external', { url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function openInTerminal(path: string) {
  if (isTauriRuntime()) {
    await invoke('open_in_terminal', { path });
    return;
  }

  window.open(path, '_blank', 'noopener,noreferrer');
}

export async function openGitBash(path: string) {
  if (isTauriRuntime()) {
    await invoke('open_git_bash', { path });
    return;
  }

  window.open(path, '_blank', 'noopener,noreferrer');
}
