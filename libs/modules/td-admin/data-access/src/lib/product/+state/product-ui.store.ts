'use client';

/**
 * 商品管理 module UI-state store (Zustand).
 *
 * Manages purely client-side UI concerns: multi-select row IDs,
 * dialog visibility, and panel toggles. NEVER stores API data here —
 * that belongs to TanStack Query.
 */

import { createUIStore } from '@myorg/shared/util-state';

interface ProductUiState {
  /** IDs of currently selected products (e.g. for bulk actions). */
  selectedProductIds: string[];
  /** Whether the "create product" dialog is open. */
  isCreateDialogOpen: boolean;
  /** Whether the filter panel is expanded. */
  isFilterPanelOpen: boolean;

  setSelectedProductIds: (ids: string[]) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setFilterPanelOpen: (open: boolean) => void;

  /** Convenience: toggle a single ID in the selection set. */
  toggleProductSelection: (id: string) => void;
  /** Convenience: clear all selections. */
  clearSelection: () => void;
}

export const useProductUiStore = createUIStore<ProductUiState>(
  (set) => ({
    selectedProductIds: [],
    isCreateDialogOpen: false,
    isFilterPanelOpen: false,

    setSelectedProductIds: (ids) => set({ selectedProductIds: ids }),
    setCreateDialogOpen: (open) => set({ isCreateDialogOpen: open }),
    setFilterPanelOpen: (open) => set({ isFilterPanelOpen: open }),

    toggleProductSelection: (id) =>
      set((state) => ({
        selectedProductIds: state.selectedProductIds.includes(id)
          ? state.selectedProductIds.filter((x) => x !== id)
          : [...state.selectedProductIds, id],
      })),

    clearSelection: () => set({ selectedProductIds: [] }),
  }),
  'ProductUiStore',
);
