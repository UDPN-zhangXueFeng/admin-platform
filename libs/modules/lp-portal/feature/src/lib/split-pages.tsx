'use client';

/**
 * 我的分成页（G3 流动性组，源 `src/views/split/index.vue` 1:1 迁移，
 * 迁移矩阵 §D8 双卡片页）。
 *
 * 源语义保真点：
 * - ⚠️ SyncRefresh 域陷阱（迁移矩阵 E-6）：本页 sync 域是 **'pair' 不是
 *   'split'**——后端没有独立 split 同步域，分成数据随货币对域刷新。回调对应
 *   源 @refreshed="loadAll"：比例卡与明细卡同时重拉，且明细保持当前页码；
 * - 卡1 当前生效比例 6 列：货币对(pairCode||pairId)、方向、我的分成比例
 *   （overridden 追加警示标）、对默认比例、状态、数据时间；
 * - 卡2 分成明细分页 pageSize10（layout total,prev,pager,next）；header 右
 *   汇总行 `N entries · Markup total X · My split Y`；响应不走 ResultData
 *   包装（split/detail 域 api 层注释详述）；筛选「查询」恒回第 1 页；
 * - datetimerange 等价件：源 el-date-picker value-format='x'（毫秒字符串）
 *   提交时转 Number——本仓以 start/end 双 datetime-local 承接，同样得到
 *   毫秒 number（settle/tx-flow 同款约定）。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
} from '@myorg/shared/ui';
import {
  FormField,
  FormSelect,
  type SelectOption,
} from '@myorg/shared/ui-forms';

import {
  LP_PROJECT_ID,
  SPLIT_PAIR_STATUS_LABEL,
  SPLIT_PAIR_STATUS_VARIANT,
  useSplitDetailQuery,
  useSplitRatiosQuery,
  type SplitDetailRow,
  type SplitRow,
} from '@myorg/modules/lp-portal/data-access';

import { SyncRefreshButton } from './sync-refresh-button';
import { formatMoney, formatTime } from './format';

/* ================================================================== */
/* 常量与筛选表单                                                       */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'）。 */
const PAGE_SIZE = 10;

const LBL = {
  eyebrow: 'BUSINESS',
  title: 'My Split',
  ratiosCard: 'Current Effective Ratios',
  detailCard: 'Split Details',
  query: 'Search',
  reset: 'Reset',
  emptyRatios: 'Not participating in any currency pairs yet',
  emptyDetail: 'No split records',
} as const;

/** 下拉「全部」哨兵（FormSelect 禁空 value；非 ALL 即转实参查询）。 */
const ALL = 'all';

interface SplitFilterForm {
  pairCode: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FILTER: SplitFilterForm = {
  pairCode: ALL,
  startTime: '',
  endTime: '',
};

/** 已提交明细查询参数（undefined 字段不进请求体 data 包）。 */
interface DetailParams {
  pageNum: number;
  pairCode?: string;
  startTime?: number;
  endTime?: number;
}

/* ================================================================== */
/* 渲染辅助                                                             */
/* ================================================================== */

/**
 * 比率（0〜1 小数）→ 百分比文本，2 位小数（源 percentText）；
 * null/空串显 '-'。
 */
function percentText(v: number | string | null | undefined): string {
  return v === null || v === undefined || v === ''
    ? '-'
    : `${(Number(v) * 100).toFixed(2)}%`;
}

/** 金额单元格：formatMoney + 右对齐（源金额列 align="right"）。 */
function MoneyCell({ v }: { v: number }) {
  return (
    <span className="block text-right font-mono text-xs tabular-nums">
      {formatMoney(v)}
    </span>
  );
}

/* ================================================================== */
/* 列表页                                                               */
/* ================================================================== */

export function SplitListPage() {
  const { register, handleSubmit, reset, control } = useForm<SplitFilterForm>({
    defaultValues: EMPTY_FILTER,
  });

  // ===== 卡1 当前生效比例 =====
  const ratioQuery = useSplitRatiosQuery(PROJECT_ID);
  const ratioRows = ratioQuery.data ?? [];

  // ===== 卡2 分成明细分页 =====
  const [params, setParams] = React.useState<DetailParams>({
    pageNum: 1,
  });
  const detailQuery = useSplitDetailQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize: PAGE_SIZE,
    filter: {
      pairCode: params.pairCode,
      startTime: params.startTime,
      endTime: params.endTime,
    },
  });
  const detailRows = detailQuery.data?.rows ?? [];
  const detailTotal = detailQuery.data?.total ?? 0;
  const summary = detailQuery.data?.summary;

  /**
   * 货币对下拉（options 取自卡1 rows，label/value = pairCode || String(pairId)，
   * 源 value=pairCode||'' 的等价实现）：无 pairCode 的行用 String(pairId) 占位
   * 以满足 Radix Select 禁空 value 的契约，提交时经 resolvePairCode 还原为源
   * 口径的 ''（筛「无码行」）/ 实码。
   */
  const pairOptions = React.useMemo<SelectOption[]>(
    () => [
      { value: ALL, label: 'All Currency Pairs' },
      ...ratioRows.map((r) => {
        const text = r.pairCode || String(r.pairId);
        return { value: text, label: text };
      }),
    ],
    [ratioRows],
  );

  function resolvePairCode(v: string): string | undefined {
    if (v === ALL) return undefined;
    const selected = ratioRows.find(
      (r) => r.pairCode === v || String(r.pairId) === v,
    );
    if (!selected) return undefined;
    // 源口径保真：选中无码行时筛选值是空串（而非 pairId 文本）
    return selected.pairCode || '';
  }

  /** 源「查询」= loadDetail(1)：无条件回第 1 页重查。 */
  const submitDetail = React.useCallback(
    (next: DetailParams) => {
      const unchanged =
        next.pageNum === params.pageNum &&
        next.pairCode === params.pairCode &&
        next.startTime === params.startTime &&
        next.endTime === params.endTime;
      if (unchanged) {
        void detailQuery.refetch();
        return;
      }
      setParams(next);
    },
    [params, detailQuery],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {LBL.eyebrow}
          </div>
          <h1 className="text-xl font-semibold">{LBL.title}</h1>
        </div>
        {/*
         * ⚠️ 源陷阱保真：sync 域是 'pair' 不是 'split'（后端复用货币对同步域，
         * 本域无独立刷新端点——迁移矩阵 E-6）。onRefreshed 即源 loadAll：
         * 两卡一起重拉，refetch 复用当前 key（含明细当前 pageNum），不回跳首页。
         */}
        <SyncRefreshButton
          domain="pair"
          onRefreshed={() => {
            void ratioQuery.refetch();
            void detailQuery.refetch();
          }}
        />
      </div>

      {/* ===== 卡1 当前生效比例 ===== */}
      <Card>
        <CardHeader>
          <CardTitle>{LBL.ratiosCard}</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <RatioTable rows={ratioRows} loading={ratioQuery.isPending} />
        </CardContent>
      </Card>

      {/* ===== 卡2 分成明细 ===== */}
      <Card>
        <CardHeader>
          <CardTitle>{LBL.detailCard}</CardTitle>
          {/* header 右汇总行（随分页响应下发的时间窗汇总，formatMoney 口径） */}
          {summary && (
            <span className="text-sm text-muted-foreground">
              <span className="tabular-nums">{detailTotal}</span> entries ·
              Markup total{' '}
              <span className="font-mono tabular-nums">
                {formatMoney(summary.markupTotal)}
              </span>{' '}
              · My split{' '}
              <span className="font-mono tabular-nums">
                {formatMoney(summary.lpSplitTotal)}
              </span>
            </span>
          )}
        </CardHeader>
        <CardContent className="pb-6">
          <form
            onSubmit={handleSubmit((f) =>
              submitDetail({
                pageNum: 1,
                pairCode: resolvePairCode(f.pairCode),
                startTime: f.startTime
                  ? new Date(f.startTime).getTime()
                  : undefined,
                endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
              }),
            )}
            className="mb-4"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormSelect
                name="pairCode"
                control={control}
                label="Currency Pair"
                options={pairOptions}
              />
              {/* 源 datetimerange(value-format='x')：双字段承接，提交转毫秒 number */}
              <FormField
                name="startTime"
                label="Start Time"
                type="datetime-local"
                register={register('startTime')}
              />
              <FormField
                name="endTime"
                label="End Time"
                type="datetime-local"
                register={register('endTime')}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit">{LBL.query}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset(EMPTY_FILTER);
                  submitDetail({ pageNum: 1 });
                }}
              >
                {LBL.reset}
              </Button>
            </div>
          </form>

          <DetailTable
            rows={detailRows}
            loading={detailQuery.isPending}
            total={detailTotal}
            pageNum={params.pageNum}
            onPageChange={(pageNum) =>
              setParams((prev) => ({ ...prev, pageNum }))
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================================================== */
/* 卡片表格子件                                                         */
/* ================================================================== */

/** 卡1 当前生效比例（6 列；overridden 行内追加警示标，源 el-tag warning「覆盖」）。 */
function RatioTable({ rows, loading }: { rows: SplitRow[]; loading: boolean }) {
  const columns = React.useMemo<ColumnDef<SplitRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'pairId',
        header: 'Currency Pair',
        // pairCode 空回落 pairId 原值（源 row.pairCode || row.pairId）
        cell: ({ row }) => (
          <span>{row.original.pairCode || row.original.pairId}</span>
        ),
      },
      {
        accessorKey: 'sourceCurrency',
        header: 'Direction',
        cell: ({ row }) => (
          <span>
            {row.original.sourceCurrency}→{row.original.targetCurrency}
          </span>
        ),
      },
      {
        accessorKey: 'mySplitRatio',
        header: 'My Split Ratio',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <span className="font-mono text-xs tabular-nums">
              {percentText(row.original.mySplitRatio)}
            </span>
            {row.original.overridden && (
              <Badge variant="outline" className="shrink-0">
                Overridden
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'defaultSplitRatio',
        header: 'Default Ratio',
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {percentText(row.original.defaultSplitRatio)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        // 未知码显原值，variant 兜底 secondary（源 PAIR_STATUS_TEXT/TAG 兜底 info）
        cell: ({ row }) => (
          <Badge
            variant={
              SPLIT_PAIR_STATUS_VARIANT[row.original.status] ?? 'secondary'
            }
          >
            {SPLIT_PAIR_STATUS_LABEL[row.original.status] ??
              row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'syncTime',
        header: 'Synced At',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.syncTime)}
          </span>
        ),
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.pairId) })),
    [rows],
  );

  return (
    <DataTable
      columns={columns}
      data={tableData}
      isLoading={loading}
      emptyMessage={LBL.emptyRatios}
    />
  );
}

/** 卡2 分成明细（8 列分页 pageSize10，layout total,prev,pager,next）。 */
function DetailTable({
  rows,
  loading,
  total,
  pageNum,
  onPageChange,
}: {
  rows: SplitDetailRow[];
  loading: boolean;
  total: number;
  pageNum: number;
  onPageChange: (page: number) => void;
}) {
  const columns = React.useMemo<ColumnDef<SplitDetailRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'settleRecordId',
        header: 'Record ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.settleRecordId}
          </span>
        ),
      },
      {
        accessorKey: 'transactionId',
        header: 'Transaction ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.transactionId}
          </span>
        ),
      },
      {
        accessorKey: 'pairCode',
        header: 'Currency Pair',
        // 无码显 '-'（源 prop 直出列的空串占位等价）
        cell: ({ row }) => <span>{row.original.pairCode || '-'}</span>,
      },
      {
        accessorKey: 'principal',
        header: 'Principal',
        cell: ({ row }) => <MoneyCell v={row.original.principal} />,
      },
      {
        accessorKey: 'markupAmount',
        header: 'Markup Amount',
        cell: ({ row }) => <MoneyCell v={row.original.markupAmount} />,
      },
      {
        accessorKey: 'splitRatio',
        header: 'Split Ratio',
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {percentText(row.original.splitRatio)}
          </span>
        ),
      },
      {
        accessorKey: 'lpSplitAmount',
        header: 'My Split',
        cell: ({ row }) => <MoneyCell v={row.original.lpSplitAmount} />,
      },
      {
        accessorKey: 'completedTime',
        header: 'Completed At',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.completedTime)}
          </span>
        ),
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.settleRecordId) })),
    [rows],
  );

  return (
    <DataTable
      columns={columns}
      data={tableData}
      isLoading={loading}
      emptyMessage={LBL.emptyDetail}
      pagination={{
        page: pageNum,
        pageSize: PAGE_SIZE,
        total,
        onPageChange,
        pageSizeOptions: [PAGE_SIZE],
      }}
    />
  );
}
