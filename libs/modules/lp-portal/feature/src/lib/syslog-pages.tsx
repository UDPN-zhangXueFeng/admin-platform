'use client';

/**
 * 系统操作日志页（C4，源 `src/views/system/log/index.vue` 1:1 迁移）。
 *
 * 源语义要点：
 * - 只读分页列表（POST /lp/log/page，pageSize 固定 10，无 pageSize 选择器）；
 * - lp_id 不传，后端按登录 LP 域过滤（跨域数据不可见）；
 * - 筛选：模块（模糊）/ 操作人（模糊）/ 时间范围（源 datetimerange
 *   value-format="x" 毫秒；datetime-local 经 Date.getTime() 等价产出）；
 * - 首列展开行显 请求参数 operateParam / 异常信息 errorMsg（空 '-'）——
 *   DataTable 无展开行，改为行点击 Dialog 展示（同信息、同空值规则）；
 * - 业务类型 tag（BIZ_TEXT/BIZ_TAG 源码表 1:1）与 状态（0 正常/1 异常）；
 * - 源系统页无 0024 降级条，错误由 lp-client 拦截器统一 toast（旧数据保留）。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';
import { ChevronRight } from 'lucide-react';

import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';

import {
  LOG_BIZ_TAG,
  LOG_BIZ_TEXT,
  LP_PROJECT_ID,
  useLogPageQuery,
  type LogRow,
} from '@myorg/modules/lp-portal/data-access';

/* ================================================================== */
/* 常量与筛选表单                                                       */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'，无 size 选择器）。 */
const PAGE_SIZE = 10;

const LBL = {
  query: 'Search',
  reset: 'Reset',
  records: 'Syslog',
  empty: 'No data',
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

/** 源 fmtTime：toLocaleString('zh-CN', { hour12: false })；空值 '-'。 */
function fmtTime(ms?: number): string {
  return ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '-';
}

/** 源 BIZ_TAG（el-tag type）→ Badge 呈现（warning/success 无原生 variant，用近似色）。 */
const BIZ_BADGE: Record<string, { variant?: 'default' | 'secondary' | 'destructive'; className?: string }> = {
  primary: { variant: 'default' },
  warning: { className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  danger: { variant: 'destructive' },
  success: { className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  info: { variant: 'secondary' },
};

function BizTag({ code }: { code?: number }) {
  if (code == null || LOG_BIZ_TEXT[code] == null) {
    return <span>-</span>;
  }
  const style = BIZ_BADGE[LOG_BIZ_TAG[code]] ?? BIZ_BADGE.info;
  return (
    <Badge {...style}>{LOG_BIZ_TEXT[code]}</Badge>
  );
}

/* ================================================================== */
/* 日志详情弹窗（源首列 expand 行等价物）                                */
/* ================================================================== */

function LogDetailDialog({
  row,
  onClose,
}: {
  row: LogRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={row != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Log Details</DialogTitle>
          <DialogDescription>
            {row ? `${row.module ?? '-'} · ${fmtTime(row.operateTime)}` : ''}
          </DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-sm font-medium">Request Params</div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {row.operateParam || '-'}
              </pre>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium">Error Message</div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {row.errorMsg || '-'}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
  const [detailRow, setDetailRow] = React.useState<LogRow | null>(null);
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

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination.total ?? 0;

  const columns = React.useMemo<ColumnDef<LogRow & { id: string }>[]>(
    () => [
      {
        id: 'detail',
        header: '',
        cell: ({ row }) => (
          <button
            type="button"
            aria-label="View log details"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => setDetailRow(row.original)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ),
      },
      { accessorKey: 'operateTime', header: 'Operation Time',
      cell: ({ row }) => fmtTime(row.original.operateTime), },
      { accessorKey: 'operateName', header: 'Operator',
      cell: ({ row }) => row.original.operateName || '-', },
      { accessorKey: 'module', header: 'Module',
      cell: ({ row }) => row.original.module || '-', },
      { accessorKey: 'businessType', header: 'Business Type',
      cell: ({ row }) => <BizTag code={row.original.businessType} />, },
      { accessorKey: 'operateUrl', header: 'Endpoint',
      cell: ({ row }) => (
        <span className="break-all">{row.original.operateUrl || '-'}</span>
      ), },
      { accessorKey: 'status', header: 'Status',
      cell: ({ row }) =>
        row.original.status === 0 ? (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            Normal
          </Badge>
        ) : (
          <Badge variant="destructive">Error</Badge>
        ), },
      { accessorKey: 'costTime', header: 'Duration',
      cell: ({ row }) =>
        row.original.costTime != null ? `${row.original.costTime}ms` : '-', },
      { accessorKey: 'traceId', header: 'TraceId',
      cell: ({ row }) => (
        <span className="break-all font-mono text-xs text-muted-foreground">
          {row.original.traceId || '-'}
        </span>
      ), },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.operateLogId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit((f) => setParams(formToParams(f, 1)))}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search Criteria</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            name="module"
            label="Module"
            register={register('module')}
          />
          <FormField
            name="operateName"
            label="Operator"
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
        <div className="mt-4 flex flex-wrap gap-2">
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

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
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

      <LogDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />
    </div>
  );
}
