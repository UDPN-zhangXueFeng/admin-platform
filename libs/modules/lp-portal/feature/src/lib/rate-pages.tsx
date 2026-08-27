'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';

import { Badge, Checkbox, DataTable, Input } from '@myorg/shared/ui';

import {
  LP_PROJECT_ID,
  RATE_PAIR_STATUS_LABEL,
  RATE_PAIR_STATUS_VARIANT,
  isServiceDown,
  useLpRateListQuery,
  type RateRow,
} from '@myorg/modules/lp-portal/data-access';

import { formatTime } from './format';
import { ServiceDownAlert } from './service-down-alert';
import { SyncRefreshButton } from './sync-refresh-button';

/* ------------------------------------------------------------------ *
 * 汇率（rate）— 全量拉取 + 客户端过滤/排序（源 src/views/rate/index.vue，
 * 01 §D6）Menu key: lp:rate  Path: /rate  Page keys: list (只读)
 * ------------------------------------------------------------------ */

const LBL = {
  eyebrow: 'MARKET',
  title: 'Rates',
  keywordLabel: 'Currency Pair',
  keywordPlaceholder: 'Filter by code or token',
  onlyMine: 'Only my participation',
  participating: 'Participating',
  empty: 'No rate data',
} as const;

/**
 * 百分比两位小数：源 percentText：(v*100).toFixed(2)%，空值 → '-'。
 * 加价率与对默认分成共用同一口径（加价率 **2 位小数** 为 §D6 硬要求），
 * 4 处调用锁步，故独立命名公式而非内联。
 */
function percentText(v: string | number | null | undefined): string {
  return v == null || v === '' ? '-' : `${(Number(v) * 100).toFixed(2)}%`;
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 数值文本（源 .num 类：等宽 + 表格数字对齐；pair-pages 同款构件）。 */
function Num({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs tabular-nums">{children}</span>
  );
}

/** 右对齐数值列表头（Base/Markup/User/Split 四列锁步）。 */
function NumHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-right">{children}</div>;
}

/** 货币对状态：pairStatus===20 生效 success，否则停用 info（未知码显原值）。 */
function PairStatusBadge({ status }: { status: number }) {
  const variant: BadgeVariant =
    RATE_PAIR_STATUS_VARIANT[status] ?? 'secondary';
  return (
    <Badge variant={variant}>
      {RATE_PAIR_STATUS_LABEL[status] ?? String(status)}
    </Badge>
  );
}

/** 汇率列表 9 列定义（列序/文案照源 §D6；四个比率列右对齐）。 */
const columns: ColumnDef<RateRow & { id: string }>[] = [
  {
    accessorKey: 'pairCode',
    header: 'Token Pair',
    cell: ({ row }) => <Num>{row.original.pairCode}</Num>,
  },
  {
    id: 'direction',
    header: 'Direction',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.sourceTokenCode} → {row.original.targetTokenCode}
      </span>
    ),
  },
  {
    accessorKey: 'baseRate',
    header: () => <NumHeader>Base Rate</NumHeader>,
    // 汇率原值直出（无汇率行时 null → '-'，后端 D-4），React 渲染数字无需 String()
    cell: ({ row }) => (
      <Num>
        <span className="block text-right">
          {row.original.baseRate ?? '-'}
        </span>
      </Num>
    ),
  },
  {
    accessorKey: 'markupRate',
    header: () => <NumHeader>Markup Rate</NumHeader>,
    cell: ({ row }) => (
      <Num>
        <span className="block text-right">
          {percentText(row.original.markupRate)}
        </span>
      </Num>
    ),
  },
  {
    accessorKey: 'userRate',
    header: () => <NumHeader>User Rate</NumHeader>,
    cell: ({ row }) => (
      <Num>
        <span className="block text-right">
          {row.original.userRate ?? '-'}
        </span>
      </Num>
    ),
  },
  {
    accessorKey: 'defaultSplitRatio',
    header: () => <NumHeader>Default Split</NumHeader>,
    cell: ({ row }) => (
      <Num>
        <span className="block text-right">
          {percentText(row.original.defaultSplitRatio)}
        </span>
      </Num>
    ),
  },
  {
    accessorKey: 'pairStatus',
    header: 'Status',
    cell: ({ row }) => <PairStatusBadge status={row.original.pairStatus} />,
  },
  {
    accessorKey: 'participated',
    header: 'My Participation',
    cell: ({ row }) =>
      row.original.participated ? (
        <Badge>{LBL.participating}</Badge>
      ) : (
        <span>-</span>
      ),
  },
  {
    accessorKey: 'syncTime',
    header: 'Data Time',
    cell: ({ row }) => <Num>{formatTime(row.original.syncTime)}</Num>,
  },
];

export function RateListPage() {
  const [keyword, setKeyword] = React.useState('');
  const [onlyParticipated, setOnlyParticipated] = React.useState(false);

  const query = useLpRateListQuery(LP_PROJECT_ID);

  // 0024 → 页面级降级条（traceId）；成功/非 0024 失败均清除，旧数据保留（源 down 语义）
  const down = React.useMemo(() => {
    const err = query.error;
    return err && isServiceDown(err) ? { traceId: err.traceId } : null;
  }, [query.error]);

  // SyncRefreshButton 成功后重拉当前视图；客户端过滤不发二次请求、过滤态保持
  const handleRefreshed = React.useCallback(() => {
    void query.refetch();
  }, [query]);

  // 源 filtered computed 三段链：participated 过滤 → 关键词（pairCode/source/
  // target includes lowercase）→ 参与置顶稳定排序（未参与者保持原序）
  const displayRows = React.useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return (query.data ?? [])
      .filter((r) => (onlyParticipated ? r.participated : true))
      .filter(
        (r) =>
          !kw ||
          r.pairCode.toLowerCase().includes(kw) ||
          r.sourceTokenCode.toLowerCase().includes(kw) ||
          r.targetTokenCode.toLowerCase().includes(kw),
      )
      .sort((a, b) => Number(b.participated) - Number(a.participated));
  }, [query.data, keyword, onlyParticipated]);

  // DataTable 要求 id: string；行主键取 pairId
  const tableData = React.useMemo(
    () => displayRows.map((r) => ({ ...r, id: String(r.pairId) })),
    [displayRows],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {LBL.eyebrow}
          </div>
          <h1 className="text-xl font-semibold">{LBL.title}</h1>
        </div>
        <SyncRefreshButton domain="rate" onRefreshed={handleRefreshed} />
      </div>

      {down && <ServiceDownAlert traceId={down.traceId} />}

      <div className="rounded-lg border-border/60 bg-card text-card-foreground shadow-float">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <label
              className="text-sm text-muted-foreground"
              htmlFor="rate-keyword-filter"
            >
              {LBL.keywordLabel}
            </label>
            <Input
              id="rate-keyword-filter"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={LBL.keywordPlaceholder}
              className="h-8 w-full max-w-[220px]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={onlyParticipated}
              onCheckedChange={(v) => setOnlyParticipated(v === true)}
            />
            {LBL.onlyMine}
          </label>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={query.isPending}
          emptyMessage={LBL.empty}
        />
      </div>
    </div>
  );
}
