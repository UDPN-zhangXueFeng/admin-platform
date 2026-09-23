'use client';

/**
 * 操作日志域页面（列表 + 详情；对齐原型 BP OperationLogsPage / OperationLogDetailPage）。
 *
 * 列表（原型 OperationLogsPage 语义要点）：
 * - DataTable 九列（Time (UTC+8) / Operator / Module / Business Type / Request URL /
 *   Status / Duration / Trace ID / Actions）；列偏好 localStorage 持久化（Trace ID
 *   默认隐藏，1440 宽放不下全列）；行内展开已废除——Details 入独立详情页。
 * - 筛选（原型 Filters embedded 即时生效，无 Query 按钮）：Date Range → Operator →
 *   Module(Select) → Status(Select)；Operator/Status 无服务端参数——当前页本地过滤
 *   过渡（见组件内注释）；Date Range/Module 走 /log/page 服务端参数。
 * - 排序：服务端 /log/page 无排序参数——当前页内排序（tx 列表同口径）。
 *
 * 详情（/log/detail?logId=）：
 * - STATIC-FILLER(GAP-GW-02): 无 /log/{id} 详情端点——列表行暂存 sessionStorage
 *   （gw_log_stash:{logId}）渲染；深链无暂存 → not-found 卡。
 * - 版式：单层页头（Back + Log Details + 结果徽章 + Trace ID|Timestamp 元信息行）→
 *   双卡 Request / Error Info；请求参数脱敏（password/token 类键 → ••••••••）。
 */
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

import { Badge, Button, DataTable, useToast } from '@myorg/shared/ui';
import { FormField, FormSelect, createFormResolver } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_GATEWAY_PROJECT_ID,
  logBusinessTypeText,
  logBusinessTypeVariant,
  useLogPageQuery,
  type LogListReq,
  type LogRow,
} from '@myorg/modules/kissen-gateway/data-access';

import { OPT_ALL, orDash, toEpochMs } from './kit';
import { formatDuration, formatUtc8 } from './proto-format';
import { CopyableId, ProtoStatusBadge } from './proto-ui';
import { PROTO_LOG_RESULT, protoStatusText } from './proto-enums';
import {
  ColumnPicker,
  SortHeader,
  compareProtoValues,
  filterVisibleColumns,
  useColumnPreferences,
  useTableSort,
  type ProtoColumnDef,
} from './proto-table';

/** 列表路由（registry 接线口径）；详情为子路由 /log/detail?logId=。 */
const LOG_LIST_PATH = '/system/log';
const LOG_DETAIL_PATH = '/log/detail';

/** 源 el-pagination 固定 10/页（layout 无 sizes 选择器）。 */
const LOG_PAGE_SIZE = 10;

/* ─────────────── 列契约 / 排序 / 列偏好（原型 OperationLogsPage COLUMNS） ─────────────── */

/** 列契约（原型 COLUMNS 逐字，列名按任务口径：Time (UTC+8)/Business Type/Status）；
 * Trace ID 默认隐藏（原型 defaultVisible:false）。 */
const LOG_COLUMNS: ProtoColumnDef[] = [
  { id: 'createdAt', label: 'Time (UTC+8)', required: true },
  { id: 'operator', label: 'Operator' },
  { id: 'module', label: 'Module' },
  { id: 'businessType', label: 'Business Type' },
  { id: 'operateUrl', label: 'Request URL' },
  { id: 'status', label: 'Status', required: true },
  { id: 'duration', label: 'Duration' },
  { id: 'traceId', label: 'Trace ID', defaultVisible: false },
  { id: 'actions', label: 'Actions', required: true },
];

/** 列偏好 localStorage 键（tx/token 列表同语义）。 */
const LOG_COLUMN_PREF_KEY = 'gw.log-list.columns';

/** 排序键 → 行取值（原型 sortBy 白名单；Request URL/Status/Actions 不可排序）。 */
const LOG_SORT_ACCESSORS: Record<
  string,
  (r: LogRow) => string | number | null | undefined
> = {
  createdAt: (r) => r.operateTime,
  operator: (r) => r.operateName,
  module: (r) => r.module,
  businessType: (r) => r.businessType,
  duration: (r) => r.costTime,
  traceId: (r) => r.traceId,
};

/* ─────────────── 筛选表单（原型 Filters embedded：即时生效） ─────────────── */

const logFilterSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  operator: z.string(),
  module: z.string(),
  status: z.string(),
});
type LogFilterForm = z.infer<typeof logFilterSchema>;

const LOG_FILTER_DEFAULT: LogFilterForm = {
  startTime: '',
  endTime: '',
  operator: '',
  module: OPT_ALL,
  status: OPT_ALL,
};

/** 已提交筛选：req 为服务端参数（module + 毫秒时间区间）；operator/status 无服务端
 * 参数（本地过滤过渡），不进请求体。 */
interface LogQueryState {
  req: LogListReq;
  operator: string;
  status: string;
}

/** RHF 筛选表单 → 提交态。原型 DateRangeField 日粒度：from 当日 00:00 / to 当日 23:59。 */
function formToQuery(form: LogFilterForm): LogQueryState {
  return {
    req: {
      module: form.module === OPT_ALL ? undefined : form.module,
      startTime: form.startTime ? toEpochMs(`${form.startTime}T00:00`) : undefined,
      endTime: form.endTime ? toEpochMs(`${form.endTime}T23:59`) : undefined,
    },
    operator: form.operator.trim(),
    status: form.status === OPT_ALL ? '' : form.status,
  };
}

/* ─────────────── 行暂存 + 请求参数脱敏（GAP-GW-02） ─────────────── */

const LOG_STASH_PREFIX = 'gw_log_stash:';

/** 暂存被点击的行（sessionStorage；写失败静默——详情页落 not-found 态）。 */
function stashLogRow(logId: string, row: LogRow): void {
  try {
    sessionStorage.setItem(`${LOG_STASH_PREFIX}${logId}`, JSON.stringify(row));
  } catch {
    /* 隐私模式/配额超限时放弃暂存 */
  }
}

/** 读取暂存行；缺失/损坏/ID 不符 → null。 */
function peekLogRow(logId: string): LogRow | null {
  try {
    const raw = sessionStorage.getItem(`${LOG_STASH_PREFIX}${logId}`);
    const parsed = raw ? (JSON.parse(raw) as LogRow) : null;
    return parsed?.operateLogId === Number(logId) ? parsed : null;
  } catch {
    return null;
  }
}

/** 脱敏键名规则（GAP-GW-02 处置列：password/token 类键 → ••••••••，前端实现）。 */
const REDACT_KEY_PATTERN = /pass(word)?|token|secret|credential/i;
const REDACTED_TEXT = '••••••••';

/** 请求参数脱敏展示：JSON 可解析 → 命中敏感键的值替换掩码后 pretty-print；解析失败
 * 按原文透出（后端格式未知，不做破坏性改写）；空值 → '-'。 */
function redactParams(raw: string | null | undefined): string {
  if (!raw) return '-';
  try {
    return JSON.stringify(
      JSON.parse(raw),
      (key, value) => (key && REDACT_KEY_PATTERN.test(key) ? REDACTED_TEXT : value),
      2,
    );
  } catch {
    return raw;
  }
}

/* ================================================================== */
/* 列表页（registry：/system/log → list） */
/* ================================================================== */

export function LogListPage() {
  const router = useRouter();
  const toast = useToast();

  const { register, reset, control, watch } = useForm<LogFilterForm>({
    resolver: createFormResolver(logFilterSchema),
    defaultValues: LOG_FILTER_DEFAULT,
  });

  const [query, setQuery] = React.useState<LogQueryState>(() =>
    formToQuery(LOG_FILTER_DEFAULT),
  );
  const [pageNum, setPageNum] = React.useState(1);
  const { sort, toggle } = useTableSort('createdAt', 'desc');
  const columnPreferences = useColumnPreferences(
    LOG_COLUMN_PREF_KEY,
    LOG_COLUMNS,
  );

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } =
    useLogPageQuery(KISSEN_GATEWAY_PROJECT_ID, {
      pageNum,
      pageSize: LOG_PAGE_SIZE,
      filter: query.req,
    });

  /* 源 catch 静默靠拦截器；本门户约定 toast 显性提示 + Retry。 */
  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load operation logs', {
        description:
          error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  /* 原型 Filters embedded：输入即时生效（300ms 防抖回写 + 回页 1），无 Query
   * 按钮；Reset 一键清空（tx/token 页同款口径）。 */
  const filterTimer = React.useRef<number | null>(null);
  React.useEffect(() => {
    const subscription = watch((values) => {
      if (filterTimer.current != null) window.clearTimeout(filterTimer.current);
      filterTimer.current = window.setTimeout(() => {
        setQuery(formToQuery(values as LogFilterForm));
        setPageNum(1);
      }, 300);
    });
    return () => {
      subscription.unsubscribe();
      if (filterTimer.current != null) window.clearTimeout(filterTimer.current);
    };
  }, [watch]);

  /** 渲染期订阅：筛选表单任一值变化即重算 hasFilter（Reset 置灰态即时跟随）。 */
  const watched = watch();
  const hasFilter =
    (watched.startTime ?? '') !== '' ||
    (watched.endTime ?? '') !== '' ||
    (watched.operator ?? '').trim() !== '' ||
    (watched.module ?? OPT_ALL) !== OPT_ALL ||
    (watched.status ?? OPT_ALL) !== OPT_ALL;

  const onReset = React.useCallback(() => {
    reset(LOG_FILTER_DEFAULT);
    setQuery(formToQuery(LOG_FILTER_DEFAULT));
    setPageNum(1);
  }, [reset]);

  const allRows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  /* 本地过滤过渡（/log/page filter 无 operateName/status 参数；Operator 模糊 /
   * Status 精确仅对当前页生效，分页 total 仍为未筛口径；后端参数就绪后回写为
   * 服务端检索）。 */
  const rows = React.useMemo(() => {
    const q = query.operator.toLowerCase();
    return allRows.filter(
      (r) =>
        (!q || (r.operateName ?? '').toLowerCase().includes(q)) &&
        (!query.status || String(r.status ?? '') === query.status),
    );
  }, [allRows, query]);

  /** Module 下拉 options 从当前页数据派生（原型 options 来自接口；token 页同口径）。 */
  const moduleSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All' },
      ...[...new Set(allRows.map((r) => r.module).filter((v): v is string => !!v))].sort(
        (a, b) => a.localeCompare(b),
      ).map((m) => ({ value: m, label: m })),
    ],
    [allRows],
  );

  /** Status 筛选 options：按 rank 排序（0 Success → 1 Failed，不按字母）。 */
  const statusSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All' },
      ...Object.entries(PROTO_LOG_RESULT)
        .sort(([, a], [, b]) => a.rank - b.rank)
        .map(([code, meta]) => ({ value: code, label: meta.text })),
    ],
    [],
  );

  /* 排序：服务端 /log/page 无排序参数——当前页内排序（可排键白名单与原型一致：
   * createdAt / operator / module / businessType / duration / traceId；
   * 默认 createdAt desc；tx 列表同口径）。 */
  const sortedRows = React.useMemo(() => {
    const accessor = sort.key ? LOG_SORT_ACCESSORS[sort.key] : undefined;
    if (!accessor) return rows;
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...rows].sort(
      (a, b) => compareProtoValues(accessor(a), accessor(b)) * dir,
    );
  }, [rows, sort]);

  const tableData = React.useMemo(
    () => sortedRows.map((r) => ({ ...r, id: String(r.operateLogId) })),
    [sortedRows],
  );

  /** 详情跳转（registry：/log/detail?logId=）：先暂存行数据——GAP-GW-02 无
   * /log/{id} 端点，详情页直接以行数据渲染。 */
  const onView = React.useCallback(
    (row: LogRow) => {
      stashLogRow(String(row.operateLogId), row);
      router.push(`${LOG_DETAIL_PATH}?logId=${row.operateLogId}`);
    },
    [router],
  );

  /**
   * 列序对齐 BP 原型 COLUMNS（列名按任务口径：Time (UTC+8) / Business Type /
   * Status / Duration / Trace ID）：Trace ID 默认隐藏，Actions 为 Details 入口。
   */
  const columns = React.useMemo<ColumnDef<LogRow & { id: string }>[]>(() => {
    return [
      {
        id: 'createdAt',
        header: (
          <SortHeader
            label="Time (UTC+8)"
            direction={sort.key === 'createdAt' ? sort.direction : null}
            onToggle={() => toggle('createdAt')}
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatUtc8(row.original.operateTime)}
          </span>
        ),
      },
      {
        id: 'operator',
        header: (
          <SortHeader
            label="Operator"
            direction={sort.key === 'operator' ? sort.direction : null}
            onToggle={() => toggle('operator')}
          />
        ),
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate" title={orDash(row.original.operateName)}>
            {orDash(row.original.operateName)}
          </span>
        ),
      },
      {
        id: 'module',
        header: (
          <SortHeader
            label="Module"
            direction={sort.key === 'module' ? sort.direction : null}
            onToggle={() => toggle('module')}
          />
        ),
        cell: ({ row }) => orDash(row.original.module),
      },
      {
        id: 'businessType',
        header: (
          <SortHeader
            label="Business Type"
            direction={sort.key === 'businessType' ? sort.direction : null}
            onToggle={() => toggle('businessType')}
          />
        ),
        cell: ({ row }) => (
          <Badge variant={logBusinessTypeVariant(row.original.businessType)}>
            {logBusinessTypeText(row.original.businessType)}
          </Badge>
        ),
      },
      {
        id: 'operateUrl',
        header: 'Request URL',
        cell: ({ row }) => (
          <span
            className="block max-w-[280px] truncate font-mono text-xs"
            title={orDash(row.original.operateUrl)}
          >
            {orDash(row.original.operateUrl)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <ProtoStatusBadge
            label={protoStatusText(PROTO_LOG_RESULT, row.original.status)}
            tone={row.original.status === 0 ? 'success' : 'danger'}
          />
        ),
      },
      {
        id: 'duration',
        header: (
          <SortHeader
            label="Duration"
            direction={sort.key === 'duration' ? sort.direction : null}
            onToggle={() => toggle('duration', 'desc')}
            numeric
          />
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatDuration(row.original.costTime)}
          </span>
        ),
      },
      {
        id: 'traceId',
        header: (
          <SortHeader
            label="Trace ID"
            direction={sort.key === 'traceId' ? sort.direction : null}
            onToggle={() => toggle('traceId')}
          />
        ),
        cell: ({ row }) => <CopyableId value={row.original.traceId} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => onView(row.original)}
          >
            Details
          </Button>
        ),
      },
    ];
  }, [onView, sort, toggle]);

  /* 列偏好：required 列恒显，其余按用户选择过滤（Trace ID 默认隐藏）。 */
  const visibleColumns = React.useMemo(
    () =>
      filterVisibleColumns(
        columns,
        LOG_COLUMNS,
        columnPreferences.isColumnVisible,
      ),
    [columns, columnPreferences],
  );

  return (
    <div className="space-y-4">
      {/* 页头（原型 PageHeader：标题 + 一句话口径，文案逐字）。 */}
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          SYSTEM
        </div>
        <h1 className="text-xl font-semibold">Operation Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every write and sign-in this portal performed, with the request
          result and the trace id for follow-up.
        </p>
      </div>

      <section className="rounded-lg border border-border/60 bg-card">
        {/* §6.2 Table Panel 头条：实体名 + 结果数 + 刷新时间 + 页面级操作右置。 */}
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Operation Logs
            </div>
            {data && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {total} results
              </span>
            )}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatUtc8(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ColumnPicker
              columns={LOG_COLUMNS}
              isColumnVisible={columnPreferences.isColumnVisible}
              onColumnVisibilityChange={columnPreferences.setColumnVisible}
              onReset={columnPreferences.resetColumns}
            />
          </div>
        </div>

        {/* §6.2 Filter Bar（原型 Filters embedded：即时生效，无 Query 按钮；
            顺序照原型 Date Range → Operator → Module → Status）。 */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              name="startTime"
              label="Date From"
              type="date"
              register={register('startTime')}
            />
            <FormField
              name="endTime"
              label="Date To"
              type="date"
              register={register('endTime')}
            />
            {/* Operator 无服务端参数——当前页本地模糊过滤（见 rows 过渡注释）。 */}
            <FormField
              name="operator"
              label="Operator"
              placeholder="Fuzzy match"
              register={register('operator')}
            />
            <FormSelect
              name="module"
              control={control}
              label="Module"
              options={moduleSelectOptions}
              placeholder="All"
            />
            <FormSelect
              name="status"
              control={control}
              label="Status"
              options={statusSelectOptions}
              placeholder="All"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!hasFilter}
              onClick={onReset}
            >
              Reset
            </Button>
          </div>
        </form>

        <div className="p-4">
          <DataTable
            columns={visibleColumns}
            data={tableData}
            isLoading={isLoading}
            emptyMessage="No operation logs found. Try adjusting the filters or widening the date range."
          />
          <LogPager
            total={total}
            pageNum={pageNum}
            pageSize={LOG_PAGE_SIZE}
            onPageChange={setPageNum}
          />
        </div>
      </section>
    </div>
  );
}

/**
 * 分页（源 el-pagination total + prev/next；pageSize 固定 10，无 sizes/jumper。
 * 有意差异：省略源 layout 中的页码 pager，对齐 shared DataTable 无 sizes
 * 选择器时的 prev/next 语义）。
 */
function LogPager({
  total,
  pageNum,
  pageSize,
  onPageChange,
}: {
  total: number;
  pageNum: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-xs tabular-nums text-muted-foreground">
        {total} records · Page {pageNum} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={pageNum <= 1}
          className="h-8 w-8"
          onClick={() => onPageChange(pageNum - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={pageNum >= totalPages}
          className="h-8 w-8"
          onClick={() => onPageChange(pageNum + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 详情页（registry：/log/detail → detail；原型 OperationLogDetailPage） */
/* ================================================================== */

/** 详情只读字段（label 上 / 值下加粗；LP/ADM 详情卡同款 dl 行）。 */
function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 min-w-0 break-all text-sm font-semibold">
        {children}
      </dd>
    </div>
  );
}

export function LogDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logId = searchParams.get('logId')?.trim() ?? '';

  /* STATIC-FILLER(GAP-GW-02): 无 /log/{id} 详情端点——详情以列表暂存行渲染
   *（sessionStorage gw_log_stash:{logId}）；深链/换标签页无暂存 → not-found 态。 */
  const row = React.useMemo(() => (logId ? peekLogRow(logId) : null), [logId]);

  const backToList = React.useCallback(
    () => router.push(LOG_LIST_PATH),
    [router],
  );

  if (row == null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Back to list"
            onClick={backToList}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">Log Details</h1>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-10 text-center shadow-float">
          <div className="text-sm font-semibold">Operation log not found</div>
          <p className="mt-2 text-sm text-muted-foreground">
            The record may have been removed. Go back to the list.
          </p>
          <Button variant="outline" className="mt-4" onClick={backToList}>
            Back to Operation Logs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 身份头（原型 PageHeader）：← Back + 标题 + 结果徽章 + 元信息行
          （Trace ID | Timestamp，文案逐字）。 */}
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="icon"
          className="mt-0.5 shrink-0"
          aria-label="Back to list"
          onClick={backToList}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              Log Details
            </h1>
            <ProtoStatusBadge
              label={protoStatusText(PROTO_LOG_RESULT, row.status)}
              tone={row.status === 0 ? 'success' : 'danger'}
            />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              Trace ID:{' '}
              {row.traceId ? <CopyableId value={row.traceId} /> : orDash(null)}
            </span>
            <span aria-hidden="true">|</span>
            <span>
              Timestamp <span className="text-foreground">{formatUtc8(row.operateTime)}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {/* Request 卡（原型 DefinitionList 六字段；字段名与列表列口径一致）。 */}
        <section className="rounded-lg border border-border/60 bg-card p-6 shadow-float">
          <div className="mb-4 text-sm font-semibold">Request</div>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailField label="Module">{orDash(row.module)}</DetailField>
            <DetailField label="Business Type">
              <Badge variant={logBusinessTypeVariant(row.businessType)}>
                {logBusinessTypeText(row.businessType)}
              </Badge>
            </DetailField>
            <DetailField label="Request URL">
              {row.operateUrl ? (
                <code className="break-all font-mono text-[13px] font-normal">
                  {row.operateUrl}
                </code>
              ) : (
                orDash(row.operateUrl)
              )}
            </DetailField>
            <DetailField label="Trace ID">
              {row.traceId ? <CopyableId value={row.traceId} /> : orDash(null)}
            </DetailField>
            <DetailField label="Duration">
              {formatDuration(row.costTime)}
            </DetailField>
            <DetailField label="Operator">
              {orDash(row.operateName)}
            </DetailField>
          </dl>
          {/* 请求参数脱敏展示（GAP-GW-02 处置列：password/token 类键 →
              ••••••••，前端实现；源列表页展开行的 Request Params 迁入）。 */}
          <div className="mt-4 border-t border-border/60 pt-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Request Parameters
            </div>
            <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 px-2.5 py-2 text-xs leading-relaxed text-foreground">
              {redactParams(row.operateParam)}
            </pre>
          </div>
        </section>

        {/* Error Info 卡（errorMsg 有 → 红 pre；无 → 空态，文案逐字）。 */}
        <section className="rounded-lg border border-border/60 bg-card p-6 shadow-float">
          <div className="mb-4 text-sm font-semibold">Error Info</div>
          {row.errorMsg ? (
            <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-red-500/10 p-3 font-mono text-xs leading-5 text-red-600 dark:text-red-400">
              {row.errorMsg}
            </pre>
          ) : (
            <div className="py-6 text-center">
              <div className="text-sm font-semibold">No error recorded</div>
              <p className="mt-2 text-sm text-muted-foreground">
                This operation finished without an error entry.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
