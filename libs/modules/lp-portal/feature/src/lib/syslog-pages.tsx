'use client';

/**
 * 系统操作日志页（C4，源 `src/views/system/log/index.vue` 1:1 迁移）。
 *
 * 源语义要点：
 * - 只读分页列表（POST /lp/log/page，pageSize 固定 10；源分页 layout
 *   'total, prev, pager, next' → 本地 Total + Prev/Next 页脚）；
 * - lp_id 不传，后端按登录 LP 域过滤（跨域数据不可见）；
 * - 筛选：模块（模糊）/ 操作人（模糊）/ 时间范围（源 datetimerange
 *   value-format="x" 毫秒字符串；datetime-local 经 Date.getTime() 等价产出 number）；
 * - 首列行展开（el-table type="expand" 等价）：请求参数 operateParam pre（空 '-'）
 *   + 异常信息 errorMsg 红色 pre（空 '-'）；shared DataTable 无展开结构，
 *   按 pair-pages 既有先例手写平台样式表格（多行可同时展开）；
 * - 业务类型 tag 五色码表（LOG_BIZ_TEXT/LOG_BIZ_TAG，未知码兜底 'Other'+info，
 *   无码 '-'）；状态 0 正常 success / 否则 destructive；
 * - 耗时 costTime 仅判空缺（?? '-'），不掺 0/非数值特判（源同款）；列头携带单位；
 * - 操作接口 / TraceId 列截断省略 + hover 全文 tooltip（源 show-overflow-tooltip）；
 * - 时间列一律共享 formatTime（feature/src/lib/format.ts，en-US 口径统一裁决），
 *   私有 zh-CN fmtTime 变体废除。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

import {
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';

import {
  LOG_BIZ_TAG,
  LOG_BIZ_TEXT,
  LP_PROJECT_ID,
  useLogPageQuery,
  type LogRow,
} from '@myorg/modules/lp-portal/data-access';

import { formatTime } from './format';

/* ================================================================== */
/* 常量与筛选表单                                                       */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'，无 size 选择器）。 */
const PAGE_SIZE = 10;

const LBL = {
  eyebrow: 'SYSTEM',
  title: 'System Log',
  entity: 'System Logs',
  countUnit: 'logs',
  query: 'Search',
  reset: 'Reset',
  empty: 'No operation logs match the current filters',
  expand: 'Expand',
  collapse: 'Collapse',
} as const;

interface LogFilterForm {
  module: string;
  operateName: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FILTER: LogFilterForm = {
  module: '',
  operateName: '',
  startTime: '',
  endTime: '',
};

/** 已提交查询参数（时间已转毫秒 number；空串不进请求体）。 */
interface LogQueryParams {
  pageNum: number;
  module?: string;
  operateName?: string;
  startTime?: number;
  endTime?: number;
}

function formToParams(f: LogFilterForm, pageNum = 1): LogQueryParams {
  return {
    pageNum,
    module: f.module.trim() || undefined,
    operateName: f.operateName.trim() || undefined,
    startTime: f.startTime ? new Date(f.startTime).getTime() : undefined,
    endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
  };
}

/* ================================================================== */
/* 展开列表（shared DataTable 无 expand 结构：平台样式手写表格）          */
/* ================================================================== */

/** 展开列 + 主列（操作时间/操作人/模块/业务类型/接口/状态/耗时/TraceId）。 */
const COL_COUNT = 9;


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
function BizTag({ code }: { code?: number }) {
  if (code == null) {
    return <span>-</span>;
  }
  const style = BIZ_BADGE[LOG_BIZ_TAG[code] ?? 'info'] ?? BIZ_BADGE.info;
  return <Badge {...style}>{LOG_BIZ_TEXT[code] ?? 'Other'}</Badge>;
}

/** 数值文本（源 .num 类：等宽字体 + 表格数字对齐）。 */
function Num({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs tabular-nums">{children}</span>
  );
}

/** 截断省略 + 悬浮全文 tooltip（源 show-overflow-tooltip 等价：仅溢出时弹出）。 */
function EllipsisCell({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open}>
        <TooltipTrigger asChild>
          <div
            ref={ref}
            onPointerEnter={() => {
              const el = ref.current;
              if (el && el.scrollWidth > el.clientWidth) setOpen(true);
            }}
            onPointerLeave={() => setOpen(false)}
            className="truncate"
          >
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          className="max-w-80 select-text whitespace-normal break-all font-mono text-xs leading-relaxed"
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** 行展开区：请求参数 pre（空 '-'）+ 异常信息红色 pre（空 '-'）（源 expand 模板）。 */
function ExpandBody({ row }: { row: LogRow }) {
  return (
    <div className="flex flex-col gap-3 py-2 pl-12 pr-2">
      <div>
        <div className="mb-1 text-xs text-muted-foreground">
          Request Params
        </div>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border/50 bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          {row.operateParam || '-'}
        </pre>
      </div>
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Error Message</div>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border/50 bg-muted p-3 text-xs leading-relaxed text-destructive">
          {row.errorMsg || '-'}
        </pre>
      </div>
    </div>
  );
}

/** 页脚翻页按钮（同 shared DataTable PaginationButton 样式口径）。 */
function PagerButton({
  children,
  disabled,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-sm font-medium ${
        disabled ? 'pointer-events-none opacity-50' : ''
      } hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ================================================================== */
/* 列表页                                                               */
/* ================================================================== */

export function SyslogListPage() {
  const { register, handleSubmit, reset } =
    useForm<LogFilterForm>({ defaultValues: EMPTY_FILTER });
  const [params, setParams] = React.useState<LogQueryParams>(() =>
    formToParams(EMPTY_FILTER),
  );
  const [pageSize] = React.useState(PAGE_SIZE);

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

  // 展开态（el-table expand 语义：多行可同时展开；翻页重建行 → 全部收起）
  const [expanded, setExpanded] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const toggleExpand = React.useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const goToPage = (page: number) => {
    setExpanded(new Set());
    setParams((prev) => ({ ...prev, pageNum: page }));
  };

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isLoading = listQuery.isLoading;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {LBL.eyebrow}
        </div>
        <h1 className="text-xl font-semibold">{LBL.title}</h1>
      </div>

      {/* §6.2 List Panel：header → filter 条 → 表格（手写展开表对齐 DataTable 口径） */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              {LBL.entity}
            </div>
            {listQuery.data != null && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {total} {LBL.countUnit}
              </span>
            )}
            {listQuery.dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatTime(listQuery.dataUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={handleSubmit((f) => setParams(formToParams(f, 1)))}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              name="module"
              label="Module"
              placeholder="Fuzzy match"
              register={register('module')}
            />
            <FormField
              name="operateName"
              label="Operator"
              placeholder="Fuzzy match"
              register={register('operateName')}
            />
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
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit">{LBL.query}</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset(EMPTY_FILTER);
                setExpanded(new Set());
                setParams(formToParams(EMPTY_FILTER, 1));
              }}
            >
              {LBL.reset}
            </Button>
          </div>
        </form>

        <div className="p-4">
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-md border border-border/50 bg-card">
            <table className="w-full min-w-max caption-bottom text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th
                    scope="col"
                    className="h-10 w-12 border-b border-border/50 px-2 text-left align-middle font-medium text-muted-foreground"
                    aria-label={LBL.expand}
                  />
                  <th
                    scope="col"
                    className="h-10 whitespace-nowrap border-b border-border/50 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    Operation Time
                  </th>
                  <th
                    scope="col"
                    className="h-10 whitespace-nowrap border-b border-border/50 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    Operator
                  </th>
                  <th
                    scope="col"
                    className="h-10 whitespace-nowrap border-b border-border/50 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    Module
                  </th>
                  <th
                    scope="col"
                    className="h-10 w-28 whitespace-nowrap border-b border-border/50 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    Business Type
                  </th>
                  <th
                    scope="col"
                    className="h-10 whitespace-nowrap border-b border-border/50 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    Endpoint
                  </th>
                  <th
                    scope="col"
                    className="h-10 w-24 whitespace-nowrap border-b border-border/50 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="h-10 w-24 whitespace-nowrap border-b border-border/50 px-4 text-right align-middle font-medium text-muted-foreground"
                  >
                    Duration (ms)
                  </th>
                  <th
                    scope="col"
                    className="h-10 whitespace-nowrap border-b border-border/50 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    TraceId
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  Array.from({ length: pageSize }).map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      {Array.from({ length: COL_COUNT }).map((__, ci) => (
                        <td key={ci} className="px-4 py-3">
                          {/* 展开列宽 w-12：首格窄条，其余按 DataTable w-24 口径 */}
                          <div
                            className={`h-4 motion-safe:animate-pulse rounded bg-muted ${
                              ci === 0 ? 'w-6' : 'w-24'
                            }`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={COL_COUNT}
                      className="px-4 py-10 text-center"
                    >
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <Inbox
                          className="h-9 w-9 text-muted-foreground/40"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        <p className="text-sm text-muted-foreground">
                          {LBL.empty}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const open = expanded.has(row.operateLogId);
                    return (
                      <React.Fragment key={row.operateLogId}>
                        <tr className="motion-safe:transition-colors hover:bg-muted/50">
                          <td className="px-2 py-3 align-middle">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-expanded={open}
                              aria-label={open ? LBL.collapse : LBL.expand}
                              onClick={() => toggleExpand(row.operateLogId)}
                            >
                              <ChevronRight
                                className={`h-4 w-4 motion-safe:transition-transform ${
                                  open ? 'rotate-90' : ''
                                }`}
                              />
                            </Button>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-middle">
                            <Num>{formatTime(row.operateTime)}</Num>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            {row.operateName || '-'}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            {row.module || '-'}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <BizTag code={row.businessType} />
                          </td>
                          <td className="max-w-[280px] px-4 py-3 align-middle">
                            <EllipsisCell>
                              {row.operateUrl || '-'}
                            </EllipsisCell>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            {row.status === 0 ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                Normal
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Error</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right align-middle">
                            <Num>{row.costTime ?? '-'}</Num>
                          </td>
                          <td className="max-w-[220px] px-4 py-3 align-middle">
                            <EllipsisCell>
                              {row.traceId || '-'}
                            </EllipsisCell>
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={COL_COUNT} className="align-top">
                              <ExpandBody row={row} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 源分页 layout 'total, prev, pager, next'：固定 pageSize，无 size 选择器 */}
          <div className="flex items-center justify-between">
            <div className="text-xs tabular-nums text-muted-foreground">
              Total {total} items
            </div>
            <div className="flex items-center gap-2">
              <PagerButton
                aria-label="Previous page"
                disabled={params.pageNum <= 1}
                onClick={() => goToPage(params.pageNum - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </PagerButton>
              <PagerButton
                aria-label="Next page"
                disabled={params.pageNum >= totalPages}
                onClick={() => goToPage(params.pageNum + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </PagerButton>
            </div>
          </div>
          </div>
        </div>
      </section>
    </div>
  );
}
