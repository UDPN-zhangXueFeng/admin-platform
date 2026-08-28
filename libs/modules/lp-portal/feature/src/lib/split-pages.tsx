'use client';

/**
 * 我的分成页（G3 流动性组，源 `src/views/split/index.vue` 1:1 迁移，
 * 迁移矩阵 §D8 双卡片页）。
 *
 * 源语义保真点：
 * - ⚠️ SyncRefresh 域陷阱（迁移矩阵 E-6）：本页 sync 域是 **'pair' 不是
 *   'split'**——后端没有独立 split 同步域，分成数据随货币对域刷新。回调对应
 *   源 @refreshed="loadAll"：比例卡与明细卡同时重拉，且明细保持当前页码；
 * - 卡1 当前生效比例 5 列（v2.3 e591f85）：Token Pair 紧凑式三行（symOf/
 *   symOf mono 加粗行 + bankOf → bankOf 次要色行 + pairCode||pairId 占位色
 *   行，useTokenMeta 统一口径，替代原货币对+方向两列）、我的分成比例
 *   （overridden 追加警示标）、对默认比例、状态、数据时间；
 * - 卡2 分成明细 7 列（v2.3）：交易单号 txNoText||'-'（等宽+溢出 tooltip）
 *   替代原流水ID/交易ID 两列；分页 pageSize10（layout total,prev,pager,next）；
 *   header 右
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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
  txNoText,
  useTokenMeta,
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

/** 金额单元格：formatMoney + 右对齐（源金额列 align="right"；v2.3 金额字段 string|number）。 */
function MoneyCell({ v }: { v: number | string }) {
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

/** 卡1 当前生效比例（v2.3 5 列；overridden 行内追加警示标，源 el-tag warning「覆盖」）。 */
function RatioTable({ rows, loading }: { rows: SplitRow[]; loading: boolean }) {
  // 「银行 + Token」统一口径（v2.3）：元数据未加载/查不到时回退标识本身
  const { bankOf, symOf } = useTokenMeta(PROJECT_ID);

  const columns = React.useMemo<ColumnDef<SplitRow & { id: string }>[]>(
    () => [
      {
        // Token Pair 紧凑式三行（源 .pairx：symOf/symOf num 加粗、bankOf →
        // bankOf 次要色、pairCode||pairId 占位色；替代原货币对+方向两列）
        id: 'tokenPair',
        header: 'Token Pair',
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col leading-normal">
            <div className="font-mono text-xs font-semibold tabular-nums">
              {symOf(row.original.sourceCurrency)}/
              {symOf(row.original.targetCurrency)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {bankOf(row.original.sourceCurrency)} →{' '}
              {bankOf(row.original.targetCurrency)}
            </div>
            <div className="truncate font-mono text-[11px] tabular-nums text-muted-foreground/60">
              {row.original.pairCode || row.original.pairId}
            </div>
          </div>
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
              // 源 el-tag type=warning；Badge 无 warning 变体，outline+amber
              // 警示层沿用 TX_STATUS_WARN_CLASS 三件套先例
              <Badge
                variant="outline"
                className="shrink-0 border-amber-300 bg-amber-50 text-amber-900"
              >
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
    [bankOf, symOf],
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

/** 卡2 分成明细（v2.3 7 列，pageSize10，layout total,prev,pager,next）。 */
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
        // 交易单号：txNo||'-' 固定口径（共享 txNoText 勿自写分叉）；溢出
        // tooltip 对应源 min-w180 show-overflow-tooltip
        accessorKey: 'txNo',
        header: 'Tx No.',
        cell: ({ row }) => {
          const no = txNoText(row.original);
          return no === '-' ? (
            <span className="font-mono text-xs">-</span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block max-w-[180px] truncate font-mono text-xs">
                  {no}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm break-all font-mono text-xs">
                {no}
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: 'pairCode',
        header: 'Token Pair',
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
    // v2.3 行 VO 无独立 ID 字段：只读表以行序作 row key（无重排/删除场景）
    () => rows.map((r, i) => ({ ...r, id: String(i) })),
    [rows],
  );

  return (
    // Provider 作用域覆盖 txNo tooltip（tooltip 仅存在于本表）
    <TooltipProvider delayDuration={200}>
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
    </TooltipProvider>
  );
}
