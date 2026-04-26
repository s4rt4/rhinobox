export type ServiceStatus = 'running' | 'stopped' | 'unknown';
export type AppPage = 'dashboard' | 'discovery' | 'config' | 'logs' | 'monitor';

export interface ManagedService {
  key: string;
  label: string;
  status: ServiceStatus;
  detail: string;
  port?: number;
  pid?: number | null;
  canReload?: boolean;
  kind: string;
  currentVersion?: string | null;
  versions?: string[];
  launchTarget?: string | null;
}

export interface RuntimeInfo {
  mode: 'browser' | 'tauri';
  serviceCount: number;
  runningCount: number;
}

export interface DiscoveryItem {
  key: string;
  label: string;
  value: string;
  source: 'detected' | 'derived' | 'manual';
  available?: boolean;
}

export interface ConfigFileSummary {
  key: string;
  label: string;
  path: string;
  serviceKey?: string | null;
  exists?: boolean;
}

export interface ConfigFileDetail extends ConfigFileSummary {
  content: string;
}

export interface LogTarget {
  key: string;
  label: string;
  path: string;
  available: boolean;
  lines: string[];
}

export interface ProcessMetric {
  key: string;
  label: string;
  status: ServiceStatus;
  pid: number | null;
  port: number | null;
  memoryMb: number | null;
  cpuSeconds: number | null;
  kind: string;
  path?: string | null;
  canKill?: boolean;
}
