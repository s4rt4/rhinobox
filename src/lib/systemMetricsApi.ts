import { invoke } from '@tauri-apps/api/core';
import type { SystemMetrics } from '../types';
import { isTauriRuntime } from './runtime';

interface RawSystemMetrics {
  cpuPercent?: number | null;
  cpu_percent?: number | null;
  memoryUsedGb?: number | null;
  memory_used_gb?: number | null;
  memoryTotalGb?: number | null;
  memory_total_gb?: number | null;
  diskUsedGb?: number | null;
  disk_used_gb?: number | null;
  diskTotalGb?: number | null;
  disk_total_gb?: number | null;
  downloadKbps?: number | null;
  download_kbps?: number | null;
  uploadKbps?: number | null;
  upload_kbps?: number | null;
}

function normalizeMetrics(metrics: RawSystemMetrics): SystemMetrics {
  return {
    cpuPercent: metrics.cpuPercent ?? metrics.cpu_percent ?? null,
    memoryUsedGb: metrics.memoryUsedGb ?? metrics.memory_used_gb ?? null,
    memoryTotalGb: metrics.memoryTotalGb ?? metrics.memory_total_gb ?? null,
    diskUsedGb: metrics.diskUsedGb ?? metrics.disk_used_gb ?? null,
    diskTotalGb: metrics.diskTotalGb ?? metrics.disk_total_gb ?? null,
    downloadKbps: metrics.downloadKbps ?? metrics.download_kbps ?? null,
    uploadKbps: metrics.uploadKbps ?? metrics.upload_kbps ?? null
  };
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  if (isTauriRuntime()) {
    const data = await invoke<RawSystemMetrics>('get_system_metrics');
    return normalizeMetrics(data);
  }

  const response = await fetch('/api/system-metrics.php', {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`System metrics API failed with ${response.status}`);
  }

  const data = (await response.json()) as RawSystemMetrics;
  return normalizeMetrics(data);
}
