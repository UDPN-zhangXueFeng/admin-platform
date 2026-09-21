'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../data-table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../card';
import { Button } from '../button';
import { Input } from '../input';
import { Label } from '../label';

/* -------------------------------------------------------------------------- */
/*  Type descriptors                                                           */
/* -------------------------------------------------------------------------- */

/** Column descriptor for mock list tables. */
export interface MockColumn {
  key: string;
  label: string;
}

/** Field descriptor for detail grids and forms. */
export interface MockField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'date';
  options?: string[];
}

/* -------------------------------------------------------------------------- */
/*  Internal helpers for DataTable integration                                 */
/* -------------------------------------------------------------------------- */

/** Row shape after id-injection to satisfy DataTable's `{ id: string }` contract. */
type MockTableRow = { id: string } & Record<string, React.ReactNode>;

/**
 * Convert simple column descriptors into TanStack ColumnDefs.
 *
 * Each column is a *display* column (no accessor) whose `cell` reads the
 * pre-computed ReactNode from `row.original[col.key]`. This lets mock pages
 * pass JSX (badges, links) directly without defining accessor functions.
 */
function buildColumns(columns: MockColumn[]): ColumnDef<MockTableRow>[] {
  return columns.map((col) => ({
    id: col.key,
    header: col.label,
    cell: ({ row }) => (row.original[col.key] ?? '-') as React.ReactNode,
  }));
}

/** Inject synthetic `id` (row index) into each row. */
function withIds(rows: Record<string, React.ReactNode>[]): MockTableRow[] {
  return rows.map((row, idx) => ({ id: String(idx), ...row }));
}

/* -------------------------------------------------------------------------- */
/*  MockListPage — Card + DataTable                                             */
/* -------------------------------------------------------------------------- */

/**
 * Mock list page — a Card wrapping a shared DataTable.
 *
 * Uses the same DataTable component as production admin pages, giving mock
 * tables identical styling (rounded border, muted header, hover states,
 * skeleton loading, empty message) for free.
 */
export function MockListPage({
  title,
  description,
  columns,
  rows,
}: {
  title: string;
  description?: string;
  columns: MockColumn[];
  rows: Record<string, React.ReactNode>[];
}) {
  const tableColumns = React.useMemo(() => buildColumns(columns), [columns]);
  const tableRows = React.useMemo(() => withIds(rows), [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <DataTable columns={tableColumns} data={tableRows} />
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  MockDetailPage — Card + label/value grid                                    */
/* -------------------------------------------------------------------------- */

/** Mock detail page — a Card with a title and a grid of label/value pairs. */
export function MockDetailPage({
  title,
  fields,
  data,
}: {
  title: string;
  fields: MockField[];
  data: Record<string, React.ReactNode>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {field.label}
              </span>
              <span className="text-sm font-medium">
                {data[field.key] ?? '-'}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  MockFormPage — Card + read-only form                                        */
/* -------------------------------------------------------------------------- */

/**
 * Mock form page — a Card with a form built from shared Input/Label.
 * Submit is intercepted (no network).
 */
export function MockFormPage({
  title,
  fields,
  submitLabel = 'Submit',
}: {
  title: string;
  fields: MockField[];
  submitLabel?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-2">
              <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
              <Input
                id={`field-${field.key}`}
                type={field.type === 'number' ? 'number' : 'text'}
                placeholder={field.label}
              />
            </div>
          ))}
          <div className="col-span-full mt-2">
            <Button type="submit">{submitLabel}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  MockDashboardPage — grid of stat cards                                      */
/* -------------------------------------------------------------------------- */

/** Mock dashboard page — a heading and a grid of stat cards. */
export function MockDashboardPage({
  title,
  stats,
}: {
  title: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stat.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
