'use client';

/**
 * 原型口径客户端排序件（方案 12 §3.3：普通单值列表头可点击排序，点击真实
 * 改变行序）。共享 DataTable 无内建排序（无 getSortedRowModel），各页以
 * 本件 + 自绘表头按钮承接；语义对齐原型 `useClientSort` / `compareBy`：
 * - 数值感知：两侧均可转数字则数值比较，否则 localeCompare；
 * - 空值恒排最后（与方向无关）；
 * - 每列可声明默认方向（时间列默认 desc 等）。
 *
 * 过渡口径：后端分页端点无 sortBy 参数，本域排序为**当前数据集内**本地
 * 排序——分页域仅当前页有效（后端补排序参数后切换）。
 */
import * as React from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@myorg/shared/util-classnames';

/** 单列取值器；defaultDir 缺省 'asc'。 */
export interface ProtoSortGetter<T> {
  value: (row: T) => string | number | null | undefined;
  defaultDir?: 'asc' | 'desc';
}

export interface ProtoSortState {
  key: string | null;
  dir: 'asc' | 'desc';
}

/** 数值感知比较器（原型 compareBy：空值恒排最后，与方向无关）。 */
export function protoCompare<T>(
  getValue: (row: T) => string | number | null | undefined,
  dir: 'asc' | 'desc',
): (a: T, b: T) => number {
  return (a, b) => {
    const va = getValue(a);
    const vb = getValue(b);
    const aEmpty = va === null || va === undefined || va === '';
    const bEmpty = vb === null || vb === undefined || vb === '';
    let result: number;
    if (aEmpty && bEmpty) result = 0;
    else if (aEmpty) result = 1;
    else if (bEmpty) result = -1;
    else {
      const na = Number(va);
      const nb = Number(vb);
      result =
        Number.isFinite(na) && Number.isFinite(nb)
          ? na - nb
          : String(va).localeCompare(String(vb));
    }
    return dir === 'asc' ? result : -result;
  };
}

/**
 * 客户端排序 hook（原型 useClientSort 等价）：
 * - `defaultKey: null` 起始为自然序；否则按该列 defaultDir 起排；
 * - toggle 未激活列 → 该列默认方向；已激活列 → asc/desc 互换；
 * - `triState` 时已激活列在 asc/desc 后第三击回到自然序（原型审批列表口径）；
 * - items 引用变化重算排序，不重置当前排序状态。
 */
export function useProtoSort<T>(
  items: T[],
  getters: Record<string, ProtoSortGetter<T>>,
  defaultKey: string | null,
  defaultDir: 'asc' | 'desc' = 'desc',
  triState = false,
) {
  const [sort, setSort] = React.useState<ProtoSortState>({
    key: defaultKey,
    dir: defaultDir,
  });

  const toggle = React.useCallback(
    (key: string) => {
      setSort((current) => {
        if (current.key !== key) {
          return { key, dir: getters[key]?.defaultDir ?? 'asc' };
        }
        // 三态：默认方向 → 反向 → 无（自然序）→ 默认方向
        if (
          triState &&
          current.dir !== (getters[key]?.defaultDir ?? 'asc')
        ) {
          return { key: null, dir: 'asc' };
        }
        return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
      });
    },
    // getters 为页内字面量（每渲染新引用），语义上按 key 稳定；此处不以其为依赖。
    [getters, triState],
  );

  const sortState = React.useCallback(
    (key: string): 'none' | 'ascending' | 'descending' =>
      sort.key !== key
        ? 'none'
        : sort.dir === 'desc'
          ? 'descending'
          : 'ascending',
    [sort],
  );

  const sorted = React.useMemo(() => {
    const getter = sort.key ? getters[sort.key] : undefined;
    if (!getter) return items;
    return [...items].sort(protoCompare(getter.value, sort.dir));
  }, [items, sort, getters]);

  return { sorted, toggle, sortState };
}

/**
 * 可排序表头按钮（配合无内建排序的 DataTable）：图标三态
 * （↑ 激活升序 / ↓ 激活降序 / ⇅ 未激活）；右对齐列外层套
 * `<div className="flex justify-end">`。
 */
export function ProtoSortHeader({
  label,
  columnKey,
  toggle,
  sortState,
  className,
}: {
  label: React.ReactNode;
  columnKey: string;
  toggle: (key: string) => void;
  sortState: 'none' | 'ascending' | 'descending';
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => toggle(columnKey)}
      aria-label={`Sort by ${String(columnKey)}`}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      {label}
      {sortState === 'ascending' ? (
        <ChevronUp className="size-3.5" aria-hidden="true" />
      ) : sortState === 'descending' ? (
        <ChevronDown className="size-3.5" aria-hidden="true" />
      ) : (
        <ArrowUpDown className="size-3.5 opacity-60" aria-hidden="true" />
      )}
    </button>
  );
}
