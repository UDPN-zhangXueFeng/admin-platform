'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@myorg/shared/ui';
import { Badge, Button, Input, Label } from '@myorg/shared/ui';

/**
 * Column descriptor for {@link MockListPage}.
 */
export interface MockColumn {
  key: string;
  label: string;
}

/**
 * Field descriptor shared by {@link MockDetailPage} and {@link MockFormPage}.
 */
export interface MockField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'date';
  options?: string[];
}

/**
 * Renders a titled card containing a simple Tailwind-styled HTML table of
 * mock rows. Deliberately avoids shadcn `Table` (not exported by the shared
 * UI barrel) — a plain `<table>` keeps the page render path dependency-free
 * and impossible to throw.
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
  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {columns.map((col) => (
                    <th key={col.key} className="whitespace-nowrap px-3 py-2 font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {columns.map((col) => (
                        <td key={col.key} className="whitespace-nowrap px-3 py-2">
                          {row[col.key] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Renders a titled card with a definition-style list of read-only fields.
 */
export function MockDetailPage({
  title,
  description,
  fields,
  data,
}: {
  title: string;
  description?: string;
  fields: MockField[];
  data: Record<string, React.ReactNode>;
}) {
  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="text-sm font-medium">
                  {data[field.key] ?? '—'}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Renders a titled card with a mock form. Submit is a no-op
 * (preventDefault only) — no API calls in mock mode.
 */
export function MockFormPage({
  title,
  description,
  fields,
  submitLabel = '保存',
}: {
  title: string;
  description?: string;
  fields: MockField[];
  submitLabel?: string;
}) {
  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            {fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                {field.type === 'select' && field.options ? (
                  <select
                    id={field.key}
                    defaultValue={field.options[0]}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={field.key}
                    type={field.type === 'number' ? 'number' : 'text'}
                    placeholder={field.label}
                  />
                )}
              </div>
            ))}
            <div className="col-span-full mt-2 flex justify-end">
              <Button type="submit">{submitLabel}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Renders a titled dashboard with a grid of stat cards.
 */
export function MockDashboardPage({
  title,
  description,
  stats,
}: {
  title: string;
  description?: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col gap-2 rounded-lg border bg-card p-4"
              >
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                <span className="text-2xl font-semibold">{stat.value}</span>
                <Badge variant="secondary" className="w-fit">
                  Mock
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
