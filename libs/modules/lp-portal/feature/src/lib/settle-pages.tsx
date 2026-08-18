'use client';

/**
 * 结算页（B7，源 `src/views/settle/index.vue` 1:1 迁移）。
 *
 * 源语义要点：
 * - 双 tab：结算流水（默认，POST /lp/settle/records）/ 结算单
 *   （POST /lp/settle/orders）；各自独立筛选/分页/loading/query，页面挂载
 *   即并行首载两 query，切 tab 不重新加载（缓存命中；两 query 与筛选状态
 *   均挂在页面级，tab 面板卸载不丢状态）；
 * - 页面级共享单条降级条（tab 外、页顶）：任一侧 query.error 为 0024
 *   （isServiceDown）→ ServiceDownAlert（orders 侧 0024 同样在页顶显示）；
 *   非 0024 失败降级条清除、旧数据保留（keepPreviousData + query 缓存），
 *   lp-client 对 0024 已豁免全局 toast；
 * - records 筛选仅时间范围（records 表无周期列，裁决 C-1）；
 * - orders 筛选 3 个：状态（仅 5 生成 / 20 已确认 / 35 已结算 可筛——10 审中
 *   / 15 拒绝存在于状态机但源不可筛）+ 周期（字符串 day/week/month，后端
 *   映射 period_type 1/2/3，裁决 C-1/D-7）+ 时间范围；
 * - 源 datetimerange value-format="x" 产出毫秒时间戳字符串、load 时
 *   Number() 转入 query；此处 datetime-local 字符串经 Date.getTime()
 *   等价产出毫秒 number，清空 → undefined（不进请求体）；
 * - LP 分成 / LP 分成合计列 key-figure 强调（源 .key-figure
 *   `color:var(--ks-settle);font-weight:600` → 主题色 + semibold）；
 * - 分页固定 pageSize 10（源 layout 'total,prev,pager,next' 无 sizes）；
 * - lpId 由 BFF 登录域注入，前端不传。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  DataTable,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';

import {
  LP_PROJECT_ID,
  SETTLE_ORDER_STATUS_LABEL,
  SETTLE_ORDER_STATUS_VARIANT,
  SETTLE_PERIOD_TYPE_LABEL,
  SETTLE_RECORD_STATUS_LABEL,
  SETTLE_RECORD_STATUS_VARIANT,
  isServiceDown,
  useSettleOrdersQuery,
  useSettleRecordsQuery,
  type SettleOrderRow,
  type SettleRecordRow,
} from '@myorg/modules/lp-portal/data-access';
import { formatMoney, formatTime } from './format';
import { ServiceDownAlert } from './service-down-alert';

/* ================================================================== */
/* 常量与筛选表单                                                       */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'）。 */
const PAGE_SIZE = 10;

const LBL = {
  eyebrow: 'BUSINESS',
  title: '结算',
  tabRecords: '结算流水',
  tabOrders: '结算单',
  query: '查询',
  reset: '重置',
  empty: '暂无数据',
} as const;

/** 下拉「全部」哨兵（FormSelect 禁空 value，非 ALL 即转实参查询）。 */
const ALL = 'all';

/**
 * 结算单状态筛选选项：源 clearable select 仅 5/20/35 三项
 * （10 审中 / 15 拒绝 不可筛，裁决 C-2）；周期：字符串值后端映射
 * period_type 1/2/3（裁决 C-1/D-7）。
 */
const ORDER_STATUS_OPTIONS: SelectOption[] = [
  { value: ALL, label: '全部' },
  { value: '5', label: '生成' },
  { value: '20', label: '已确认' },
  { value: '35', label: '已结算' },
];

const ORDER_CYCLE_OPTIONS: SelectOption[] = [
  { value: ALL, label: '全部' },
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
];

/* ===== records tab（筛选仅时间范围，裁决 C-1）===== */

interface RecordsFilterForm {
  startTime: string;
  endTime: string;
}

const EMPTY_RECORDS_FILTER: RecordsFilterForm = { startTime: '', endTime: '' };

/** 已提交查询参数（时间已转毫秒 number；undefined 字段不进请求体）。 */
interface RecordsParams {
  pageNum: number;
  startTime?: number;
  endTime?: number;
}

function recordsFormToParams(
  f: RecordsFilterForm,
  pageNum = 1,
): RecordsParams {
  return {
    pageNum,
    startTime: f.startTime ? new Date(f.startTime).getTime() : undefined,
    endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
  };
}

/* ===== orders tab（状态 + 周期 + 时间范围）===== */

interface OrdersFilterForm {
  status: string;
  cycle: string;
  startTime: string;
  endTime: string;
}

const EMPTY_ORDERS_FILTER: OrdersFilterForm = {
  status: ALL,
  cycle: ALL,
  startTime: '',
  endTime: '',
};

/** 已提交查询参数（status 转 number、cycle 保字符串；undefined 不进请求体）。 */
interface OrdersParams {
  pageNum: number;
  status?: number;
  cycle?: 'day' | 'week' | 'month';
  startTime?: number;
  endTime?: number;
}

function ordersFormToParams(f: OrdersFilterForm, pageNum = 1): OrdersParams {
  return {
    pageNum,
    status: f.status !== ALL ? Number(f.status) : undefined,
    cycle:
      f.cycle !== ALL ? (f.cycle as 'day' | 'week' | 'month') : undefined,
    startTime: f.startTime ? new Date(f.startTime).getTime() : undefined,
    endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
  };
}

/* ================================================================== */
/* 单元格渲染                                                           */
/* ================================================================== */

/** 货币对列：源/目标币种齐显「源→目标」，缺币种回落 pairId 原值（源 recordPairText）。 */
function recordPairText(row: SettleRecordRow): string {
  return row.sourceCurrency && row.targetCurrency
    ? `${row.sourceCurrency}→${row.targetCurrency}`
    : `${row.pairId}`;
}

/** 周期列：起 〜 止（源 periodText，波浪符与源一致）。 */
function periodText(row: SettleOrderRow): string {
  return `${formatTime(row.periodStart)} 〜 ${formatTime(row.periodEnd)}`;
}

/** 金额单元格：formatMoney（千分位、不归一小数位、无符号）。 */
function Money({ v }: { v: number }) {
  return (
    <span className="font-mono text-xs tabular-nums">{formatMoney(v)}</span>
  );
}

/** key-figure 强调单元格（源 .key-figure 主题色 + semibold）。 */
function KeyFigure({ v }: { v: number }) {
  return (
    <span className="font-mono text-xs font-semibold tabular-nums text-primary">
      {formatMoney(v)}
    </span>
  );
}

/** 结算流水状态 Badge：未知码显原值，variant 兜底 secondary（源 1 success 其余 info）。 */
function RecordStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={SETTLE_RECORD_STATUS_VARIANT[status] ?? 'secondary'}>
      {SETTLE_RECORD_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/** 结算单状态 Badge：未知码显原值，variant 兜底 secondary（源 5/10 info）。 */
function OrderStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={SETTLE_ORDER_STATUS_VARIANT[status] ?? 'secondary'}>
      {SETTLE_ORDER_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/* ================================================================== */
/* 页面                                                                 */
/* ================================================================== */

/**
 * 结算页：双 tab 各自独立分页独立筛选，共享页顶单条降级条。
 * 源为单页无 detail 子路由，行不可点击（registry 仅应挂 list，mock 的
 * SettleDetailPage 一并移除）。
 */
export function SettleListPage() {
  // ===== 结算流水（records）=====
  const recordsForm = useForm<RecordsFilterForm>({
    defaultValues: EMPTY_RECORDS_FILTER,
  });
  const [recordsParams, setRecordsParams] = React.useState<RecordsParams>(() =>
    recordsFormToParams(EMPTY_RECORDS_FILTER),
  );

  const recordsQuery = useSettleRecordsQuery(PROJECT_ID, {
    pageNum: recordsParams.pageNum,
    pageSize: PAGE_SIZE,
    filter: {
      startTime: recordsParams.startTime,
      endTime: recordsParams.endTime,
    },
  });

  const recordRows = recordsQuery.data?.data ?? [];
  const recordsTotal = recordsQuery.data?.pagination.total ?? 0;

  // ===== 结算单（orders）=====
  const ordersForm = useForm<OrdersFilterForm>({
    defaultValues: EMPTY_ORDERS_FILTER,
  });
  const [ordersParams, setOrdersParams] = React.useState<OrdersParams>(() =>
    ordersFormToParams(EMPTY_ORDERS_FILTER),
  );

  const ordersQuery = useSettleOrdersQuery(PROJECT_ID, {
    pageNum: ordersParams.pageNum,
    pageSize: PAGE_SIZE,
    filter: {
      status: ordersParams.status,
      cycle: ordersParams.cycle,
      startTime: ordersParams.startTime,
      endTime: ordersParams.endTime,
    },
  });

  const orderRows = ordersQuery.data?.data ?? [];
  const ordersTotal = ordersQuery.data?.pagination.total ?? 0;

  // 源共享 down 语义：页面级单个 down（tab 外页顶渲染），任一侧 0024 置位
  // （orders 侧同样显示）；成功侧 query.error 归 null 即清除，旧数据保留。
  const down = React.useMemo(() => {
    for (const err of [recordsQuery.error, ordersQuery.error]) {
      if (err != null && isServiceDown(err)) return { traceId: err.traceId };
    }
    return null;
  }, [recordsQuery.error, ordersQuery.error]);

  const recordColumns = React.useMemo<
    ColumnDef<SettleRecordRow & { id: string }>[]
  >(
    () => [
      {
        accessorKey: 'createTime',
        header: '创建时间',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.createTime)}
          </span>
        ),
      },
      {
        accessorKey: 'pairId',
        header: '货币对',
        cell: ({ row }) => recordPairText(row.original),
      },
      {
        accessorKey: 'principal',
        header: '本金',
        cell: ({ row }) => <Money v={row.original.principal} />,
      },
      {
        accessorKey: 'userDeduction',
        header: '用户扣减',
        cell: ({ row }) => <Money v={row.original.userDeduction} />,
      },
      {
        accessorKey: 'markupAmount',
        header: '加价金额',
        cell: ({ row }) => <Money v={row.original.markupAmount} />,
      },
      {
        accessorKey: 'receiverAmount',
        header: '解付金额',
        cell: ({ row }) => <Money v={row.original.receiverAmount} />,
      },
      {
        accessorKey: 'lpSplitAmount',
        header: 'LP 分成',
        cell: ({ row }) => <KeyFigure v={row.original.lpSplitAmount} />,
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => <RecordStatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  const orderColumns = React.useMemo<
    ColumnDef<SettleOrderRow & { id: string }>[]
  >(
    () => [
      {
        accessorKey: 'orderId',
        header: '结算单 ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.orderId}</span>
        ),
      },
      {
        accessorKey: 'periodType',
        header: '周期类型',
        // 未知码兜底显原值（源 PERIOD_TYPE_MAP[row.periodType] ?? row.periodType）
        cell: ({ row }) => (
          <span>
            {SETTLE_PERIOD_TYPE_LABEL[row.original.periodType] ??
              row.original.periodType}
          </span>
        ),
      },
      {
        accessorKey: 'periodStart',
        header: '周期',
        cell: ({ row }) => (
          <span className="tabular-nums">{periodText(row.original)}</span>
        ),
      },
      {
        accessorKey: 'txCount',
        header: '交易笔数',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.txCount}
          </span>
        ),
      },
      {
        accessorKey: 'principalTotal',
        header: '本金合计',
        cell: ({ row }) => <Money v={row.original.principalTotal} />,
      },
      {
        accessorKey: 'lpSplitTotal',
        header: 'LP 分成合计',
        cell: ({ row }) => <KeyFigure v={row.original.lpSplitTotal} />,
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createTime',
        header: '生成时间',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.createTime)}
          </span>
        ),
      },
    ],
    [],
  );

  const recordTableData = React.useMemo(
    () =>
      recordRows.map((r) => ({
        ...r,
        id: String(r.settleRecordId),
      })),
    [recordRows],
  );
  const orderTableData = React.useMemo(
    () => orderRows.map((r) => ({ ...r, id: String(r.orderId) })),
    [orderRows],
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {LBL.eyebrow}
        </div>
        <h1 className="text-xl font-semibold">{LBL.title}</h1>
      </div>

      {/* 页面级共享降级条（tab 外）：任一侧 0024 显示，orders 侧同 */}
      {down && <ServiceDownAlert traceId={down.traceId} />}

      <div className="rounded-lg border bg-card shadow-sm">
        <Tabs defaultValue="records" className="w-full">
          <TabsList className="m-4">
            <TabsTrigger value="records">{LBL.tabRecords}</TabsTrigger>
            <TabsTrigger value="orders">{LBL.tabOrders}</TabsTrigger>
          </TabsList>

          {/* ===== 结算流水 ===== */}
          <TabsContent value="records" className="mt-0 px-6 pb-6">
            <form
              onSubmit={recordsForm.handleSubmit((f) =>
                setRecordsParams(recordsFormToParams(f, 1)),
              )}
              className="mb-4"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FormField
                  name="startTime"
                  label="开始时间"
                  type="datetime-local"
                  register={recordsForm.register('startTime')}
                />
                <FormField
                  name="endTime"
                  label="结束时间"
                  type="datetime-local"
                  register={recordsForm.register('endTime')}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <Button type="submit">{LBL.query}</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    recordsForm.reset(EMPTY_RECORDS_FILTER);
                    setRecordsParams(recordsFormToParams(EMPTY_RECORDS_FILTER, 1));
                  }}
                >
                  {LBL.reset}
                </Button>
              </div>
            </form>

            <DataTable
              columns={recordColumns}
              data={recordTableData}
              isLoading={recordsQuery.isPending}
              emptyMessage={LBL.empty}
              pagination={{
                page: recordsParams.pageNum,
                pageSize: PAGE_SIZE,
                total: recordsTotal,
                onPageChange: (page) =>
                  setRecordsParams((prev) => ({ ...prev, pageNum: page })),
                pageSizeOptions: [PAGE_SIZE],
              }}
            />
          </TabsContent>

          {/* ===== 结算单 ===== */}
          <TabsContent value="orders" className="mt-0 px-6 pb-6">
            <form
              onSubmit={ordersForm.handleSubmit((f) =>
                setOrdersParams(ordersFormToParams(f, 1)),
              )}
              className="mb-4"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FormSelect
                  name="status"
                  control={ordersForm.control}
                  label="状态"
                  options={ORDER_STATUS_OPTIONS}
                />
                <FormSelect
                  name="cycle"
                  control={ordersForm.control}
                  label="周期"
                  options={ORDER_CYCLE_OPTIONS}
                />
                <FormField
                  name="startTime"
                  label="开始时间"
                  type="datetime-local"
                  register={ordersForm.register('startTime')}
                />
                <FormField
                  name="endTime"
                  label="结束时间"
                  type="datetime-local"
                  register={ordersForm.register('endTime')}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <Button type="submit">{LBL.query}</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    ordersForm.reset(EMPTY_ORDERS_FILTER);
                    setOrdersParams(ordersFormToParams(EMPTY_ORDERS_FILTER, 1));
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
              emptyMessage={LBL.empty}
              pagination={{
                page: ordersParams.pageNum,
                pageSize: PAGE_SIZE,
                total: ordersTotal,
                onPageChange: (page) =>
                  setOrdersParams((prev) => ({ ...prev, pageNum: page })),
                pageSizeOptions: [PAGE_SIZE],
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
