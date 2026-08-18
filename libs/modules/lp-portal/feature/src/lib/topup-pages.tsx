'use client';

/**
 * 补资记录页（B2，源 `src/views/topup/index.vue` 1:1 迁移）。
 *
 * 源语义要点：
 * - 只读分页列表（POST /lp/topup/list，pageSize 固定 10，后端默认
 *   declare_time DESC，前端不传排序参数；lpId 由 BFF 登录域注入不传）；
 * - 页面顶部常驻 info 提示「补资发起将在后续版本开放」（发起功能后续版本）；
 * - 筛选：资金池（选项来自 POST /lp/pool/list，label
 *   `${currency}(${maskAddress(accountAddress)})`）/ 状态（1 已声明 2 已到账
 *   3 失败）/ 时间范围（源 datetimerange value-format="x" 产出毫秒时间戳
 *   字符串、load 时 Number() 转入；此处 datetime-local 字符串经
 *   Date.getTime() 等价产出毫秒 number，清空 → undefined）；
 * - MSG_23_0024 降级：页面级降级条 + 保留旧数据（TanStack refetch 出错时
 *   保留上次成功 data，isRefetchError 路径），无全局 toast；
 *   池下拉失败仅下拉为空，不触发降级条；
 * - 到账时间 confirmTime falsy（含 0=未到账）→ '-'。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';
import { Info } from 'lucide-react';

import {
  Alert,
  Badge,
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
  TOPUP_STATUS_LABEL,
  TOPUP_STATUS_VARIANT,
  isServiceDown,
  useTopupListQuery,
  useTopupPoolOptionsQuery,
  type TopupRow,
} from '@myorg/modules/lp-portal/data-access';
import { formatMoney, formatTime, maskAddress } from './format';
import { ServiceDownAlert } from './service-down-alert';

/* ================================================================== */
/* 常量与筛选表单                                                       */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'）。 */
const PAGE_SIZE = 10;

const LBL = {
  query: '查询',
  reset: '重置',
  records: '补资记录',
  empty: '暂无数据',
} as const;

/** 下拉「全部」哨兵（FormSelect 禁空 value，非 ALL 即转 number 参与查询）。 */
const ALL = 'all';

const STATUS_OPTIONS: SelectOption[] = [
  { value: ALL, label: '全部' },
  { value: '1', label: '已声明' },
  { value: '2', label: '已到账' },
  { value: '3', label: '失败' },
];

interface TopupFilterForm {
  poolId: string;
  status: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FILTER: TopupFilterForm = {
  poolId: ALL,
  status: ALL,
  startTime: '',
  endTime: '',
};

/** 已提交查询参数（时间已转毫秒 number；undefined 字段不进请求体）。 */
interface TopupQueryParams {
  pageNum: number;
  poolId?: number;
  status?: number;
  startTime?: number;
  endTime?: number;
}

function formToParams(f: TopupFilterForm, pageNum = 1): TopupQueryParams {
  return {
    pageNum,
    poolId: f.poolId !== ALL ? Number(f.poolId) : undefined,
    status: f.status !== ALL ? Number(f.status) : undefined,
    startTime: f.startTime ? new Date(f.startTime).getTime() : undefined,
    endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
  };
}

/* ================================================================== */
/* 列表页                                                               */
/* ================================================================== */

export function TopupListPage() {
  const { register, handleSubmit, reset, control } =
    useForm<TopupFilterForm>({ defaultValues: EMPTY_FILTER });
  const [params, setParams] = React.useState<TopupQueryParams>(() =>
    formToParams(EMPTY_FILTER),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);

  // 池下拉（非主数据：失败仅下拉为空，不触发降级条；错误 toast 由 lp-client 发）。
  const { data: poolOptions } = useTopupPoolOptionsQuery(PROJECT_ID);

  const listQuery = useTopupListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      poolId: params.poolId,
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

  const poolSelectOptions = React.useMemo<SelectOption[]>(
    () => [
      { value: ALL, label: '全部' },
      ...(poolOptions ?? []).map((p) => ({
        value: String(p.poolId),
        label: `${p.currency}(${maskAddress(p.accountAddress)})`,
      })),
    ],
    [poolOptions],
  );

  const columns = React.useMemo<ColumnDef<TopupRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'topupId',
        header: '补资 ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.topupId}</span>
        ),
      },
      { accessorKey: 'currency', header: '资金池' },
      {
        accessorKey: 'amount',
        header: '金额',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatMoney(row.original.amount)}
          </span>
        ),
      },
      {
        accessorKey: 'transferInAddress',
        header: '转入地址',
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs">
                {maskAddress(row.original.transferInAddress)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm break-all font-mono text-xs">
              {row.original.transferInAddress}
            </TooltipContent>
          </Tooltip>
        ),
      },
      {
        accessorKey: 'declareTime',
        header: '申报时间',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatTime(row.original.declareTime)}</span>
        ),
      },
      {
        accessorKey: 'confirmTime',
        header: '到账时间',
        // 源语义：confirmTime falsy（含 0=未到账）→ '-'
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.confirmTime ? formatTime(row.original.confirmTime) : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'csTxId',
        header: '货币系统交易 ID',
        // 源 show-overflow-tooltip：截断展示 + tooltip 全文
        cell: ({ row }) => {
          const csTxId = row.original.csTxId;
          if (!csTxId) return <span>-</span>;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block max-w-[180px] truncate font-mono text-xs">
                  {csTxId}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm break-all font-mono text-xs">
                {csTxId}
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: 'status',
        header: '状态',
        // 未知码兜底：文案显原值 + outline 变体（源 el-tag type 兜底 info）
        cell: ({ row }) => (
          <Badge variant={TOPUP_STATUS_VARIANT[row.original.status] ?? 'outline'}>
            {TOPUP_STATUS_LABEL[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.topupId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      {/* 常驻提示（源 el-alert info，不可关闭） */}
      <Alert>
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="font-medium leading-snug">补资发起将在后续版本开放</p>
      </Alert>

      {serviceDown && <ServiceDownAlert traceId={serviceDown.traceId} />}

      <form
        onSubmit={handleSubmit((f) => setParams(formToParams(f, 1)))}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询条件</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormSelect
            name="poolId"
            control={control}
            label="资金池"
            options={poolSelectOptions}
          />
          <FormSelect
            name="status"
            control={control}
            label="状态"
            options={STATUS_OPTIONS}
          />
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
    </div>
  );
}
