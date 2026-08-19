'use client';

// Ensures the `ColumnMeta` augmentation (overflow / maxWidth / stickyRight)
// in data-table.types.ts is visible for the column defs consumed below.
import type {} from './data-table.types';
import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  RowSelectionState,
  PaginationState,
} from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../tooltip';
import { cn } from '@myorg/shared/util-classnames';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../select';

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /**
   * Page-size selector callback (e.g. switching between 10/20/50 rows).
   * Rendered only when provided — pages that don't pass it keep the plain
   * footer, so existing consumers are unaffected.
   */
  onPageSizeChange?: (pageSize: number) => void;
  /** Selector options; defaults to [10, 20, 50]. */
  pageSizeOptions?: number[];
}

export interface DataTableSelection {
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
}

export interface DataTableProps<TData extends { id: string }> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  pagination?: DataTablePagination;
  selection?: DataTableSelection;
  emptyMessage?: string;
  className?: string;
}

const DEFAULT_CELL_MAX_WIDTH = 240;
const WRAP_CELL_MAX_WIDTH = 360;

/**
 * Truncates content past `maxWidth` and reveals the full content in a Radix
 * tooltip — but only when the content actually overflows (measured on hover),
 * so short cells never pop a redundant tooltip.
 */
function EllipsisWithTooltip({
  children,
  maxWidth,
}: {
  children: React.ReactNode;
  maxWidth: number;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const showTimer = React.useRef<number | undefined>(undefined);
  const [open, setOpen] = React.useState(false);

  const clearShowTimer = () => {
    if (showTimer.current !== undefined) {
      window.clearTimeout(showTimer.current);
      showTimer.current = undefined;
    }
  };

  React.useEffect(clearShowTimer, []);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open}>
        <TooltipTrigger asChild>
          <div
            ref={contentRef}
            onPointerEnter={() => {
              const el = contentRef.current;
              if (el && el.scrollWidth > el.clientWidth) {
                showTimer.current = window.setTimeout(
                  () => setOpen(true),
                  150,
                );
              }
            }}
            onPointerLeave={() => {
              clearShowTimer();
              setOpen(false);
            }}
            className="truncate"
            style={{ maxWidth }}
          >
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          className="max-w-[var(--wrap-w)] select-text whitespace-normal break-all font-mono text-xs leading-relaxed shadow-lg"
          style={{ ['--wrap-w' as string]: `${WRAP_CELL_MAX_WIDTH}px` }}
        >
          {children}
          <TooltipArrow className="fill-popover" width={10} height={5} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DataTableCellContent({
  columnId,
  meta,
  children,
}: {
  columnId: string;
  meta: { overflow?: 'ellipsis' | 'wrap' | 'none'; maxWidth?: number } | undefined;
  children: React.ReactNode;
}) {
  if (columnId === 'actions' || meta?.overflow === 'none') {
    return <>{children}</>;
  }
  if (meta?.overflow === 'wrap') {
    return (
      <div
        className="whitespace-normal break-words"
        style={{ maxWidth: meta.maxWidth ?? WRAP_CELL_MAX_WIDTH }}
      >
        {children}
      </div>
    );
  }
  return (
    <EllipsisWithTooltip maxWidth={meta?.maxWidth ?? DEFAULT_CELL_MAX_WIDTH}>
      {children}
    </EllipsisWithTooltip>
  );
}

/**
 * Generic data table powered by @tanstack/react-table.
 *
 * Supports:
 * - Column definitions via `columns` prop.
 * - Loading skeleton rows.
 * - Client-side pagination (when `pagination` is provided).
 * - Row selection (checkbox column auto-injected when `selection` is provided).
 * - Accessible markup: <table> with proper scope headers.
 */
export function DataTable<TData extends { id: string }>({
  columns,
  data,
  isLoading = false,
  pagination,
  selection,
  emptyMessage = 'No data available.',
  className,
}: DataTableProps<TData>) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const pageCount = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  const tablePagination: PaginationState | undefined = pagination
    ? { pageIndex: Math.max(0, pagination.page - 1), pageSize: pagination.pageSize }
    : undefined;

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      pagination: tablePagination,
    },
    pageCount,
    manualPagination: !!pagination,
    enableRowSelection: !!selection,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(next);
      if (selection) {
        const selectedIds = Object.keys(next)
          .filter((key) => next[key])
          .map((idx) => data[Number(idx)]?.id)
          .filter(Boolean);
        selection.onSelectionChange(selectedIds);
      }
    },
    onPaginationChange: (updater) => {
      if (!pagination) return;
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex: pagination.page - 1, pageSize: pagination.pageSize })
          : updater;
      pagination.onPageChange(next.pageIndex + 1);
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
  });

  const rows = table.getRowModel().rows;
  const currentPage = pagination ? pagination.page : 1;
  const totalPages = pageCount;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="overflow-x-auto rounded-md border border-border/50 bg-card">
        <table className="w-full min-w-max caption-bottom text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className={cn(
                      'h-10 px-4 text-left align-middle font-medium text-muted-foreground',
                      (header.column.columnDef.meta?.stickyRight ??
                        header.column.id === 'actions') &&
                        'sticky right-0 z-20 border-l border-border/50 bg-muted shadow-[-6px_0_8px_-6px_rgb(0_0_0/0.15)]'
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              Array.from({ length: pagination?.pageSize ?? 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((_, ci) => (
                    <td key={ci} className="px-4 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className={cn(
                    'group transition-colors hover:bg-muted/50',
                    row.getIsSelected() && 'bg-muted'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-3 align-middle',
                        (cell.column.columnDef.meta?.stickyRight ??
                          cell.column.id === 'actions') &&
                          'sticky right-0 z-10 border-l border-border/50 bg-card shadow-[-6px_0_8px_-6px_rgb(0_0_0/0.15)] group-hover:bg-muted/60 group-data-[state=selected]:bg-muted'
                      )}
                    >
                      <DataTableCellContent
                        columnId={cell.column.id}
                        meta={cell.column.columnDef.meta}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </DataTableCellContent>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="text-sm text-muted-foreground">
            {pagination.onPageSizeChange
              ? `Total ${pagination.total} items`
              : `Page ${currentPage} of ${totalPages}`}
          </div>
          <div className="flex items-center gap-2">
            {pagination.onPageSizeChange && (
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(v) => pagination.onPageSizeChange?.(Number(v))}
              >
                <SelectTrigger className="h-8 w-[110px]" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(pagination.pageSizeOptions ?? [10, 20, 50]).map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <PaginationButton
              aria-label="First page"
              disabled={currentPage <= 1}
              onClick={() => pagination.onPageChange(1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </PaginationButton>
            <PaginationButton
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => pagination.onPageChange(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </PaginationButton>
            <PaginationButton
              aria-label="Next page"
              disabled={currentPage >= totalPages}
              onClick={() => pagination.onPageChange(currentPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </PaginationButton>
            <PaginationButton
              aria-label="Last page"
              disabled={currentPage >= totalPages}
              onClick={() => pagination.onPageChange(totalPages)}
            >
              <ChevronsRight className="h-4 w-4" />
            </PaginationButton>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationButton({
  children,
  disabled,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-sm font-medium',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        disabled && 'pointer-events-none opacity-50'
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
