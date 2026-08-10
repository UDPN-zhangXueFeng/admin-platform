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
 * LP Portal feature 通用 Mock 组件。
 *
 * 说明：
 * - `@myorg/shared/ui` 未导出 Table 组件，列表页使用原生 <table> + Tailwind 渲染，
 *   保证页面在 Mock 模式下零运行时错误。
 * - 所有组件均为客户端组件（页面中可能用到 useRouter 等 hook）。
 */

export interface MockColumn {
  key: string;
  label: string;
}

export interface MockField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'date';
  options?: string[];
}

/**
 * MockListPage —— 标题卡片 + 原生表格 + mock 数据行。
 */
export function MockListPage({
  title,
  description,
  columns,
  rows,
  actionLabel = '新增',
}: {
  title: string;
  description?: string;
  columns: MockColumn[];
  rows: Record<string, React.ReactNode>[];
  actionLabel?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        <Button>{actionLabel}</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {columns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    暂无数据
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                    {columns.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-2">
                        {row[c.key] ?? '-'}
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
  );
}

/**
 * MockDetailPage —— 标题卡片 + 字段描述列表。
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
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        <Button variant="outline">返回</Button>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-sm font-medium">{data[f.key] ?? '-'}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/**
 * MockFormPage —— 标题卡片 + mock 表单（提交仅 preventDefault）。
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
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          {fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <Label htmlFor={f.key}>{f.label}</Label>
              {f.type === 'select' ? (
                <select
                  id={f.key}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={f.key}
                  type={
                    f.type === 'number'
                      ? 'number'
                      : f.type === 'date'
                        ? 'date'
                        : 'text'
                  }
                />
              )}
            </div>
          ))}
          <div className="col-span-full mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline">
              取消
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * MockDashboardPage —— 顶部标题 + 一组 KPI 统计卡片。
 */
export function MockDashboardPage({
  title,
  stats,
}: {
  title: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">{title}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export { Badge };
