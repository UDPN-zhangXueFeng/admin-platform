'use client';

/**
 * User module UI-state store (Zustand).
 *
 * Manages purely client-side UI concerns: multi-select row IDs,
 * dialog visibility, and panel toggles. NEVER stores API data here —
 * that belongs to TanStack Query.
 */

import { createUIStore } from '@myorg/shared/util-state';

interface UserUiState {
  /** IDs of currently selected users (e.g. for bulk actions). */
  selectedUserIds: string[];
  /** Whether the "create user" dialog is open. */
  isCreateDialogOpen: boolean;
  /** Whether the filter panel is expanded. */
  isFilterPanelOpen: boolean;

  setSelectedUserIds: (ids: string[]) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setFilterPanelOpen: (open: boolean) => void;

  /** Convenience: toggle a single ID in the selection set. */
  toggleUserSelection: (id: string) => void;
  /** Convenience: clear all selections. */
  clearSelection: () => void;
}

export const useUserUiStore = createUIStore<UserUiState>(
  (set) => ({
    selectedUserIds: [],
    isCreateDialogOpen: false,
    isFilterPanelOpen: false,

    setSelectedUserIds: (ids) => set({ selectedUserIds: ids }),
    setCreateDialogOpen: (open) => set({ isCreateDialogOpen: open }),
    setFilterPanelOpen: (open) => set({ isFilterPanelOpen: open }),

    toggleUserSelection: (id) =>
      set((state) => ({
        selectedUserIds: state.selectedUserIds.includes(id)
          ? state.selectedUserIds.filter((x) => x !== id)
          : [...state.selectedUserIds, id],
      })),

    clearSelection: () => set({ selectedUserIds: [] }),
  }),
  'UserUiStore'
);
