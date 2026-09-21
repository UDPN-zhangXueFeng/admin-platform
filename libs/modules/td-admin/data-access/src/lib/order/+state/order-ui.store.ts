import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Pure client-side UI state for the order module.
 *
 * Does NOT hold server data (orders, pagination) — those are owned
 * by TanStack Query. This store tracks selections, dialogs, and
 * panel visibility only.
 */
interface OrderUiState {
  /** IDs of orders currently selected in the list */
  selectedOrderIds: string[];
  /** Whether the create-order dialog is open */
  isCreateDialogOpen: boolean;
  /** Whether the filter panel is expanded */
  isFilterPanelOpen: boolean;
  /** ID of the order whose detail drawer/modal is open */
  detailOrderId: string | null;

  setSelectedOrderIds: (ids: string[]) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setFilterPanelOpen: (open: boolean) => void;
  setDetailOrderId: (id: string | null) => void;
  resetUi: () => void;
}

const initialState = {
  selectedOrderIds: [] as string[],
  isCreateDialogOpen: false,
  isFilterPanelOpen: false,
  detailOrderId: null as string | null,
};

export const useOrderUiStore = create<OrderUiState>()(
  devtools(
    (set) => ({
      ...initialState,

      setSelectedOrderIds: (ids) => set({ selectedOrderIds: ids }),
      setCreateDialogOpen: (open) => set({ isCreateDialogOpen: open }),
      setFilterPanelOpen: (open) => set({ isFilterPanelOpen: open }),
      setDetailOrderId: (id) => set({ detailOrderId: id }),
      resetUi: () => set(initialState),
    }),
    { name: 'OrderUiStore' }
  )
);
