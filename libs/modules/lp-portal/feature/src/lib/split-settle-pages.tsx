'use client';

/**
 * 分成与结算合并页（v2.4 6c49396，源 `src/views/split-settle/index.vue`；
 * 取代原「我的分成」split 页与「结算」settle 页两页）。
 *
 * 行为契约（doc 01 §D8b；2026-09-11 3a57bbd 决议⑦）：
 * - 两张主卡纵向：卡1 当前生效比例（pair 域数据）/ 卡2 结算单
 *   （settle/orders）。分成明细独立区块已下线——明细只在卡1 Token Pair
 *   行的 Details 抽屉内按需查询（时间筛选与汇总在抽屉内），首屏不请求
 *   /split/detail。
 * - 卡1 domain=['pair','rate'] 刷比例与汇率；卡2 domain='settle_order' 只刷
 *   结算单（01 §E6 域映射陷阱）。
 * - pairInfo(pairCode)：从卡1 rows 查双侧 token（抽屉分项与流水行的 Token
 *   对展示）；查不到回退纯 pairCode 文本。
 * - 抽屉明细响应不走 ResultData 包装（split 域 api 层注释详述）；汇总行
 *   共 N 笔 · 加价合计 · 我的分成合计 随分页响应 summary 下发。
 * - 结算单层**跨币种金额不可加总**（01 §E29）：列表只展示 currencies 集合，
 *   金额合计仅出现在抽屉 token 对分项；抽屉「本单周期内」流水来自独立端点
 *   /settle/order-records（按 orderId 拉取，失败静默——拦截器已提示）。
 * - datetimerange 等价件：源 value-format='x' 毫秒字符串转 Number——本仓以
 *   start/end 双 datetime-local 承接（split/settle/tx-flow 同款约定）。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  CopyableEllipsisText,
  DataTable,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
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
  SETTLE_ORDER_STATUS_LABEL,
  SETTLE_ORDER_STATUS_VARIANT,
  SETTLE_PERIOD_TYPE_LABEL,
  SPLIT_PAIR_STATUS_LABEL,
  SPLIT_PAIR_STATUS_VARIANT,
  useSettleOrderRecordsQuery,
  useSettleOrdersQuery,
  useSplitDetailQuery,
  useSplitRatiosQuery,
  useTokenMeta,
  txNoText,
  type SettleOrderItem,
  type SettleOrderRow,
  type SettleRecordRow,
  type SplitDetailRow,
  type SplitRow,
} from '@myorg/modules/lp-portal/data-access';

import { formatAmount, formatTime } from './format';
import { SyncRefreshButton } from './sync-refresh-button';

/* ================================================================== */
/* 常量与筛选表单                                                       */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'）。 */
const PAGE_SIZE = 10;

const LBL = {
  eyebrow: 'BUSINESS',
  title: 'Splits & Settlement',
  ratiosCard: 'Current Effective Ratios',
  ordersCard: 'Settlement Orders',
  query: 'Search',
  reset: 'Reset',
  emptyRatios: 'Not participating in any token pairs yet',
  breakdown: 'Details',
  detailFrom: 'Completed From',
  detailTo: 'Completed To',
  drawerTitle: 'Settlement Order Details',
  drawerHint:
    'Amount totals are shown per token-pair item (amounts in different currencies cannot be summed)',
  itemsSection: 'Token-pair Items',
  emptyDetail: 'No split records for this token pair',
  emptyOrders: 'No settlement orders for the current filters',
  recordsSection: 'Settlement Records (within this order period)',
  emptyItems: 'No item data',
  emptyRecords: 'No records within this order period',
} as const;

/** 下拉「全部」哨兵（FormSelect 禁空 value；非 ALL 即转实参查询）。 */
const ALL = 'all';

/** 卡3 筛选：周期粒度 + 状态（v2.4 wire 数字码 periodType/status）。 */
interface OrdersFilterForm {
  periodType: string;
  status: string;
}

const EMPTY_ORDERS_FILTER: OrdersFilterForm = { periodType: ALL, status: ALL };

/**
 * 抽屉时间筛选（3a57bbd 决议⑦）：datetime-local 字符串，提交时转毫秒
 *（源 value-format='x' 等价，tx-flow 同款约定）。
 */
interface DetailTimeForm {
  startTime: string;
  endTime: string;
}

const EMPTY_DETAIL_TIME: DetailTimeForm = { startTime: '', endTime: '' };

interface OrdersParams {
  pageNum: number;
  periodType?: number;
  status?: number;
}

const ORDER_PERIOD_OPTIONS: SelectOption[] = Object.keys(
  SETTLE_PERIOD_TYPE_LABEL,
)
  .map((k) => Number(k))
  .map((code) => ({
    value: String(code),
    label: SETTLE_PERIOD_TYPE_LABEL[code],
  }));

const ORDER_STATUS_OPTIONS: SelectOption[] = Object.keys(
  SETTLE_ORDER_STATUS_LABEL,
)
  .map((k) => Number(k))
  .map((code) => ({
    value: String(code),
    label: SETTLE_ORDER_STATUS_LABEL[code],
  }));

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

/** 汇率原值单元格（f0d5b6f a6889f5）：比值原值不加 %，空显 '-'；右对齐等宽。 */
function RateCell({ v }: { v: string | number | null | undefined }) {
  return (
    <span className="block text-right font-mono text-xs tabular-nums">
      {v == null || v === '' ? '-' : String(v)}
    </span>
  );
}

/** 比率百分比单元格（f0d5b6f a6889f5）：0〜1 比率 → 两位小数百分比。 */
function PercentCell({ v }: { v: string | number | null | undefined }) {
  return (
    <span className="block text-right font-mono text-xs tabular-nums">
      {percentText(v)}
    </span>
  );
}

/** 金额单元格：formatAmount 按源 token 精度（6a55188）+ 右对齐。 */
function Money({ v, dec }: { v: number | string; dec: number }) {
  return (
    <span className="block text-right font-mono text-xs tabular-nums">
      {formatAmount(v, dec)}
    </span>
  );
}

/** Key-figure 强调（我的分成列）；dec 同 Money 口径。 */
function KeyFigure({ v, dec }: { v: number | string; dec: number }) {
  return (
    <span className="block text-right font-mono text-sm font-semibold tabular-nums">
      {formatAmount(v, dec)}
    </span>
  );
}

function periodText(row: SettleOrderRow): string {
  return `${formatTime(row.periodStart)} ~ ${formatTime(row.periodEnd)}`;
}

/** 结算单状态 badge；未知码显原值（源 ORDER_STATUS_TEXT ?? raw）。 */
function OrderStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={SETTLE_ORDER_STATUS_VARIANT[status] ?? 'secondary'}>
      {SETTLE_ORDER_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/**
 * Token 对紧凑两行式（源 .pairx：symOf/symOf 加粗行 + bankOf → bankOf
 * 次要色行）。e0fad0a 起第三行 pairCode||pairId 占位行移除；pairInfo
 * 未命中（卡1 无该 pairCode 行）时由调用方回退纯 pairCode 文本。
 */
function PairX({
  source,
  target,
  bankOf,
  symOf,
}: {
  source: string;
  target: string;
  bankOf: (code: string) => string;
  symOf: (code: string) => string;
}) {
  return (
    <div className="flex min-w-0 flex-col leading-normal">
      <div className="font-mono text-xs font-semibold tabular-nums">
        {symOf(source)}/{symOf(target)}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {bankOf(source)} → {bankOf(target)}
      </div>
    </div>
  );
}

/** 交易单号单元格：txNoText 固定口径 + 溢出 tooltip（源 min-w180 show-overflow-tooltip）。 */
function TxNoCell({ no }: { no: string }) {
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
}

/* ================================================================== */
/* 页面                                                                 */
/* ================================================================== */

export function SplitSettlePage() {
  const { bankOf, symOf, decimalsOf } = useTokenMeta(PROJECT_ID);

  // ===== 卡1 当前生效比例（pair 域） =====
  const ratioQuery = useSplitRatiosQuery(PROJECT_ID);
  const ratioRows = ratioQuery.data ?? [];

  /**
   * pairCode → 卡1 参与行（卡2 行、抽屉分项/流水行的 Token 对展示从这取
   * 双侧 token）；无码/未命中返回 undefined，调用方回退纯 pairCode 文本。
   */
  const pairInfo = React.useCallback(
    (pairCode: string | null | undefined): SplitRow | undefined => {
      if (!pairCode) return undefined;
      return ratioRows.find((r) => r.pairCode === pairCode);
    },
    [ratioRows],
  );

  /**
   * amt 口径（6a55188）：金额按 pairCode 对应源 token 的 decimalDigits
   * 定小数位；pairInfo 未命中 / 元数据未加载回退 2（decimalsOf 兜底）。
   */
  const decOf = React.useCallback(
    (pairCode: string | null | undefined): number =>
      decimalsOf(pairInfo(pairCode)?.sourceTokenCode),
    [decimalsOf, pairInfo],
  );

  /** 卡2/抽屉共用：Token 对紧凑式，pairInfo 未命中回退纯文本。 */
  const renderPairX = React.useCallback(
    (pairCode: string | null | undefined) => {
      const info = pairInfo(pairCode);
      if (info) {
        return (
          <PairX
            source={info.sourceTokenCode}
            target={info.targetTokenCode}
            bankOf={bankOf}
            symOf={symOf}
          />
        );
      }
      return <span>{pairCode || '-'}</span>;
    },
    [pairInfo, bankOf, symOf],
  );

  // ===== Token Pair 行内分成明细抽屉（按需查询；3a57bbd：时间筛选与汇总收进抽屉） =====
  const [detailPage, setDetailPage] = React.useState(1);
  const [drawerPairCode, setDrawerPairCode] = React.useState<string | null>(
    null,
  );
  /** 已提交时间窗（毫秒）；开抽屉/重置清空（源 openPairDetail 置 null）。 */
  const [detailTime, setDetailTime] = React.useState<{
    startTime?: number;
    endTime?: number;
  }>({});
  const detailForm = useForm<DetailTimeForm>({
    defaultValues: EMPTY_DETAIL_TIME,
  });
  const detailQuery = useSplitDetailQuery(
    PROJECT_ID,
    {
      pageNum: detailPage,
      pageSize: PAGE_SIZE,
      filter: { pairCode: drawerPairCode ?? undefined, ...detailTime },
    },
    drawerPairCode !== null,
  );
  const detailRows = detailQuery.data?.rows ?? [];
  const detailTotal = detailQuery.data?.total ?? 0;
  const detailSummary = detailQuery.data?.summary;

  // ===== 卡3 结算单分页 =====
  const ordersForm = useForm<OrdersFilterForm>({
    defaultValues: EMPTY_ORDERS_FILTER,
  });
  const [ordersParams, setOrdersParams] = React.useState<OrdersParams>({
    pageNum: 1,
  });
  const ordersQuery = useSettleOrdersQuery(PROJECT_ID, {
    pageNum: ordersParams.pageNum,
    pageSize: PAGE_SIZE,
    filter: {
      periodType: ordersParams.periodType,
      status: ordersParams.status,
    },
  });
  const orderRows = ordersQuery.data?.data ?? [];
  const ordersTotal = ordersQuery.data?.pagination.total ?? 0;

  // ===== 详情抽屉 =====
  const [drawerOrder, setDrawerOrder] = React.useState<SettleOrderRow | null>(
    null,
  );
  // 源 openDrawer：按 orderId 拉单周期流水，失败静默（拦截器已提示）
  const recordsQuery = useSettleOrderRecordsQuery(
    PROJECT_ID,
    drawerOrder?.orderId ?? null,
  );
  const drawerRecords = recordsQuery.data ?? [];

  /* ================= 卡1 列 ================= */
  const ratioColumns = React.useMemo<ColumnDef<SplitRow & { id: string }>[]>(
    () => [
      {
        // Token Pair 紧凑两行式（e0fad0a 起第三行 pairCode||pairId
        // 占位行移除）
        id: 'tokenPair',
        header: 'Token Pair',
        cell: ({ row }) => (
          <PairX
            source={row.original.sourceTokenCode}
            target={row.original.targetTokenCode}
            bankOf={bankOf}
            symOf={symOf}
          />
        ),
      },
      {
        // v2.4 分成币种：symOf(sourceTokenCode) plain tag
        id: 'currency',
        header: 'Split Currency',
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono">
            {symOf(row.original.sourceTokenCode)}
          </Badge>
        ),
      },

      // f0d5b6f（a6889f5）：Split Currency 与 My Split Ratio 之间插三汇率列。
      // Base/User Rate 为比值原值（rateText 口径，空显 '-'）；Markup Rate
      // 为 0〜1 比率 → 两位小数百分比。
      {
        accessorKey: 'baseRate',
        header: () => <div className="text-right">Base Rate</div>,
        cell: ({ row }) => <RateCell v={row.original.baseRate} />,
      },
      {
        accessorKey: 'markupRate',
        header: () => <div className="text-right">Markup Rate</div>,
        cell: ({ row }) => <PercentCell v={row.original.markupRate} />,
      },
      {
        accessorKey: 'userRate',
        header: () => <div className="text-right">User Rate</div>,
        cell: ({ row }) => <RateCell v={row.original.userRate} />,
      },
      {
        accessorKey: 'mySplitRatio',
        header: () => <div className="text-right">My Split Ratio</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <span className="font-mono text-xs tabular-nums">
              {percentText(row.original.mySplitRatio)}
            </span>
            {row.original.overridden && (
              // 源 el-tag type=warning「覆盖」；outline+amber 警示层先例
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
        header: () => <div className="text-right">Default Ratio</div>,
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
      {
        id: 'details',
        header: 'Details',
        enableSorting: false,
        // 3a57bbd：openPairDetail 无码行回退 String(pairId) 亦可开（源同款）
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => {
              detailForm.reset(EMPTY_DETAIL_TIME);
              setDetailTime({});
              setDetailPage(1);
              setDrawerPairCode(
                row.original.pairCode || String(row.original.pairId),
              );
            }}
          >
            Details
          </Button>
        ),
      },
    ],
    [bankOf, symOf],
  );

  /* ================= Split Details 抽屉列 ================= */
  const detailColumns = React.useMemo<
    ColumnDef<SplitDetailRow & { id: string }>[]
  >(
    () => [
      {
        accessorKey: 'txNo',
        header: 'Tx No.',
        cell: ({ row }) => <TxNoCell no={txNoText(row.original)} />,
      },
      {
        // Token 对紧凑式两行；pairInfo 未命中回退纯 pairCode 文本（源同款）
        id: 'tokenPair',
        header: 'Token Pair',
        cell: ({ row }) => renderPairX(row.original.pairCode),
      },
      {
        // v2.4 币种列
        accessorKey: 'currency',
        header: 'Currency',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.currency || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'principal',
        header: () => <div className="text-right">Principal</div>,
        cell: ({ row }) => (
          <Money v={row.original.principal} dec={decOf(row.original.pairCode)} />
        ),
      },
      {
        accessorKey: 'markupAmount',
        header: () => <div className="text-right">Markup Amount</div>,
        cell: ({ row }) => (
          <Money
            v={row.original.markupAmount}
            dec={decOf(row.original.pairCode)}
          />
        ),
      },
      {
        accessorKey: 'splitRatio',
        header: () => <div className="text-right">Split Ratio</div>,
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {percentText(row.original.splitRatio)}
          </span>
        ),
      },
      {
        accessorKey: 'lpSplitAmount',
        header: () => <div className="text-right">My Split</div>,
        cell: ({ row }) => (
          <KeyFigure
            v={row.original.lpSplitAmount}
            dec={decOf(row.original.pairCode)}
          />
        ),
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
    [renderPairX, decOf],
  );

  /* ================= 卡3 列（v2.4 7 列，金额三列移入抽屉分项） ================= */
  const orderColumns = React.useMemo<
    ColumnDef<SettleOrderRow & { id: string }>[]
  >(
    () => [
      {
        accessorKey: 'orderId',
        header: 'Settlement Order ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.orderId}</span>
        ),
      },
      {
        accessorKey: 'periodType',
        header: 'Period',
        // Unknown granularity shows the raw code (source PERIOD_TEXT ?? raw)
        cell: ({ row }) => (
          <span>
            {SETTLE_PERIOD_TYPE_LABEL[row.original.periodType] ??
              row.original.periodType}
          </span>
        ),
      },
      {
        accessorKey: 'periodStart',
        header: 'Period Range',
        cell: ({ row }) => (
          <span className="block min-w-[320px] whitespace-nowrap tabular-nums">
            {periodText(row.original)}
          </span>
        ),
      },
      {
        // v2.4 币种集合（'A / B'）；跨币种金额不可加总故列表不展示金额
        accessorKey: 'currencies',
        header: 'Currencies',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.currencies || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'txCount',
        header: () => <div className="text-right">Tx Count</div>,
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {row.original.txCount}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: 'Operations',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto whitespace-nowrap p-0"
            onClick={() => setDrawerOrder(row.original)}
          >
            {LBL.breakdown}
          </Button>
        ),
      },
    ],
    [],
  );

  const ratioTableData = React.useMemo(
    () => ratioRows.map((r) => ({ ...r, id: String(r.pairId) })),
    [ratioRows],
  );
  const detailTableData = React.useMemo(
    // v2.4 行 VO 无独立 ID 字段：只读表以行序作 row key（无重排/删除场景）
    () => detailRows.map((r, i) => ({ ...r, id: String(i) })),
    [detailRows],
  );
  const orderTableData = React.useMemo(
    () => orderRows.map((r) => ({ ...r, id: String(r.orderId) })),
    [orderRows],
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
      </div>

      {/* ===== 卡1 当前生效比例 ===== */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              {LBL.ratiosCard}
            </div>
            {ratioQuery.data != null && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {ratioRows.length} pairs
              </span>
            )}
            {ratioQuery.dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatTime(ratioQuery.dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <div className="shrink-0">
            {/* sync 域 'pair'（后端无独立 split 域，01 §E6）；只刷比例卡 */}
            <SyncRefreshButton
              domain={['pair', 'rate']}
              onRefreshed={() => void ratioQuery.refetch()}
            />
          </div>
        </div>
        <div className="p-4">
          <DataTable
            columns={ratioColumns}
            data={ratioTableData}
            isLoading={ratioQuery.isPending}
            emptyMessage={LBL.emptyRatios}
          />
        </div>
      </section>

      <Drawer
        open={drawerPairCode !== null}
        onOpenChange={(open) => !open && setDrawerPairCode(null)}
      >
        <DrawerContent className="w-[min(900px,95vw)] max-w-none p-0">
          <DrawerHeader className="border-b px-6 py-4">
            <DrawerTitle>
              Split Details{drawerPairCode ? ` · ${drawerPairCode}` : ''}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {/* 3a57bbd 决议⑦：完成时间筛选收进抽屉（源 datetimerange 等价件） */}
            <form
              onSubmit={detailForm.handleSubmit((f) => {
                setDetailPage(1);
                setDetailTime({
                  startTime: f.startTime
                    ? new Date(f.startTime).getTime()
                    : undefined,
                  endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
                });
              })}
              className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap"
            >
              <FormField
                name="detailStartTime"
                label={LBL.detailFrom}
                type="datetime-local"
                register={detailForm.register('startTime')}
              />
              <FormField
                name="detailEndTime"
                label={LBL.detailTo}
                type="datetime-local"
                register={detailForm.register('endTime')}
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  {LBL.query}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    detailForm.reset(EMPTY_DETAIL_TIME);
                    setDetailTime({});
                    setDetailPage(1);
                  }}
                >
                  {LBL.reset}
                </Button>
              </div>
            </form>
            {/* 源汇总行：共 N 笔 · 加价合计 · 我的分成合计（随分页响应下发） */}
            {detailSummary && (
              <div className="my-3 text-sm text-muted-foreground">
                {detailTotal} records · Markup total{' '}
                {formatAmount(detailSummary.markupTotal, decOf(drawerPairCode))}{' '}
                · My split total{' '}
                {formatAmount(detailSummary.lpSplitTotal, decOf(drawerPairCode))}
              </div>
            )}
            <DataTable
              columns={detailColumns}
              data={detailTableData}
              isLoading={detailQuery.isPending}
              emptyMessage={LBL.emptyDetail}
              pagination={{
                page: detailPage,
                pageSize: PAGE_SIZE,
                total: detailTotal,
                onPageChange: setDetailPage,
                pageSizeOptions: [PAGE_SIZE],
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* ===== 卡3 结算单 ===== */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              {LBL.ordersCard}
            </div>
            {ordersQuery.data != null && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {ordersTotal} orders
              </span>
            )}
            {ordersQuery.dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatTime(ordersQuery.dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <div className="shrink-0">
            {/* settle_order 域只刷结算单（01 §E6：不刷 settle_record） */}
            <SyncRefreshButton
              domain="settle_order"
              onRefreshed={() => void ordersQuery.refetch()}
            />
          </div>
        </div>

        <form
          onSubmit={ordersForm.handleSubmit((f) =>
            setOrdersParams({
              pageNum: 1,
              periodType:
                f.periodType !== ALL ? Number(f.periodType) : undefined,
              status: f.status !== ALL ? Number(f.status) : undefined,
            }),
          )}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormSelect
              name="periodType"
              control={ordersForm.control}
              label="Period"
              options={[
                { value: ALL, label: 'All' },
                ...ORDER_PERIOD_OPTIONS,
              ]}
            />
            <FormSelect
              name="status"
              control={ordersForm.control}
              label="Status"
              options={[
                { value: ALL, label: 'All' },
                ...ORDER_STATUS_OPTIONS,
              ]}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit">{LBL.query}</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                ordersForm.reset(EMPTY_ORDERS_FILTER);
                setOrdersParams({ pageNum: 1 });
              }}
            >
              {LBL.reset}
            </Button>
          </div>
        </form>
        <div className="p-4">
          <DataTable
            columns={orderColumns}
            data={orderTableData}
            isLoading={ordersQuery.isPending}
            emptyMessage={LBL.emptyOrders}
            pagination={{
              page: ordersParams.pageNum,
              pageSize: PAGE_SIZE,
              total: ordersTotal,
              onPageChange: (page) =>
                setOrdersParams((prev) => ({ ...prev, pageNum: page })),
              pageSizeOptions: [PAGE_SIZE],
            }}
          />
        </div>
      </section>

      {/* ===== 结算单详情抽屉（760px）：单据信息 + Token 对分项 + 本单流水 ===== */}
      <Drawer
        open={drawerOrder !== null}
        onOpenChange={(o) => !o && setDrawerOrder(null)}
      >
        <DrawerContent className="w-[min(760px,90vw)] max-w-none p-0">
          <div className="flex h-full flex-col">
            <DrawerHeader className="border-b px-6 py-4">
              <DrawerTitle>{LBL.drawerTitle}</DrawerTitle>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {drawerOrder && (
                <div className="space-y-5">
                  {/* §6.3 Hero Summary：Order ID（复制贴字段）+ 状态 badge */}
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        Order ID
                      </div>
                      <div className="mt-1">
                        <CopyableEllipsisText
                          value={String(drawerOrder.orderId)}
                          maxWidth={340}
                          className="font-mono text-base font-semibold leading-6"
                        />
                      </div>
                    </div>
                    <OrderStatusBadge status={drawerOrder.status} />
                  </div>

                  {/* DetailGrid：核心字段响应列；Period Range 长文本单独占行 */}
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
                    <Item label="Period">
                      {SETTLE_PERIOD_TYPE_LABEL[drawerOrder.periodType] ??
                        drawerOrder.periodType}
                    </Item>
                    <Item label="Currencies">
                      <span className="font-mono text-xs">
                        {drawerOrder.currencies || '-'}
                      </span>
                    </Item>
                    <Item label="Tx Count">
                      <span className="font-mono text-sm font-medium tabular-nums">
                        {drawerOrder.txCount}
                      </span>
                    </Item>
                    <div className="sm:col-span-3">
                      <Item label="Period Range">
                        <span className="font-mono text-xs tabular-nums">
                          {periodText(drawerOrder)}
                        </span>
                      </Item>
                    </div>
                  </dl>
                  <div className="text-xs leading-5 text-muted-foreground">
                    {LBL.drawerHint}
                  </div>

                  {/* Token 对分项（金额合计仅此处，跨币种不可加总 01 §E29） */}
                  <section className="rounded-lg border border-border/60 bg-card">
                    <h4 className="border-b border-border/50 px-4 py-3 text-sm font-semibold text-foreground">
                      {LBL.itemsSection}
                    </h4>
                    <div className="px-4 py-4">
                      <ItemsTable
                        items={drawerOrder.items ?? []}
                        renderPairX={renderPairX}
                        decOf={decOf}
                      />
                    </div>
                  </section>

                  {/* 本单周期内流水（panel 公式与列表批一致） */}
                  <section className="rounded-lg border border-border/60 bg-card">
                    <h4 className="border-b border-border/50 px-4 py-3 text-sm font-semibold text-foreground">
                      {LBL.recordsSection}
                    </h4>
                    <div className="px-4 py-4">
                      {recordsQuery.isPending ? (
                        <div className="space-y-2" aria-label="Loading">
                          <div className="h-8 w-full motion-safe:animate-pulse rounded bg-muted" />
                          <div className="h-8 w-full motion-safe:animate-pulse rounded bg-muted" />
                        </div>
                      ) : (
                        <RecordsTable
                          rows={drawerRecords}
                          renderPairX={renderPairX}
                          decOf={decOf}
                        />
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/* ================================================================== */
/* descriptions 项与抽屉两张子表                                        */
/* ================================================================== */

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 break-all text-sm">{children}</dd>
    </div>
  );
}

/** Token 对分项表（直读 row.items 非二次请求；6 列）。 */
function ItemsTable({
  items,
  renderPairX,
  decOf,
}: {
  items: SettleOrderItem[];
  renderPairX: (pairCode: string | null | undefined) => React.ReactNode;
  /** 6a55188：金额按 pairCode 源 token 精度。 */
  decOf: (pairCode: string | null | undefined) => number;
}) {
  const columns = React.useMemo<ColumnDef<SettleOrderItem & { id: string }>[]>(
    () => [
      {
        id: 'tokenPair',
        header: 'Token Pair',
        cell: ({ row }) => renderPairX(row.original.pairCode),
      },
      {
        accessorKey: 'currency',
        header: 'Currency',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.currency || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'txCount',
        header: 'Tx Count',
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {row.original.txCount}
          </span>
        ),
      },
      {
        accessorKey: 'principalTotal',
        header: 'Principal Total',
        cell: ({ row }) => (
          <Money
            v={row.original.principalTotal}
            dec={decOf(row.original.pairCode)}
          />
        ),
      },
      {
        accessorKey: 'markupTotal',
        header: 'Markup Total',
        cell: ({ row }) => (
          <Money
            v={row.original.markupTotal}
            dec={decOf(row.original.pairCode)}
          />
        ),
      },
      {
        accessorKey: 'lpSplitTotal',
        header: 'My Split',
        cell: ({ row }) => (
          <KeyFigure
            v={row.original.lpSplitTotal}
            dec={decOf(row.original.pairCode)}
          />
        ),
      },
    ],
    [renderPairX, decOf],
  );

  const data = React.useMemo(
    () => items.map((it, i) => ({ ...it, id: String(i) })),
    [items],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={false}
      emptyMessage={LBL.emptyItems}
    />
  );
}

/** 结算流水表（本单周期内；POST /settle/order-records 拉取；7 列）。 */
function RecordsTable({
  rows,
  renderPairX,
  decOf,
}: {
  rows: SettleRecordRow[];
  renderPairX: (pairCode: string | null | undefined) => React.ReactNode;
  /** 6a55188：金额按 pairCode 源 token 精度。 */
  decOf: (pairCode: string | null | undefined) => number;
}) {
  const columns = React.useMemo<ColumnDef<SettleRecordRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'txNo',
        header: 'Tx No.',
        cell: ({ row }) => <TxNoCell no={txNoText(row.original)} />,
      },
      {
        id: 'tokenPair',
        header: 'Token Pair',
        cell: ({ row }) => renderPairX(row.original.pairCode),
      },
      {
        accessorKey: 'currency',
        header: 'Currency',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.currency || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'principal',
        header: 'Principal',
        cell: ({ row }) => (
          <Money
            v={row.original.principal}
            dec={decOf(row.original.pairCode)}
          />
        ),
      },
      {
        accessorKey: 'markupAmount',
        header: 'Markup Amount',
        cell: ({ row }) => (
          <Money
            v={row.original.markupAmount}
            dec={decOf(row.original.pairCode)}
          />
        ),
      },
      {
        accessorKey: 'lpSplitAmount',
        header: 'My Split',
        cell: ({ row }) => (
          <KeyFigure
            v={row.original.lpSplitAmount}
            dec={decOf(row.original.pairCode)}
          />
        ),
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
    [renderPairX, decOf],
  );

  const data = React.useMemo(
    () => rows.map((r, i) => ({ ...r, id: String(i) })),
    [rows],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <DataTable
        columns={columns}
        data={data}
        isLoading={false}
        emptyMessage={LBL.emptyRecords}
      />
    </TooltipProvider>
  );
}
