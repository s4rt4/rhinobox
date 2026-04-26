import { invoke } from '@tauri-apps/api/core';
import type { ProcessMetric } from '../types';
import { isTauriRuntime } from './runtime';

interface RawProcessMetric {
  key: string;
  label: string;
  status: ProcessMetric['status'];
  pid: number | null;
  port: number | null;
  memoryMb?: number | null;
  memory_mb?: number | null;
  cpuSeconds?: number | null;
  cpu_seconds?: number | null;
  kind: ProcessMetric['kind'];
  path?: string | null;
  canKill?: boolean;
  can_kill?: boolean;
}

function normalizeMetric(metric: RawProcessMetric): ProcessMetric {
  return {
    key: metric.key,
    label: metric.label,
    status: metric.status,
    pid: metric.pid ?? null,
    port: metric.port ?? null,
    memoryMb: metric.memoryMb ?? metric.memory_mb ?? null,
    cpuSeconds: metric.cpuSeconds ?? metric.cpu_seconds ?? null,
    kind: metric.kind,
    path: metric.path ?? null,
    canKill: metric.canKill ?? metric.can_kill ?? false
  };
}

export async function getProcessMetrics(): Promise<ProcessMetric[]> {
  if (isTauriRuntime()) {
    const data = await invoke<RawProcessMetric[]>('get_process_metrics');
    return data.map(normalizeMetric);
  }

  const response = await fetch('/api/process-monitor.php', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Monitor API failed with ${response.status}`);
  }

  const data = (await response.json()) as RawProcessMetric[];
  return data.map(normalizeMetric);
}

export async function killProcess(pid: number): Promise<string> {
  if (isTauriRuntime()) {
    return invoke<string>('kill_process', { pid });
  }

  throw new Error('Kill process is only available in the native app right now.');
}
