'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Badge,
} from '@myorg/shared/ui';

/** Column descriptor for list tables. */
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

/**
 * MockListPage — a Card containing a title, optional description and a simple
 * HTML table rendered with Tailwind utility classes. No client state.
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="py-2 px-4 text-left font-medium text-muted-foreground"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="py-2 px-4">
                      {row[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * MockDetailPage — a Card with a title and a grid of label/value pairs.
 */
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
              <span className="text-xs text-muted-foreground">{field.label}</span>
              <span className="text-sm font-medium">{data[field.key] ?? '-'}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * MockFormPage — a Card with a title and a read-only form built from the shared
 * Input/Label components. Submit is intercepted (no network).
 */
export function MockFormPage({
  title,
  fields,
  submitLabel = '提交',
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

/**
 * MockDashboardPage — a grid of stat cards. Each stat renders as its own Card.
 */
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
