'use client';

/**
 * 系统操作日志页（原型 udpn-kissen-lp-portal OperationLogsPage /
 * OperationLogDetailsPage 对齐改造）。
 *
 * 原型语义要点（2026-09-24 拍板口径）：
 * - 列表：Time (UTC+8) / Operator / Module / Business Type / Request URL /
 *   Status / Duration / Trace ID / Actions(Details)；
 * - 筛选顺序照 §18：Date Range → Operator → Module(Select) → Status(Select)；
 *   Module 全集 = User Management / Liquidity Pool / Token Pair / Authentication；
 * - Status（Success/Failed，展示名 Status，接口字段仍 status 0/1）；
 * - 详情为独立页面（不再用行展开）：列表 Details 先暂存行再跳转；
 * - 详情：单层页头 → 单卡 Request；参数区保留，`operateParam` 有值时脱敏展示、缺省为 `-`；
 *   仅在 `errorMsg` 非空时显示 Error Info。
 *
 * CopyableId + formatUtc8; 时间列头 (UTC+8)。
 */
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Search } from 'lucide-react';

import { Badge, Button, DataTable, Input } from '@myorg/shared/ui';
import { FormSelect, type SelectOption } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  LOG_BIZ_TAG,
  LOG_BIZ_TEXT,
  LP_PROJECT_ID,
  useLogPageQuery,
  type LogRow,
} from '@myorg/modules/lp-portal/data-access';

import { formatUtc8 } from './proto-format';
import { CopyableId, Dash, ProtoStatusBadge } from './proto-ui';
import { LP_LOG_RESULT_MAP } from './proto-enums';
import { ProtoSortHeader, useProtoSort } from './proto-sort';

/* ================================================================== */
/* 常量与筛选表单                                                       */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'，无 size 选择器）。 */
const PAGE_SIZE = 10;

/** 日志域路由（registry 组前缀 /syslog；detail 为子 pageKey）。 */
const SYSLOG_LIST_PATH = '/syslog';

/** 下拉「全部」哨兵（FormSelect 禁空 value；system-pages 同款）。 */
const ALL = 'all';

/** 模块全集（原型 LOG_MODULES seed 常量；服务端过滤后下拉选项不缩水）。 */
const LOG_MODULE_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'All' },
  { value: 'User Management', label: 'User Management' },
  { value: 'Liquidity Pool', label: 'Liquidity Pool' },
  { value: 'Token Pair', label: 'Token Pair' },
  { value: 'Authentication', label: 'Authentication' },
];

/**
 * STATIC-FILLER(GAP-LP-10): /lp/log/page 无 status 筛选参数——Status 下拉
 * 仅前端本地过滤当前页行（分页 total 仍为未筛口径；后端补参数后切换）。
 */
const LOG_RESULT_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'All' },
  { value: 'Success', label: 'Success' },
  { value: 'Failed', label: 'Failed' },
];

const LBL = {
  title: 'Operation Logs',
  query: 'Search',
  reset: 'Reset',
} as const;

interface LogFilterForm {
  module: string;
  operateName: string;
  status: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FILTER: LogFilterForm = {
  module: ALL,
  operateName: '',
  status: ALL,
  startTime: '',
  endTime: '',
};

/** 已提交查询参数（时间已转毫秒 number；空串不进请求体；status 不进体，GAP-LP-10）。 */
interface LogQueryParams {
  pageNum: number;
  module?: string;
  operateName?: string;
  startTime?: number;
  endTime?: number;
}

function formToParams(f: LogFilterForm, pageNum = 1): LogQueryParams {
  const module = f.module === ALL ? '' : f.module;
  return {
    pageNum,
    module: module.trim() || undefined,
    operateName: f.operateName.trim() || undefined,
    startTime: f.startTime ? new Date(f.startTime).getTime() : undefined,
    endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
  };
}

/* ── 行暂存（列表 → 详情跨页传行；GAP-LP-10 无 /log/:id 详情端点， ── */
/* ── tx-flow 行暂存同款）                                          ── */

const LOG_STASH_PREFIX = 'lp_log_stash:';

function stashLogRow(logKey: string, row: LogRow): void {
  try {
    window.sessionStorage.setItem(
      `${LOG_STASH_PREFIX}${logKey}`,
      JSON.stringify(row),
    );
  } catch {
    // 私密模式 / 配额满等场景静默（详情页落 not-found 态）
  }
}

function peekLogRow(logKey: string): LogRow | null {
  try {
    const raw = window.sessionStorage.getItem(`${LOG_STASH_PREFIX}${logKey}`);
    return raw ? (JSON.parse(raw) as LogRow) : null;
  } catch {
    return null;
  }
}

const LOG_REDACT_KEY_PATTERN = /pass(word)?|token|secret|credential/i;
const LOG_REDACTED_VALUE = '••••••••';

function redactLogParams(raw: string | null | undefined): string {
  if (!raw) return '-';
  try {
    return JSON.stringify(
      JSON.parse(raw),
      (key, value) =>
        key && LOG_REDACT_KEY_PATTERN.test(key) ? LOG_REDACTED_VALUE : value,
      2,
    );
  } catch {
    return raw;
  }
}


/* ================================================================== */
/* 单元渲染                                                             */
/* ================================================================== */

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 源 BIZ_TAG（el-tag type）→ Badge 呈现（warning/success 无原生 variant，用近似色）。 */
const BIZ_BADGE: Record<
  string,
  { variant?: BadgeVariant; className?: string }
> = {
  primary: { variant: 'default' },
  warning: { className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  danger: { variant: 'destructive' },
  success: {
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  info: { variant: 'secondary' },
};

/**
 * 业务类型 tag（源 bizText/bizTagType 组合语义：
 * businessType 缺省 → '-' 纯文本；已知码走五色码表；未知码兜底 'Other'+info）。
 */
function BizTag({
  code,
  label,
  className,
}: {
  code?: number;
  label?: string;
  className?: string;
}) {
  if (code == null) {
    return <span>-</span>;
  }
  const style = BIZ_BADGE[LOG_BIZ_TAG[code] ?? 'info'] ?? BIZ_BADGE.info;
  return (
    <Badge {...style} className={className ?? style.className}>
      {label ?? LOG_BIZ_TEXT[code] ?? 'Other'}
    </Badge>
  );
}

/** 结果徽章（status 0 → Success/success；1 → Failed/danger；未知码兜底原值）。 */
function ResultBadge({ status }: { status: number }) {
  const entry = LP_LOG_RESULT_MAP[status];
  return (
    <ProtoStatusBadge
      label={entry?.label ?? String(status)}
      tone={status === 0 ? 'success' : 'danger'}
    />
  );
}


/* ================================================================== */
/* 列表页                                                               */
/* ================================================================== */

export function SyslogListPage() {
  const router = useRouter();
  const { register, control, handleSubmit, reset } =
    useForm<LogFilterForm>({ defaultValues: EMPTY_FILTER });
  const [params, setParams] = React.useState<LogQueryParams>(() =>
    formToParams(EMPTY_FILTER),
  );
  // STATIC-FILLER(GAP-LP-10)：Status 仅本地过滤，不进查询体（'' = 不过滤）
  const [statusFilter, setStatusFilter] = React.useState('');
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);

  const listQuery = useLogPageQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      module: params.module,
      operateName: params.operateName,
      startTime: params.startTime,
      endTime: params.endTime,
    },
  });

  // STATIC-FILLER(GAP-LP-10)：status 本地过滤（当前页口径，见常量区注释）
  const allRows = listQuery.data?.data ?? [];
  const rows = React.useMemo(
    () =>
      statusFilter
        ? allRows.filter(
            (r) => LP_LOG_RESULT_MAP[r.status]?.label === statusFilter,
          )
        : allRows,
    [allRows, statusFilter],
  );
  const total = listQuery.data?.pagination.total ?? 0;
  const hasFilter =
    params.module != null ||
    params.operateName != null ||
    params.startTime != null ||
    params.endTime != null ||
    statusFilter !== '';

  // 服务端 /lp/log/page 无排序参数——客户端当前页排序（GAP-LP-05 口径，
  // 后端补排序后切换）
  const sortGetters = React.useMemo(
    () => ({
      time: { value: (r: LogRow) => r.operateTime ?? 0 },
      operator: { value: (r: LogRow) => r.operateName ?? '' },
      duration: { value: (r: LogRow) => r.costTime ?? 0 },
    }),
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.operateLogId) })),
    [rows],
  );
  const { sorted, toggle, sortState } = useProtoSort(
    tableData,
    sortGetters,
    'time',
    'desc',
  );

  const columns = React.useMemo<ColumnDef<LogRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'operateTime',
        header: () => (
          <ProtoSortHeader
            label="Time"
            columnKey="time"
            toggle={toggle}
            sortState={sortState('time')}
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs tabular-nums">
            {row.original.operateTime != null
              ? formatUtc8(row.original.operateTime)
              : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'operateName',
        header: () => (
          <ProtoSortHeader
            label="Operator"
            columnKey="operator"
            toggle={toggle}
            sortState={sortState('operator')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-semibold">
            <Dash value={row.original.operateName} />
          </span>
        ),
      },
      {
        accessorKey: 'module',
        header: 'Module',
        cell: ({ row }) => (
          <Dash
            value={
              row.original.module?.toUpperCase() === 'LOGIN'
                ? 'Login Management'
                : row.original.module
            }
          />
        ),
      },
      {
        accessorKey: 'businessType',
        header: 'Business Type',
        cell: ({ row }) => <BizTag code={row.original.businessType} />,
      },
      {
        accessorKey: 'operateUrl',
        header: 'Request URL',
        cell: ({ row }) => (
          <span className="block max-w-[280px] truncate font-mono text-xs">
            <Dash value={row.original.operateUrl} />
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <ResultBadge status={row.original.status} />,
      },
      {
        accessorKey: 'costTime',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Duration"
              columnKey="duration"
              toggle={toggle}
              sortState={sortState('duration')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="block whitespace-nowrap text-right tabular-nums">
            {row.original.costTime != null
              ? `${row.original.costTime} ms`
              : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'traceId',
        header: 'Trace ID',
        cell: ({ row }) =>
          row.original.traceId ? (
            <CopyableId value={row.original.traceId} maxWidth={140} />
          ) : (
            '-'
          ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => {
              stashLogRow(String(row.original.operateLogId), row.original);
              router.push({
                pathname: `${SYSLOG_LIST_PATH}/detail`,
                query: { logId: String(row.original.operateLogId) },
              });
            }}
          >
            Details
          </Button>
        ),
      },
    ],
    [toggle, sortState, router],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-7">{LBL.title}</h1>
        </div>
      </div>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6">{LBL.title}</div>
            {!listQuery.isLoading ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {total} results
              </span>
            ) : null}
            {listQuery.dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatUtc8(listQuery.dataUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={handleSubmit((f) => {
            setParams(formToParams(f, 1));
            setStatusFilter(f.status === ALL ? '' : f.status);
          })}
        >
          {/* 筛选顺序照原型 §18：Date Range → Operator → Module → Status */}
          <div className="grid grid-cols-1 gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium leading-snug text-foreground">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="datetime-local"
                  aria-label="Date Range from"
                  {...register('startTime')}
                />
                <Input
                  type="datetime-local"
                  aria-label="Date Range to"
                  {...register('endTime')}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium leading-snug text-foreground">
                Operator
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search operator"
                  {...register('operateName')}
                />
              </div>
            </div>
            <FormSelect
              name="module"
              control={control}
              label="Module"
              options={LOG_MODULE_OPTIONS}
            />
            <FormSelect
              name="status"
              control={control}
              label="Status"
              options={LOG_RESULT_OPTIONS}
            />
            <div className="flex items-end gap-2">
              <Button type="submit">{LBL.query}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset(EMPTY_FILTER);
                  setStatusFilter('');
                  setParams(formToParams(EMPTY_FILTER, 1));
                }}
              >
                {LBL.reset}
              </Button>
            </div>
          </div>
        </form>

        <div className="p-4">
          <DataTable
            columns={columns}
            data={sorted}
            isLoading={listQuery.isLoading}
            emptyMessage={
              hasFilter
                ? 'No records found. Try changing the filters.'
                : 'No operation logs yet.'
            }
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
      </section>
    </div>
  );
}

/* ================================================================== */
/* 详情页（原型 OperationLogDetailsPage；/syslog/detail?logId=）         */
/* ================================================================== */

/** 详情只读字段（label 上 / 值下加粗）。 */
function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium capitalize text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 min-w-0 break-all text-sm font-medium leading-6">
        {children}
      </dd>
    </div>
  );
}

/** 详情页头（左返回列表 + 标题 + 徽章 + 元信息行；pool/tx-flow 详情同款）。 */
function DetailHeader({
  title,
  badge,
  description,
}: {
  title: string;
  badge?: React.ReactNode;
  description?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-start gap-3">
      <Button
        type="button"
        variant="outline"
        size="iconSm"
        aria-label="Back to Operation Logs"
        onClick={() => router.push(SYSLOG_LIST_PATH)}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold leading-7">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function SyslogDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logId = searchParams.get('logId');

  // STATIC-FILLER(GAP-LP-10)：无 /log/:id 详情端点——列表行暂存恢复
  //（sessionStorage；深链无暂存 → not-found 态）
  const row = React.useMemo(
    () => (logId ? peekLogRow(logId) : null),
    [logId],
  );

  if (logId == null || row == null) {
    return (
      <div className="space-y-4">
        <DetailHeader title="Operation Details" />
        <section className="rounded-lg border border-border/60 bg-card">
          <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
            <p className="text-sm font-medium">Operation log not found</p>
            <p className="text-sm text-muted-foreground">
              The record may have been removed. Go back to the list.
            </p>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(SYSLOG_LIST_PATH)}
              >
                Back to Operation Logs
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 身份头：结果徽章 + 元信息行（Trace ID 可复制 | Timestamp） */}
      <DetailHeader
        title="Operation Details"
        badge={<ResultBadge status={row.status} />}
        description={
          <>
            <span className="inline-flex items-center gap-1">
              Trace ID:{' '}
              {row.traceId ? <CopyableId value={row.traceId} /> : '-'}
            </span>
            {row.operateTime != null && (
              <>
                <span aria-hidden="true">|</span>
                <span>
                  Timestamp{' '}
                  <b className="font-semibold tabular-nums text-foreground">
                    {formatUtc8(row.operateTime)}
                  </b>
                </span>
              </>
            )}
          </>
        }
      />

      <div className="space-y-4">
        <section className="rounded-lg border border-border/60 bg-card p-4 text-card-foreground shadow-float">
          <h2 className="mb-4 text-sm font-semibold leading-5">Request</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <DetailField label="Module">
              <Dash
                value={
                  row.module?.toUpperCase() === 'LOGIN'
                    ? 'Login Management'
                    : row.module
                }
              />
            </DetailField>
            <DetailField label="Business Type">
              <BizTag
                code={row.businessType}
                label={row.businessType === 4 ? 'Sign-in' : undefined}
                className={
                  row.businessType === 4
                    ? 'rounded-full border-transparent bg-teal-700 text-white dark:bg-teal-700 dark:text-white'
                    : undefined
                }
              />
            </DetailField>
            <DetailField label="Request URL">
              {row.operateUrl ? (
                <code className="break-all font-mono text-[13px] font-normal">
                  {row.operateUrl}
                </code>
              ) : (
                <span className="font-normal text-muted-foreground">-</span>
              )}
            </DetailField>
            <DetailField label="Trace ID">
              {row.traceId ? <CopyableId value={row.traceId} /> : '-'}
            </DetailField>
            <DetailField label="Duration">
              {row.costTime != null ? `${row.costTime} ms` : '-'}
            </DetailField>
            <DetailField label="Operator">
              <Dash value={row.operateName} />
            </DetailField>
          </dl>
          <div className="mt-4 border-t border-border/60 pt-4">
            <div className="mb-2 text-xs font-medium capitalize text-muted-foreground">
              Request Parameters
            </div>
            <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground">
              {redactLogParams(row.operateParam)}
            </pre>
          </div>
        </section>

        {row.errorMsg ? (
          <section className="rounded-lg border border-border/60 bg-card p-4 text-card-foreground shadow-float">
            <h2 className="mb-4 text-sm font-semibold leading-5">Error Info</h2>
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded bg-destructive/10 p-3 font-mono text-xs leading-5 text-destructive">
              {row.errorMsg}
            </pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}
