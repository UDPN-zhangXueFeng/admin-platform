import type * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  DataTablePagination,
  DataTableSelection,
} from './data-table';

export interface DataTablePanelProps<TData extends { id: string }> {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  filter?: React.ReactNode;
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  error?: React.ReactNode;
  emptyMessage?: string;
  pagination?: DataTablePagination;
  selection?: DataTableSelection;
  className?: string;
}
