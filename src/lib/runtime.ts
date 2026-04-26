export function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function runtimeMode() {
  return isTauriRuntime() ? 'tauri' : 'browser';
}
