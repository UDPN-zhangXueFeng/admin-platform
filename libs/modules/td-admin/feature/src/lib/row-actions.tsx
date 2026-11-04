'use client';

import type { ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

/** One row-level action. `detail` renders inline; `menu` items collapse into the ⋮ menu. */
export interface RowAction<TData> {
  label: string;
  onClick: (row: TData) => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface RowActionsOptions<TData> {
  /**
   * Primary inline action (the "Details" button). A function resolves per row and
   * may return undefined to hide it.
   */
  detail?: RowAction<TData> | ((row: TData) => RowAction<TData> | undefined);
  /** Secondary actions, shown in the ⋮ dropdown. */
  menu?: (row: TData) => RowAction<TData>[];
}

/**
 * Renders the actions cell for one row: primary action inline as a link button,
 * remaining actions in a vertical-⋮ dropdown. Returns null when the row has no
 * actions. Use directly when a column needs a per-row placeholder fallback.
 */
export function renderRowActions<TData>(row: TData, { detail, menu }: RowActionsOptions<TData>): ReactNode {
  const primary = typeof detail === 'function' ? detail(row) : detail;
  const items = menu ? menu(row) : [];
  if (!primary && items.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {primary ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          disabled={primary.disabled}
          onClick={() => primary.onClick(row)}
        >
          {primary.label}
        </Button>
      ) : null}
      {items.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Row actions">
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {items.map((action) => (
              <DropdownMenuItem
                key={action.label}
                disabled={action.disabled}
                className={cn(action.destructive && 'text-destructive focus:text-destructive')}
                onClick={() => action.onClick(row)}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export interface RowActionsColumnOptions<TData> extends RowActionsOptions<TData> {
  /** Column header. Defaults to the literal `Actions`. */
  header?: string;
}

/** Actions column built on {@link renderRowActions}. */
export function createRowActionsColumn<TData extends { id: string }>({
  header = 'Actions',
  ...options
}: RowActionsColumnOptions<TData>): ColumnDef<TData> {
  return {
    id: 'actions',
    header,
    enableSorting: false,
    meta: { overflow: 'none', stickyRight: true },
    cell: ({ row }) => renderRowActions(row.original, options),
  };
}
