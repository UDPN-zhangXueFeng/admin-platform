'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  DataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';

import {
  LP_PROJECT_ID,
  isServiceDown,
  useLpRateListQuery,
  RATE_PAIR_STATUS_LABEL,
  RATE_PAIR_STATUS_VARIANT,
  type RateRow,
} from '@myorg/modules/lp-portal/data-access';

import { formatTime } from './format';
import { ServiceDownAlert } from './service-down-alert';

/* ------------------------------------------------------------------ *
 * 汇率（rate）— 全量拉取 + 客户端过滤/排序（源 src/views/rate/index.vue）
 * Menu key: lp:rate  Path: /rate  Page keys: list (list only, 只读)
 * ------------------------------------------------------------------ */

/**
 * 货币对筛选「全部」哨兵值（shadcn Select 无原生 clearable；
 * 源 el-select clearable 清空后非 number 值统一视为不过滤）。
 */
const PAIR_ALL = 'ALL';

/**
 * 参与行整行高亮（源 .row-participated td：常青绿浅底 0.04 / hover 0.08）。
 *
 * DataTable 无斑马纹（无 stripe 冲突），但也不暴露 row-class 钩子，
 * 故经 :has() 选择器从表格容器挂到含 data-row-participated 标记的行；
 * hover 变体选择器多一个伪类，特异性高于默认 hover:bg-muted/50。
 */
const ROW_HIGHLIGHT_CLASS =
  '[&_tr:has([data-row-participated])]:bg-[rgba(11,107,83,0.04)] [&_tr:has([data-row-participated]):hover]:bg-[rgba(11,107,83,0.08)]';

/** 汇率列表列定义（列序/文案照源；汇率三值原值直出，null → '-'）。 */
const columns: ColumnDef<RateRow & { id: string }>[] = [
  {
    accessorKey: 'sourceCurrency',
    header: '货币对',
    cell: ({ row }) => (
      <span
        className="inline-flex items-center gap-2"
        data-row-participated={row.original.participated || undefined}
      >
        <span>
          {row.original.sourceCurrency}→{row.original.targetCurrency}
        </span>
        {row.original.participated ? <Badge>参与中</Badge> : null}
      </span>
    ),
  },
  {
    accessorKey: 'baseRate',
    header: '基础汇率',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.baseRate ?? '-'}</span>
    ),
  },
  {
    accessorKey: 'markupRate',
    header: '加价率',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.markupRate ?? '-'}</span>
    ),
  },
  {
    accessorKey: 'userRate',
    header: '用户汇率',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.userRate ?? '-'}</span>
    ),
  },
  {
    accessorKey: 'pairStatus',
    header: '货币对状态',
    cell: ({ row }) => (
      <Badge
        variant={
          RATE_PAIR_STATUS_VARIANT[row.original.pairStatus] ?? 'secondary'
        }
      >
        {RATE_PAIR_STATUS_LABEL[row.original.pairStatus] ??
          String(row.original.pairStatus)}
      </Badge>
    ),
  },
  {
    accessorKey: 'updateTime',
    header: '更新时间',
    cell: ({ row }) => <span>{formatTime(row.original.updateTime)}</span>,
  },
];

export function RateListPage() {
  // 货币对筛选为客户端过滤（rate/list 全量返回，不发二次请求）
  const [filterPairId, setFilterPairId] = React.useState<number | null>(null);

  const query = useLpRateListQuery(LP_PROJECT_ID);
  const rows = query.data ?? [];

  // 0024 → 页面级降级条（traceId）；成功/非 0024 失败均清除，旧数据保留（源 down 语义）
  const down = React.useMemo(() => {
    const err = query.error;
    return err && isServiceDown(err) ? { traceId: err.traceId } : null;
  }, [query.error]);

  // 选项取已加载行按 pairId 去重（首个出现者）
  const pairOptions = React.useMemo(() => {
    const map = new Map<number, RateRow>();
    for (const r of rows) {
      if (!map.has(r.pairId)) map.set(r.pairId, r);
    }
    return [...map.values()];
  }, [rows]);

  // 参与行置顶；同组内按 updateTime 降序（null 按 0 垫底，无汇率行的货币对沉底）
  const displayRows = React.useMemo(() => {
    const list =
      filterPairId != null
        ? rows.filter((r) => r.pairId === filterPairId)
        : rows.slice();
    return list.sort((a, b) => {
      if (a.participated !== b.participated) return a.participated ? -1 : 1;
      return (b.updateTime ?? 0) - (a.updateTime ?? 0);
    });
  }, [rows, filterPairId]);

  // DataTable 要求 id: string；行无唯一主键，取 pairId（同 pairId 多行仅展示，不参与选择）
  const tableData = React.useMemo(
    () => displayRows.map((r) => ({ ...r, id: String(r.pairId) })),
    [displayRows],
  );

  return (
    <div className="space-y-4">
      {down ? <ServiceDownAlert traceId={down.traceId} /> : null}

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">汇率</div>
        </div>

        {/* 货币对筛选：computed 响应式即时过滤，无查询/重置按钮（源同） */}
        <div className="flex items-center gap-3 border-b px-6 py-3">
          <label className="text-sm text-muted-foreground" htmlFor="rate-pair-filter">
            货币对
          </label>
          <Select
            value={filterPairId == null ? PAIR_ALL : String(filterPairId)}
            onValueChange={(v) =>
              setFilterPairId(v === PAIR_ALL ? null : Number(v))
            }
          >
            <SelectTrigger id="rate-pair-filter" className="w-[200px]">
              <SelectValue placeholder="全部货币对" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PAIR_ALL}>全部货币对</SelectItem>
              {pairOptions.map((p) => (
                <SelectItem key={p.pairId} value={String(p.pairId)}>
                  {p.sourceCurrency}→{p.targetCurrency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 无分页（rate/list 不分页全量返回） */}
        <DataTable
          className={ROW_HIGHLIGHT_CLASS}
          columns={columns}
          data={tableData}
          isLoading={query.isLoading}
          emptyMessage="暂无数据"
        />
      </div>
    </div>
  );
}
