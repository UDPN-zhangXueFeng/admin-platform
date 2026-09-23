'use client';

/**
 * 原型口径表格公共件（BP PageKit.jsx 的 useTableColumnPreferences /
 * TableColumnPicker / toggleSort / sortList 行为规格，本仓 DataTable 体系重实现）。
 *
 * - SortHeader / useTableSort：表头三态排序（同键翻转 asc/desc，新键用调用方
 *   defaultDirection）。
 * - compareProtoValues：原型 sortList 比较（两侧非空且可数值化 → 数值比，
 *   否则字符串比）。
 * - useColumnPreferences / ColumnPicker / ProtoColumnDef：列偏好持久化 +
 *   列选择器（required 必显不可隐藏）。
 * 使用方：token-pages（列偏好 + 排序）、fx-pages / bank-query-pages（排序）。
 */
import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from 'lucide-react';

import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

/** 列契约：required = 必显（主标识/状态/操作）；defaultVisible 缺省 true。 */
export type ProtoColumnDef = {
  id: string;
  label: string;
  required?: boolean;
  defaultVisible?: boolean;
};

/** 原型 sortList 比较口径：两侧非空且可数值化 → 数值比，否则字符串比。 */
export function compareProtoValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  const av = a ?? '';
  const bv = b ?? '';
  const an = Number(av);
  const bn = Number(bv);
  return av !== '' && bv !== '' && !Number.isNaN(an) && !Number.isNaN(bn)
    ? an - bn
    : String(av).localeCompare(String(bv));
}

export type TableSort = { key: string | null; direction: 'asc' | 'desc' };

/** 表头排序（原型 toggleSort：同键翻转 asc/desc，新键用 defaultDirection）。 */
export function useTableSort(defaultKey: string, defaultDirection: 'asc' | 'desc') {
  const [sort, setSort] = React.useState<TableSort>({
    key: defaultKey,
    direction: defaultDirection,
  });
  const toggle = React.useCallback(
    (key: string, direction: 'asc' | 'desc' = 'asc') => {
      setSort((cur) =>
        cur.key === key
          ? { key, direction: cur.direction === 'asc' ? 'desc' : 'asc' }
          : { key, direction },
      );
    },
    [],
  );
  return { sort, toggle };
}

/** 排序表头：三态图标（原型 Th onSort/sortDirection；数值列右对齐）。 */
export function SortHeader({
  label,
  direction,
  onToggle,
  numeric = false,
}: {
  label: string;
  direction: 'asc' | 'desc' | null;
  onToggle: () => void;
  numeric?: boolean;
}) {
  const Icon =
    direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Sort by ${label}`}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap font-medium text-muted-foreground transition-colors hover:text-foreground',
        numeric && 'w-full justify-end',
      )}
    >
      {label}
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
    </button>
  );
}

/**
 * 列偏好持久化（原型 useTableColumnPreferences 同语义，键名本仓前缀）：
 * 恢复时过滤失效 id 并补齐 required；存储失败不阻断；SSR 安全——挂载后
 * 恢复，避免水合期列集与服务端渲染不一致；恢复前不写回（防默认值覆盖）。
 */
export function useColumnPreferences(
  storageKey: string,
  columns: ProtoColumnDef[],
) {
  const requiredIds = React.useMemo(
    () => columns.filter((c) => c.required).map((c) => c.id),
    [columns],
  );
  const defaultIds = React.useMemo(
    () =>
      columns
        .filter((c) => c.required || c.defaultVisible !== false)
        .map((c) => c.id),
    [columns],
  );
  // null = 尚未从 localStorage 恢复（此时按 defaultIds 渲染但不写回）。
  const [stored, setStored] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    try {
      const raw: unknown = JSON.parse(
        window.localStorage.getItem(storageKey) ?? 'null',
      );
      if (Array.isArray(raw)) {
        const valid = new Set(columns.map((c) => c.id));
        setStored([
          ...new Set([
            ...raw.filter((id): id is string => typeof id === 'string' && valid.has(id)),
            ...requiredIds,
          ]),
        ]);
      } else {
        setStored(defaultIds);
      }
    } catch {
      setStored(defaultIds);
    }
    // columns/requiredIds/defaultIds 为模块级常量派生，挂载期一次性恢复。
    // deps: intentional (see comment above)
  }, [storageKey]);

  React.useEffect(() => {
    if (stored === null) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      // 列偏好为可选能力，存储失败不得阻断表格。
    }
  }, [storageKey, stored]);

  const visible = stored ?? defaultIds;
  const isColumnVisible = React.useCallback(
    (id: string) => visible.includes(id),
    [visible],
  );
  const setColumnVisible = React.useCallback(
    (id: string, next: boolean) => {
      if (requiredIds.includes(id)) return;
      setStored((cur) => {
        const base = cur ?? defaultIds;
        return next
          ? [...new Set([...base, id])]
          : base.filter((c) => c !== id);
      });
    },
    [defaultIds, requiredIds],
  );
  const resetColumns = React.useCallback(
    () => setStored(defaultIds),
    [defaultIds],
  );
  return { visible, isColumnVisible, setColumnVisible, resetColumns };
}

/** 列选择器（原型 TableColumnPicker：图标按钮 + Popover 复选清单 + Reset）。 */
export function ColumnPicker({
  columns,
  isColumnVisible,
  onColumnVisibilityChange,
  onReset,
}: {
  columns: ProtoColumnDef[];
  isColumnVisible: (id: string) => boolean;
  onColumnVisibilityChange: (id: string, visible: boolean) => void;
  onReset: () => void;
}) {
  return (
    <Popover>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Customize Columns"
                className="px-2.5"
              >
                <Columns3 className="size-4" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Customize Columns</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" sideOffset={6} className="w-56 p-2">
        <div className="px-2 pb-2 text-sm font-semibold text-foreground">
          Visible columns
        </div>
        <div className="space-y-0.5">
          {columns.map((column) => (
            <label
              key={column.id}
              className={cn(
                'flex min-h-9 items-center gap-2 rounded-md px-2 text-sm',
                column.required
                  ? 'cursor-not-allowed text-muted-foreground'
                  : 'cursor-pointer text-foreground hover:bg-accent',
              )}
            >
              <Checkbox
                checked={isColumnVisible(column.id)}
                disabled={column.required}
                onCheckedChange={(checked) =>
                  onColumnVisibilityChange(column.id, checked === true)
                }
              />
              {column.label}
            </label>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start"
          onClick={onReset}
        >
          Reset
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** 按列偏好过滤 DataTable columns（required 恒显）。 */
export function filterVisibleColumns<TData>(
  columns: ColumnDef<TData>[],
  defs: ProtoColumnDef[],
  isColumnVisible: (id: string) => boolean,
): ColumnDef<TData>[] {
  return columns.filter((c) => {
    const def = defs.find((t) => t.id === c.id);
    return !def || def.required || isColumnVisible(c.id);
  });
}
