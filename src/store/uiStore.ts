import { create } from 'zustand';
import type { AppPage } from '../types';

interface UiState {
  activePage: AppPage;
  pendingConfigKey: string | null;
  globalSearch: string;
  setActivePage: (page: AppPage) => void;
  setGlobalSearch: (query: string) => void;
  openConfigTarget: (key: string) => void;
  clearPendingConfigKey: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePage: 'dashboard',
  pendingConfigKey: null,
  globalSearch: '',
  setActivePage: (page) => set({ activePage: page }),
  setGlobalSearch: (query) => set({ globalSearch: query }),
  openConfigTarget: (key) => set({ activePage: 'config', pendingConfigKey: key }),
  clearPendingConfigKey: () => set({ pendingConfigKey: null })
}));
