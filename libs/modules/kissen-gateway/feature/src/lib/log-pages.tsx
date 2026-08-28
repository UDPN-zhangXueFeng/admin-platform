'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  Badge,
  Button,
  useToast,
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

import { formatTime, orDash, toEpochMs } from './kit';
import { PageHead } from './page-head';

/**
 * 操作日志页（源 `views/system/log.vue`：筛选 + 分页表格 + 展开行请求参数/异常信息）。
 * 路由对齐源 `/system/log`（registry：system/log → list）。
 *
 * - shared DataTable 不支持展开子行，源 expand 列是核心交互 —— 沿用
 *   既有结论：用与 DataTable 同视觉语言的原生 table
 *   （含 loading 骨架/空态/分页）。
 * - 服务端状态 TanStack Query；loading/empty/error 三态均显式可感知。
 */

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
  'Time',
  'Operator',
  'Module',
  'Business Type',
  'Endpoint',
  'Status',
  'Cost (ms)',
  'TraceId',
] as const;

export function LogListPage() {
  const { register, handleSubmit, reset } = useForm<LogFilterForm>({
    resolver: createFormResolver(logFilterSchema),
    defaultValues: LOG_FILTER_DEFAULT,
  });
  const toast = useToast();

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

  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load logs', {
        description:
          error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

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
      <PageHead title="Operation Log" />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Filters</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="module"
            label="Module"
            placeholder="Fuzzy match"
            register={register('module')}
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

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            Reset
          </Button>
        </div>
      </form>


      <div className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="overflow-x-auto rounded-md border">
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
                    No data
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
                            aria-label={expanded ? 'Collapse details' : 'Expand details'}
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
                          {formatTime(row.operateTime)}
                        </td>
                        <td className="max-w-[12rem] px-4 py-3 align-middle">
                          <span className="block truncate" title={orDash(row.operateName)}>
                            {orDash(row.operateName)}
                          </span>
                        </td>
                        <td className="max-w-[10rem] px-4 py-3 align-middle">
                          <span className="block truncate" title={orDash(row.module)}>
                            {orDash(row.module)}
                          </span>
                        </td>
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
              Request Params
            </span>
            <pre className="m-0 flex-1 whitespace-pre-wrap break-all rounded-md border bg-muted/40 px-2.5 py-2 text-xs leading-relaxed text-foreground">
              {row.operateParam || '-'}
            </pre>
          </div>
          <div className="flex gap-2">
            <span className="w-16 shrink-0 text-xs leading-5 text-muted-foreground">
              Error Info
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
    <div className="mt-3 flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
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
