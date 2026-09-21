import type * as React from 'react';
import type { ColumnDef, RowData } from '@tanstack/react-table';
import type {
  DataTablePagination,
  DataTableSelection,
} from './data-table';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /**
     * Cell overflow behaviour. Defaults to `ellipsis` (truncate with a hover
     * tooltip showing the full content). `wrap` renders the full content with
     * soft wrapping; `none` leaves the cell content untouched.
     */
    overflow?: 'ellipsis' | 'wrap' | 'none';
    /** Max content width (px) before ellipsis / wrap kicks in. Default 240. */
    maxWidth?: number;
    /**
     * Pin the column to the right edge while the table body scrolls
     * horizontally. Columns with id `actions` are pinned automatically.
     */
    stickyRight?: boolean;
  }
}

export interface DataTablePanelProps<TData extends { id: string }> {
  /**
   * Panel title. Defaults to a single non-wrapping line with ellipsis (full
   * text via the native title tooltip) so long titles never break the header
   * layout on small screens. Set `titleWrap` to render the full title with
   * soft wrapping instead.
   */
  title?: React.ReactNode;
  /** Allow the title to wrap to multiple lines instead of truncating. */
  titleWrap?: boolean;
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
