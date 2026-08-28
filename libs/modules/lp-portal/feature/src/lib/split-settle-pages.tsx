'use client';

/**
 * 分成与结算合并页（v2.4 6c49396，源 `src/views/split-settle/index.vue`；
 * 取代原「我的分成」split 页与「结算」settle 页两页）。
 *
 * 行为契约（doc 01 §D8b）：
 * - 三卡片纵向：卡1 当前生效比例（pair 域数据）/ 卡2 分成明细（split/detail）
 *   / 卡3 结算单（settle/orders）；挂载即并行三查询。
 * - 三挂载点 SyncRefreshButton 域各异：卡1 domain='pair' 只刷比例；
 *   卡2 domain='settle_record' 刷明细（保当前页码 refetch，不回跳首页）；
 *   卡3 domain='settle_order' 只刷结算单（01 §E6 域映射陷阱）。
 * - pairInfo(pairCode)：从卡1 rows 查双侧 token（紧凑两行式渲染卡2 行、
 *   抽屉分项与流水行的 Token 对）；查不到回退纯 pairCode 文本。
 * - 卡2 响应不走 ResultData 包装（split 域 api 层注释详述）；header 右
 *   汇总行 `N entries · Markup total X · My split Y`。
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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

import { formatMoney, formatTime } from './format';
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
  detailCard: 'Split Details',
  ordersCard: 'Settlement Orders',
  query: 'Search',
  reset: 'Reset',
  emptyRatios: 'Not participating in any token pairs yet',
  emptyDetail: 'No split records',
  emptyOrders: 'No settlement orders',
  breakdown: 'Details',
  drawerTitle: 'Settlement Order Details',
  drawerHint:
    'Amount totals are shown per token-pair item (amounts in different currencies cannot be summed)',
  itemsSection: 'Token-pair Items',
  recordsSection: 'Settlement Records (within this order period)',
  emptyItems: 'No item data',
  emptyRecords: 'No records within this order period',
} as const;

/** 下拉「全部」哨兵（FormSelect 禁空 value；非 ALL 即转实参查询）。 */
const ALL = 'all';

/** 卡2 筛选：Token 对下拉 + 完成时间范围。 */
interface DetailFilterForm {
  pairCode: string;
  startTime: string;
  endTime: string;
}

const EMPTY_DETAIL_FILTER: DetailFilterForm = {
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

/** 卡3 筛选：周期粒度 + 状态（v2.4 wire 数字码 periodType/status）。 */
interface OrdersFilterForm {
  periodType: string;
  status: string;
}

const EMPTY_ORDERS_FILTER: OrdersFilterForm = {
  periodType: ALL,
  status: ALL,
};

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

/** 金额单元格：formatMoney + 右对齐（源金额列 align="right"）。 */
function Money({ v }: { v: number | string }) {
  return (
    <span className="block text-right font-mono text-xs tabular-nums">
      {formatMoney(v)}
    </span>
  );
}

/** Key-figure 强调（我的分成列）。 */
function KeyFigure({ v }: { v: number | string }) {
  return (
    <span className="block text-right font-mono text-sm font-semibold tabular-nums">
      {formatMoney(v)}
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
 * 次要色行）。pairInfo 未命中（卡1 无该 pairCode 行）时回退纯 pairCode 文本。
 */
function PairX({
  source,
  target,
  fallback,
  bankOf,
  symOf,
}: {
  source: string;
  target: string;
  fallback: string;
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
      {/* fallback 仅在无 pairInfo 时由调用方渲染纯文本，此第三行不出现 */}
      {fallback ? (
        <div className="truncate font-mono text-[11px] tabular-nums text-muted-foreground/60">
          {fallback}
        </div>
      ) : null}
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
  const { bankOf, symOf } = useTokenMeta(PROJECT_ID);

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

  /** 卡2/抽屉共用：Token 对紧凑式，pairInfo 未命中回退纯文本。 */
  const renderPairX = React.useCallback(
    (pairCode: string | null | undefined) => {
      const info = pairInfo(pairCode);
      if (info) {
        return (
          <PairX
            source={info.sourceTokenCode}
            target={info.targetTokenCode}
            fallback=""
            bankOf={bankOf}
            symOf={symOf}
          />
        );
      }
      return <span>{pairCode || '-'}</span>;
    },
    [pairInfo, bankOf, symOf],
  );

  // ===== 卡2 分成明细分页 =====
  const detailForm = useForm<DetailFilterForm>({
    defaultValues: EMPTY_DETAIL_FILTER,
  });
  const [detailParams, setDetailParams] = React.useState<DetailParams>({
    pageNum: 1,
  });
  const detailQuery = useSplitDetailQuery(PROJECT_ID, {
    pageNum: detailParams.pageNum,
    pageSize: PAGE_SIZE,
    filter: {
      pairCode: detailParams.pairCode,
      startTime: detailParams.startTime,
      endTime: detailParams.endTime,
    },
  });
  const detailRows = detailQuery.data?.rows ?? [];
  const detailTotal = detailQuery.data?.total ?? 0;
  const detailSummary = detailQuery.data?.summary;

  /** 货币对下拉 options 取自卡1 rows（源 value=pairCode||'' 的等价实现，
   * 无码行以 String(pairId) 占位满足 Radix Select 禁空 value，提交时还原）。 */
  const pairOptions = React.useMemo<SelectOption[]>(
    () => [
      { value: ALL, label: 'All Token Pairs' },
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
    // 源口径保真：选中无码行时筛选值是空串（筛「无码行」）
    return selected.pairCode || '';
  }

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
        // Token Pair 紧凑式三行（源 .pairx：symOf/symOf num 加粗、
        // bankOf → bankOf 次要色、pairCode||pairId 占位色）
        id: 'tokenPair',
        header: 'Token Pair',
        cell: ({ row }) => (
          <PairX
            source={row.original.sourceTokenCode}
            target={row.original.targetTokenCode}
            fallback={String(
              row.original.pairCode || row.original.pairId || '',
            )}
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
      {
        accessorKey: 'mySplitRatio',
        header: 'My Split Ratio',
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

  /* ================= 卡2 列（v2.4 8 列） ================= */
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
        header: 'Principal',
        cell: ({ row }) => <Money v={row.original.principal} />,
      },
      {
        accessorKey: 'markupAmount',
        header: 'Markup Amount',
        cell: ({ row }) => <Money v={row.original.markupAmount} />,
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
        cell: ({ row }) => <KeyFigure v={row.original.lpSplitAmount} />,
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
    [renderPairX],
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
        header: 'Tx Count',
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
      <Card>
        <CardHeader>
          <CardTitle>{LBL.ratiosCard}</CardTitle>
          {/* sync 域 'pair'（后端无独立 split 域，01 §E6）；只刷比例卡 */}
          <SyncRefreshButton
            domain="pair"
            onRefreshed={() => void ratioQuery.refetch()}
          />
        </CardHeader>
        <CardContent className="pb-6">
          <DataTable
            columns={ratioColumns}
            data={ratioTableData}
            isLoading={ratioQuery.isPending}
            emptyMessage={LBL.emptyRatios}
          />
        </CardContent>
      </Card>

      {/* ===== 卡2 分成明细 ===== */}
      <Card>
        <CardHeader>
          <CardTitle>{LBL.detailCard}</CardTitle>
          <div className="flex items-center gap-3">
            {/* header 右汇总行（随分页响应下发的时间窗汇总，formatMoney 口径） */}
            {detailSummary && (
              <span className="text-sm text-muted-foreground">
                <span className="tabular-nums">{detailTotal}</span> entries ·
                Markup total{' '}
                <span className="font-mono tabular-nums">
                  {formatMoney(detailSummary.markupTotal)}
                </span>{' '}
                · My split{' '}
                <span className="font-mono tabular-nums">
                  {formatMoney(detailSummary.lpSplitTotal)}
                </span>
              </span>
            )}
            {/* v2.4 新增挂载点：settle_record 域刷明细，保当前页码 refetch */}
            <SyncRefreshButton
              domain="settle_record"
              onRefreshed={() => void detailQuery.refetch()}
            />
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          <form
            onSubmit={detailForm.handleSubmit((f) =>
              setDetailParams({
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
                control={detailForm.control}
                label="Token Pair"
                options={pairOptions}
              />
              {/* 源 datetimerange(value-format='x')：双字段承接，提交转毫秒 number */}
              <FormField
                name="startTime"
                label="Completed From"
                type="datetime-local"
                register={detailForm.register('startTime')}
              />
              <FormField
                name="endTime"
                label="Completed To"
                type="datetime-local"
                register={detailForm.register('endTime')}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit">{LBL.query}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  detailForm.reset(EMPTY_DETAIL_FILTER);
                  setDetailParams({ pageNum: 1 });
                }}
              >
                {LBL.reset}
              </Button>
            </div>
          </form>

          <TooltipProvider delayDuration={200}>
            <DataTable
              columns={detailColumns}
              data={detailTableData}
              isLoading={detailQuery.isPending}
              emptyMessage={LBL.emptyDetail}
              pagination={{
                page: detailParams.pageNum,
                pageSize: PAGE_SIZE,
                total: detailTotal,
                onPageChange: (page) =>
                  setDetailParams((prev) => ({ ...prev, pageNum: page })),
                pageSizeOptions: [PAGE_SIZE],
              }}
            />
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* ===== 卡3 结算单 ===== */}
      <Card>
        <CardHeader>
          <CardTitle>{LBL.ordersCard}</CardTitle>
          {/* settle_order 域只刷结算单（01 §E6：不刷 settle_record） */}
          <SyncRefreshButton
            domain="settle_order"
            onRefreshed={() => void ordersQuery.refetch()}
          />
        </CardHeader>
        <CardContent className="pb-6">
          <form
            onSubmit={ordersForm.handleSubmit((f) =>
              setOrdersParams({
                pageNum: 1,
                periodType:
                  f.periodType !== ALL ? Number(f.periodType) : undefined,
                status: f.status !== ALL ? Number(f.status) : undefined,
              }),
            )}
            className="mb-4"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            <div className="mt-4 flex flex-wrap gap-2">
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
        </CardContent>
      </Card>

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
                <>
                  {/* 单据信息 descriptions column2 border */}
                  <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border text-sm">
                    <Item label="Order ID">
                      <span className="font-mono text-xs">
                        {drawerOrder.orderId}
                      </span>
                    </Item>
                    <Item label="Status">
                      <OrderStatusBadge status={drawerOrder.status} />
                    </Item>
                    <Item label="Period">
                      {SETTLE_PERIOD_TYPE_LABEL[drawerOrder.periodType] ??
                        drawerOrder.periodType}
                    </Item>
                    <Item label="Period Range">
                      <span className="tabular-nums">
                        {periodText(drawerOrder)}
                      </span>
                    </Item>
                    <Item label="Currencies">
                      <span className="font-mono text-xs">
                        {drawerOrder.currencies || '-'}
                      </span>
                    </Item>
                    <Item label="Tx Count">
                      <span className="font-mono text-xs tabular-nums">
                        {drawerOrder.txCount}
                      </span>
                    </Item>
                  </dl>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {LBL.drawerHint}
                  </div>

                  <h4 className="mt-5 mb-2 text-sm font-semibold">
                    {LBL.itemsSection}
                  </h4>
                  <ItemsTable
                    items={drawerOrder.items ?? []}
                    renderPairX={renderPairX}
                  />

                  <h4 className="mt-5 mb-2 text-sm font-semibold">
                    {LBL.recordsSection}
                  </h4>
                  {recordsQuery.isPending ? (
                    <div className="space-y-2" aria-label="Loading">
                      <div className="h-8 w-full animate-pulse rounded bg-muted" />
                      <div className="h-8 w-full animate-pulse rounded bg-muted" />
                    </div>
                  ) : (
                    <RecordsTable
                      rows={drawerRecords}
                      renderPairX={renderPairX}
                    />
                  )}
                </>
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
    <div className="flex items-center justify-between gap-2 bg-card px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Token 对分项表（直读 row.items 非二次请求；6 列）。 */
function ItemsTable({
  items,
  renderPairX,
}: {
  items: SettleOrderItem[];
  renderPairX: (pairCode: string | null | undefined) => React.ReactNode;
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
        cell: ({ row }) => <Money v={row.original.principalTotal} />,
      },
      {
        accessorKey: 'markupTotal',
        header: 'Markup Total',
        cell: ({ row }) => <Money v={row.original.markupTotal} />,
      },
      {
        accessorKey: 'lpSplitTotal',
        header: 'My Split',
        cell: ({ row }) => <KeyFigure v={row.original.lpSplitTotal} />,
      },
    ],
    [renderPairX],
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
}: {
  rows: SettleRecordRow[];
  renderPairX: (pairCode: string | null | undefined) => React.ReactNode;
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
        cell: ({ row }) => <Money v={row.original.principal} />,
      },
      {
        accessorKey: 'markupAmount',
        header: 'Markup Amount',
        cell: ({ row }) => <Money v={row.original.markupAmount} />,
      },
      {
        accessorKey: 'lpSplitAmount',
        header: 'My Split',
        cell: ({ row }) => <KeyFigure v={row.original.lpSplitAmount} />,
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
    [renderPairX],
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
