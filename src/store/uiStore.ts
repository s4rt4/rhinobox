import { create } from 'zustand';
import type { AppPage } from '../types';

interface UiState {
  activePage: AppPage;
  pendingConfigKey: string | null;
  setActivePage: (page: AppPage) => void;
  openConfigTarget: (key: string) => void;
  clearPendingConfigKey: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePage: 'dashboard',
  pendingConfigKey: null,
  setActivePage: (page) => set({ activePage: page }),
  openConfigTarget: (key) => set({ activePage: 'config', pendingConfigKey: key }),
  clearPendingConfigKey: () => set({ pendingConfigKey: null })
}));
