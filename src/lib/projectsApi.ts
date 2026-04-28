import { invoke } from '@tauri-apps/api/core';
import type { ProjectSummary } from '../types';
import { isTauriRuntime } from './runtime';

interface RawProjectSummary {
  name: string;
  path: string;
  kind: string;
  domain?: string | null;
  url: string;
  hasVhost?: boolean;
  has_vhost?: boolean;
  hasPublicDir?: boolean;
  has_public_dir?: boolean;
}

function normalizeProject(item: RawProjectSummary): ProjectSummary {
  return {
    name: item.name,
    path: item.path,
    kind: item.kind,
    domain: item.domain ?? null,
    url: item.url,
    hasVhost: item.hasVhost ?? item.has_vhost ?? false,
    hasPublicDir: item.hasPublicDir ?? item.has_public_dir ?? false
  };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  if (isTauriRuntime()) {
    const data = await invoke<RawProjectSummary[]>('list_projects');
    return data.map(normalizeProject);
  }

  const response = await fetch('/api/projects.php', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Projects API failed with ${response.status}`);
  }

  const data = (await response.json()) as RawProjectSummary[];
  return data.map(normalizeProject);
}
