import { create } from 'zustand';
import type { AppPage } from '../types';

interface UiState {
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page })
}));
