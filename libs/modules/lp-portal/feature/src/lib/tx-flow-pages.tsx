'use client';

/**
 * 交易流水页（B5，源 `src/views/tx-flow/index.vue` 1:1 语义迁移）。
 *
 * 源语义要点（对照 map「交易流水页」behaviors）：
 * - 三筛选分页表：POST /lp/tx-flow/list（{page:{pageNum,pageSize},data:{筛选}}，
 *   pageSize 固定 10；lpId 由 BFF 登录域注入不传）；
 * - 货币对下拉选项 POST /lp/pair/list（label `S→T`、value pairId），
 *   失败仅下拉为空且 pairMap 空——货币对列回落显原始 pairId，不触发降级条；
 * - 状态下拉全 13 值（TX_STATUS_MAP 的 Object.keys 顺序生成）；
 * - MSG_23_0024 → 页面级降级条 + 保留旧数据（TanStack refetch 出错保留
 *   上次成功 data），无全局 toast；非 0024 失败降级条清除、旧数据保留；
 * - 交易单号 txUuid 优先 txNo 兜底双兜底（F1，data-access txNoText）；
 * - 完成时间 completedTime === 0 严格判 0 显 '-'（未完成哨兵）；
 * - 行点击开链路抽屉：@myorg/shared/ui DataTable 无 row-click API（本文件
 *   白名单不含 shared/ui），以「查看链路」操作列按钮等价提供入口，
 *   抽屉挂载/卸载语义与源一致（drawerRow 非空挂载、closed 置 null）。
 *
 * 文案中文硬编码（kissen-admin 先例），不注册 i18n key。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Button,
  DataTable,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';

import {
  LP_PROJECT_ID,
  TX_STATUS_LABEL,
  isServiceDown,
  txNoText,
  useTxFlowListQuery,
  useTxFlowPairOptionsQuery,
  type TxFlowPairOption,
  type TxRow,
} from '@myorg/modules/lp-portal/data-access';
import { ChainDrawer, TxStatusBadge } from './chain-drawer';
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
  title: '交易流水',
  query: '查询',
  reset: '重置',
  records: '交易流水',
  empty: '暂无数据',
  viewChain: '查看链路',
} as const;

/** 下拉「全部」哨兵（FormSelect 禁空 value，非 ALL 即转 number 参与查询）。 */
const ALL = 'all';

/** 状态下拉选项：TX_STATUS_LABEL 的键序生成（源 Object.keys(TX_STATUS_MAP)）。 */
const STATUS_OPTIONS: SelectOption[] = Object.keys(TX_STATUS_LABEL).map((k) => ({
  value: k,
  label: TX_STATUS_LABEL[Number(k)],
}));

interface TxFlowFilterForm {
  pairId: string;
  status: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FILTER: TxFlowFilterForm = {
  pairId: ALL,
  status: ALL,
  startTime: '',
  endTime: '',
};

/** 已提交查询参数（时间已转毫秒 number；undefined 字段不进请求体）。 */
interface TxFlowQueryParams {
  pageNum: number;
  pairId?: number;
  status?: number;
  startTime?: number;
  endTime?: number;
}

function formToParams(f: TxFlowFilterForm, pageNum = 1): TxFlowQueryParams {
  return {
    pageNum,
    pairId: f.pairId !== ALL ? Number(f.pairId) : undefined,
    status: f.status !== ALL ? Number(f.status) : undefined,
    startTime: f.startTime ? new Date(f.startTime).getTime() : undefined,
    endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
  };
}

/* ================================================================== */
/* 列表页                                                               */
/* ================================================================== */

export function TxFlowListPage() {
  const { register, handleSubmit, reset, control } =
    useForm<TxFlowFilterForm>({ defaultValues: EMPTY_FILTER });
  const [params, setParams] = React.useState<TxFlowQueryParams>(() =>
    formToParams(EMPTY_FILTER),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);

  // 行点击目标（链路抽屉；非空挂载，closed 置 null 卸载）
  const [drawerRow, setDrawerRow] = React.useState<TxRow | null>(null);

  // 货币对下拉（非主数据：失败仅下拉为空 + pairMap 空，货币对列回落显
  // 原始 pairId，不触发降级条；错误 toast 由 lp-client 发）。
  const { data: pairOptions } = useTxFlowPairOptionsQuery(PROJECT_ID);
  const pairMap = React.useMemo(
    () =>
      new Map<number, TxFlowPairOption>(
        (pairOptions ?? []).map((p): [number, TxFlowPairOption] => [p.pairId, p]),
      ),
    [pairOptions],
  );

  /** 货币对列：pairId 查映射显「源→目标」，未知 pairId 显原值。 */
  function pairText(row: TxRow): string {
    const p = pairMap.get(row.pairId);
    return p ? `${p.sourceCurrency}→${p.targetCurrency}` : `${row.pairId}`;
  }

  const listQuery = useTxFlowListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      pairId: params.pairId,
      status: params.status,
      startTime: params.startTime,
      endTime: params.endTime,
    },
  });

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination.total ?? 0;

  // 0024 → 页面级降级条；非 0024 失败降级条清除（旧数据仍由 query 保留）。
  const err = listQuery.error;
  const serviceDown = err != null && isServiceDown(err) ? err : null;

  const pairSelectOptions = React.useMemo<SelectOption[]>(
    () => [
      { value: ALL, label: '全部货币对' },
      ...(pairOptions ?? []).map((p) => ({
        value: String(p.pairId),
        label: `${p.sourceCurrency}→${p.targetCurrency}`,
      })),
    ],
    [pairOptions],
  );

  const columns = React.useMemo<ColumnDef<TxRow & { id: string }>[]>(
    () => [
      {
        // 交易单号：txUuid 优先 txNo 兜底双兜底（F1）；show-overflow-tooltip
        accessorKey: 'txNo',
        header: '交易单号',
        cell: ({ row }) => {
          const text = txNoText(row.original);
          if (text === '-') return <span>-</span>;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block max-w-[220px] truncate font-mono text-xs">
                  {text}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm break-all font-mono text-xs">
                {text}
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: 'transactionId',
        header: '交易 ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.transactionId}</span>
        ),
      },
      {
        accessorKey: 'pairId',
        header: '货币对',
        cell: ({ row }) => <span>{pairText(row.original)}</span>,
      },
      {
        accessorKey: 'principal',
        header: '本金',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatMoney(row.original.principal)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => <TxStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createTime',
        header: '创建时间',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatTime(row.original.createTime)}
          </span>
        ),
      },
      {
        accessorKey: 'completedTime',
        header: '完成时间',
        // 源口径：completedTime === 0 严格判 0 = 未完成哨兵（非 truthy 判断）
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.completedTime === 0
              ? '-'
              : formatTime(row.original.completedTime)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setDrawerRow(row.original)}
          >
            {LBL.viewChain}
          </Button>
        ),
      },
    ],
    // pairText 闭包依赖 pairMap（未知 pairId 回落显原始 id 的口径）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pairMap],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.transactionId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {LBL.eyebrow}
        </div>
        <h1 className="text-xl font-semibold">{LBL.title}</h1>
      </div>

      {serviceDown && <ServiceDownAlert traceId={serviceDown.traceId} />}

      <form
        onSubmit={handleSubmit((f) => setParams(formToParams(f, 1)))}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询条件</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            name="startTime"
            label="开始时间"
            type="datetime-local"
            register={register('startTime')}
          />
          <FormField
            name="endTime"
            label="结束时间"
            type="datetime-local"
            register={register('endTime')}
          />
          <FormSelect
            name="pairId"
            control={control}
            label="货币对"
            options={pairSelectOptions}
          />
          <FormSelect
            name="status"
            control={control}
            label="状态"
            options={STATUS_OPTIONS}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{LBL.query}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset(EMPTY_FILTER);
              setParams(formToParams(EMPTY_FILTER, 1));
            }}
          >
            {LBL.reset}
          </Button>
        </div>
      </form>

      <TooltipProvider>
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-6 py-3">
            <div className="text-sm font-semibold">{LBL.records}</div>
          </div>
          <DataTable
            columns={columns}
            data={tableData}
            isLoading={listQuery.isLoading}
            emptyMessage={LBL.empty}
            pagination={{
              page: params.pageNum,
              pageSize,
              total,
              onPageChange: (page) =>
                setParams((prev) => ({ ...prev, pageNum: page })),
              onPageSizeChange: (n) => {
                setPageSize(n);
                setParams((prev) => ({ ...prev, pageNum: 1 }));
              },
              pageSizeOptions: [PAGE_SIZE],
            }}
          />
        </div>
      </TooltipProvider>

      {/* 链路抽屉：条件挂载（drawerRow 非空），closed → 置 null 卸载 */}
      {drawerRow && (
        <ChainDrawer
          row={drawerRow}
          pairText={pairText(drawerRow)}
          onClosed={() => setDrawerRow(null)}
        />
      )}
    </div>
  );
}
