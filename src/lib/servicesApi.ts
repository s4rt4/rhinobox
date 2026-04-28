import { invoke } from '@tauri-apps/api/core';
import type { ManagedService } from '../types';
import { isTauriRuntime } from './runtime';

export interface ControlPayload {
  key: string;
  action: 'start' | 'stop' | 'reload' | 'restart';
  version?: string;
}

interface RawManagedService {
  key: string;
  label: string;
  status: ManagedService['status'];
  detail: string;
  port?: number | null;
  pid?: number | null;
  canReload?: boolean;
  can_reload?: boolean;
  kind: ManagedService['kind'];
  currentVersion?: string | null;
  current_version?: string | null;
  versions?: string[];
  launchTarget?: string | null;
  launch_target?: string | null;
}

function normalizeService(service: RawManagedService): ManagedService {
  return {
    key: service.key,
    label: service.label,
    status: service.status,
    detail: service.detail,
    port: service.port ?? undefined,
    pid: service.pid ?? null,
    canReload: service.canReload ?? service.can_reload ?? false,
    kind: service.kind,
    currentVersion: service.currentVersion ?? service.current_version ?? null,
    versions: service.versions ?? [],
    launchTarget: service.launchTarget ?? service.launch_target ?? null
  };
}

async function browserGetServices() {
  const response = await fetch('/api/services.php', {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Browser API failed with ${response.status}`);
  }

  const data = (await response.json()) as RawManagedService[];
  return data.map(normalizeService);
}

async function browserControlService(payload: ControlPayload) {
  const response = await fetch('/api/control.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as { ok: boolean; message?: string; error?: string };

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `Browser API failed with ${response.status}`);
  }

  return data.message ?? 'Action complete';
}

export async function getServices(): Promise<ManagedService[]> {
  if (isTauriRuntime()) {
    const data = await invoke<RawManagedService[]>('get_services');
    return data.map(normalizeService);
  }

  return browserGetServices();
}

export async function controlService(payload: ControlPayload) {
  if (isTauriRuntime()) {
    return invoke<string>('control_service', { ...payload });
  }

  return browserControlService(payload);
}

export async function setServiceVersion(key: string, version: string) {
  if (isTauriRuntime()) {
    return invoke<string>('set_service_version', { key, version });
  }

  const response = await fetch('/api/service-version.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ key, version })
  });

  const data = (await response.json()) as { ok: boolean; message?: string; error?: string };

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `Browser API failed with ${response.status}`);
  }

  return data.message ?? `${key} version set to ${version}`;
}
