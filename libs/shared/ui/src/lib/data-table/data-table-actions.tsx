'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@myorg/shared/util-classnames';
import { Button } from '../button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../dropdown-menu';

/** A single row-level action rendered by {@link createActionColumn}. */
export interface TableRowAction<TData> {
  /** Action label shown on the button / menu item. */
  label: string;
  onClick: (row: TData) => void;
  /** Renders the label in destructive (red) styling. */
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * Standard table action column.
 *
 * Rendering rule (requirement): exactly one action renders as an inline link
 * button; two or more collapse into a Radix DropdownMenu triggered by a
 * "⋯" icon button. The column pins to the right edge when the table scrolls
 * horizontally (`stickyRight` meta, honoured by DataTable).
 *
 * Callers control per-row visibility by returning fewer/more items from
 * `actions` (e.g. only expose "Resolve" on exception rows).
 */
export function createActionColumn<TData extends { id: string }>(
  actions: (row: TData) => TableRowAction<TData>[],
  headerLabel = 'Actions',
): ColumnDef<TData> {
  return {
    id: 'actions',
    header: headerLabel,
    enableSorting: false,
    meta: { overflow: 'none', stickyRight: true },
    cell: ({ row }) => {
      const items = actions(row.original);
      if (items.length === 0) return null;

      if (items.length === 1) {
        const action = items[0];
        return (
          <Button
            variant="link"
            size="sm"
            className={cn('h-auto p-0', action.destructive && 'text-destructive')}
            disabled={action.disabled}
            onClick={() => action.onClick(row.original)}
          >
            {action.label}
          </Button>
        );
      }

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Row actions"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {items.map((action) => (
              <DropdownMenuItem
                key={action.label}
                disabled={action.disabled}
                className={cn(
                  action.destructive &&
                    'text-destructive focus:text-destructive',
                )}
                onClick={() => action.onClick(row.original)}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  };
}
