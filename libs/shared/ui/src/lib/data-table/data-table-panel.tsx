'use client';

import * as React from 'react';
import { cn } from '@myorg/shared/util-classnames';
import { DataTable } from './data-table';
import type { DataTablePanelProps } from './data-table.types';

/**
 * Admin list panel that composes header, filters, state messaging, and DataTable.
 *
 * The panel is intentionally presentation-only: callers own API requests,
 * query state, filtering, permissions, routing, and mutation invalidation.
 */
export function DataTablePanel<TData extends { id: string }>({
  title,
  extra,
  filter,
  columns,
  data,
  isLoading = false,
  error,
  emptyMessage,
  pagination,
  selection,
  className,
}: DataTablePanelProps<TData>) {
  const hasHeader = Boolean(title || extra);
  const errorId = React.useId();

  return (
    <section
      className={cn('rounded-md border bg-background', className)}
      aria-busy={isLoading || undefined}
      aria-describedby={error ? errorId : undefined}
    >
      {hasHeader && (
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <div className="min-w-0 text-sm font-semibold text-foreground">
              {title}
            </div>
          )}
          {extra && <div className="shrink-0">{extra}</div>}
        </div>
      )}

      {filter && <div className="border-b px-4 py-4">{filter}</div>}

      {error && (
        <div
          id={errorId}
          role="alert"
          className="border-b bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="p-4">
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          pagination={pagination}
          selection={selection}
          emptyMessage={emptyMessage}
        />
      </div>
    </section>
  );
}
