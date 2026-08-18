'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
} from '@myorg/shared/ui';
import { FormField, createFormResolver } from '@myorg/shared/ui-forms';
import { cn } from '@myorg/shared/util-classnames';

import {
  KISSEN_GATEWAY_PROJECT_ID,
  logBusinessTypeText,
  logBusinessTypeVariant,
  logStatusText,
  logStatusVariant,
  useLogPageQuery,
  type LogListReq,
  type LogRow,
} from '@myorg/modules/kissen-gateway/data-access';

/**
 * 操作日志页（源 `views/system/log.vue`：筛选 + 分页表格 + 展开行请求参数/异常信息）。
 * 路由对齐源 `/system/log`（registry：system/log → list）。
 *
 * - shared DataTable 不支持展开子行，源 expand 列是核心交互 —— 沿用
 *   market-pages 的既有结论：用与 DataTable 同视觉语言的原生 table
 *   （含 loading 骨架/空态/分页）。
 * - 服务端状态 TanStack Query；loading/empty/error 三态均显式可感知。
 */

/* ================================================================== */
/* 展示工具（源 views/system/log.vue fmtTime，语义 1:1）                */
/* ================================================================== */

/** 毫秒时间戳 → `zh-CN` 本地时间串（24 小时制，源 toLocaleString 语义）；空值 → '-'。 */
function fmtTime(ms?: number): string {
  return ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '-';
}

/** datetime-local 字符串（YYYY-MM-DDTHH:mm）→ 毫秒时间戳（源 datetimerange value-format="x"）。 */
function toEpochMs(value: string): number | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

/** 空值统一显示 '-'（源 `|| '-'` 语义）。 */
function orDash(v: string | number | null | undefined): string {
  return v === null || v === undefined || v === '' ? '-' : String(v);
}

/* ================================================================== */
/* 列表页（源筛选：操作模块模糊匹配 + 时间范围）                        */
/* ================================================================== */

const logFilterSchema = z.object({
  module: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});
type LogFilterForm = z.infer<typeof logFilterSchema>;

const LOG_FILTER_DEFAULT: LogFilterForm = {
  module: '',
  startTime: '',
  endTime: '',
};

/**
 * RHF 筛选表单 → 后端 LogListReq（源 load() 的 query 组装：
 * timeRange → startTime/endTime 毫秒；module 空串不传）。
 */
function formToFilter(form: LogFilterForm): LogListReq {
  return {
    module: form.module || undefined,
    startTime: toEpochMs(form.startTime),
    endTime: toEpochMs(form.endTime),
  };
}

/** 源 pageSize 固定 10（分页 layout 无 sizes 选择器）。 */
const LOG_PAGE_SIZE = 10;

/** 列头（源列顺序；首列空头为展开开关）。 */
const LOG_HEADERS = [
  '',
  '操作时间',
  '操作人',
  '模块',
  '业务类型',
  '操作接口',
  '状态',
  '耗时(ms)',
  'TraceId',
] as const;

export function LogListPage() {
  const { register, handleSubmit, reset } = useForm<LogFilterForm>({
    resolver: createFormResolver(logFilterSchema),
    defaultValues: LOG_FILTER_DEFAULT,
  });

  const [filter, setFilter] = React.useState<LogListReq>(() =>
    formToFilter(LOG_FILTER_DEFAULT),
  );
  const [pageNum, setPageNum] = React.useState(1);

  const { data, isLoading, isError, error, refetch } = useLogPageQuery(
    KISSEN_GATEWAY_PROJECT_ID,
    { pageNum, pageSize: LOG_PAGE_SIZE, filter },
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  /** 展开行集合（源 el-table type="expand"，可同时展开多行）。 */
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());
  const toggleExpanded = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onSubmit = React.useCallback((form: LogFilterForm) => {
    setFilter(formToFilter(form));
    setPageNum(1);
  }, []);

  /** 源 resetQuery：module=''、timeRange 清空、回第一页。 */
  const onReset = React.useCallback(() => {
    reset(LOG_FILTER_DEFAULT);
    setFilter(formToFilter(LOG_FILTER_DEFAULT));
    setPageNum(1);
  }, [reset]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold tracking-widest text-muted-foreground">
          PORTAL
        </div>
        <h1 className="mt-1 text-xl font-semibold">操作日志</h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">筛选条件</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="module"
            label="操作模块"
            placeholder="模糊匹配"
            register={register('module')}
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

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">查询</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            重置
          </Button>
        </div>
      </form>

      {isError && (
        <Alert variant="destructive">
          <div className="flex-1">
            <AlertTitle>操作日志加载失败</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : '请稍后重试'}
            </AlertDescription>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetch()}
            >
              重新加载
            </Button>
          </div>
        </Alert>
      )}

      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="overflow-hidden rounded-md border">
          <table className="w-full caption-bottom text-sm">
            <thead className="bg-muted/50">
              <tr>
                {LOG_HEADERS.map((header, i) => (
                  <th
                    key={header || `expand-${i}`}
                    scope="col"
                    className="h-10 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                Array.from({ length: LOG_PAGE_SIZE }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    {LOG_HEADERS.map((header, ci) => (
                      <td key={ci} className="px-4 py-3">
                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={LOG_HEADERS.length}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    暂无数据
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const id = String(row.operateLogId);
                  const expanded = expandedIds.has(id);
                  return (
                    <React.Fragment key={id}>
                      <tr className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3 align-middle">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={expanded ? '收起详情' : '展开详情'}
                            aria-expanded={expanded}
                            className="h-6 w-6"
                            onClick={() => toggleExpanded(id)}
                          >
                            <ChevronRight
                              className={cn(
                                'h-4 w-4 transition-transform',
                                expanded && 'rotate-90',
                              )}
                            />
                          </Button>
                        </td>
                        <td className="px-4 py-3 align-middle tabular-nums">
                          {fmtTime(row.operateTime)}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {orDash(row.operateName)}
                        </td>
                        <td className="px-4 py-3 align-middle">{row.module}</td>
                        <td className="px-4 py-3 align-middle">
                          <Badge variant={logBusinessTypeVariant(row.businessType)}>
                            {logBusinessTypeText(row.businessType)}
                          </Badge>
                        </td>
                        <td className="max-w-[16rem] px-4 py-3 align-middle">
                          <span className="block truncate" title={orDash(row.operateUrl)}>
                            {orDash(row.operateUrl)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <Badge variant={logStatusVariant(row.status)}>
                            {logStatusText(row.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-middle tabular-nums">
                          {row.costTime ?? '-'}
                        </td>
                        <td className="max-w-[12rem] px-4 py-3 align-middle tabular-nums">
                          <span className="block truncate" title={orDash(row.traceId)}>
                            {orDash(row.traceId)}
                          </span>
                        </td>
                      </tr>
                      {expanded && <LogExpandRow row={row} />}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <LogPager
          total={total}
          pageNum={pageNum}
          pageSize={LOG_PAGE_SIZE}
          onPageChange={setPageNum}
        />
      </div>
    </div>
  );
}

/** 展开行（源 expand 模板：请求参数 + 异常信息 两段 pre，error 段红色）。 */
function LogExpandRow({ row }: { row: LogRow }) {
  return (
    <tr>
      <td colSpan={LOG_HEADERS.length} className="p-2 pl-14">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <span className="w-16 shrink-0 text-xs leading-5 text-muted-foreground">
              请求参数
            </span>
            <pre className="m-0 flex-1 whitespace-pre-wrap break-all rounded-md border bg-muted/40 px-2.5 py-2 text-xs leading-relaxed text-foreground">
              {row.operateParam || '-'}
            </pre>
          </div>
          <div className="flex gap-2">
            <span className="w-16 shrink-0 text-xs leading-5 text-muted-foreground">
              异常信息
            </span>
            <pre className="m-0 flex-1 whitespace-pre-wrap break-all rounded-md border bg-muted/40 px-2.5 py-2 text-xs leading-relaxed text-destructive">
              {row.errorMsg || '-'}
            </pre>
          </div>
        </div>
      </td>
    </tr>
  );
}

/** 分页（源 el-pagination layout="total, prev, pager, next"，pageSize 固定）。 */
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

  /**
   * 页码窗口（>7 页时折叠中间段，el-pagination pager 语义）：
   * 首尾恒显 + 当前页 ±1，窗口未贴边时补省略号（无重复页码/键）。
   */
  const pages: Array<number | '…'> = (() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const windowPages = [pageNum - 1, pageNum, pageNum + 1].filter(
      (p) => p >= 2 && p <= totalPages - 1,
    );
    const items: Array<number | '…'> = [1];
    if (windowPages[0] !== 2) items.push('…');
    items.push(...windowPages);
    if (windowPages[windowPages.length - 1] !== totalPages - 1) {
      items.push('…');
    }
    items.push(totalPages);
    return items;
  })();

  return (
    <div className="mt-3 flex items-center justify-between">
      <span className="text-sm text-muted-foreground">共 {total} 条</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="上一页"
          disabled={pageNum <= 1}
          className="h-8 w-8"
          onClick={() => onPageChange(pageNum - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === pageNum ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm font-medium',
                p === pageNum
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-accent hover:text-accent-foreground',
              )}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="下一页"
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
