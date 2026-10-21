'use client';

/**
 * Operation log domain pages (list + detail; mirrors prototype BP
 * OperationLogsPage / OperationLogDetailPage, unified with the admin
 * OperateLog pages).
 *
 * List (prototype OperationLogsPage semantics):
 * - DataTable with nine columns (Time (UTC+8) / Operator / Module / Business
 *   Type / Request URL / Status / Duration / Trace ID / Actions); column
 *   preferences persist in localStorage (Trace ID hidden by default — 1440px
 *   cannot fit every column); inline row expansion was removed — Details
 *   opens the dedicated detail page.
 * - Filters: Search submits the current conditions, Reset clears and returns
 *   to page 1; Operator/Status have no server-side parameters — local
 *   filtering over the current page as a transition (see the in-component
 *   comment); Date Range/Module go through /log/page server parameters.
 * - Sorting: /log/page has no server-side sort parameter — sort within the
 *   current page (same convention as the tx list).
 *
 * Detail (/log/detail?logId=):
 * - STATIC-FILLER(GAP-GW-02): no /log/{id} detail endpoint — the list stashes
 *   the clicked row in sessionStorage (gw_log_stash:{logId}) and the detail
 *   page renders from it; deep links without a stash fall back to not-found.
 * - Layout: single-level page header → full-width Request card (request
 *   params redacted); Error Info only when errorMsg exists.
 */
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Search } from 'lucide-react';

import { Badge, Button, DataTable, Input, useToast } from '@myorg/shared/ui';
import { FormSelect, createFormResolver } from '@myorg/shared/ui-forms';
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
import { formatUtc8 } from './proto-format';
import { CopyableId, ProtoStatusBadge } from './proto-ui';
import { PROTO_LOG_RESULT, protoStatusText } from './proto-enums';
import { PageHead } from './page-head';
import {
  ColumnPicker,
  SortHeader,
  compareProtoValues,
  filterVisibleColumns,
  useColumnPreferences,
  useTableSort,
  type ProtoColumnDef,
} from './proto-table';

/** List route (registry wiring); detail is the child route /log/detail?logId=. */
const LOG_LIST_PATH = '/system/log';
const LOG_DETAIL_PATH = '/log/detail';

/**
 * Shared list pagination default; the selector uses the common 10/20/50 options.
 */
const LOG_PAGE_SIZE = 10;

/* ─────────────── Column contract / sort / preferences (prototype OperationLogsPage COLUMNS) ─────────────── */

/** Column contract (verbatim from the prototype COLUMNS; labels per the task
 * wording: Time (UTC+8)/Business Type/Status); Trace ID hidden by default
 * (prototype defaultVisible:false). */
const LOG_COLUMNS: ProtoColumnDef[] = [
  { id: 'createdAt', label: 'Time', required: true },
  { id: 'operator', label: 'Operator' },
  { id: 'module', label: 'Module' },
  { id: 'businessType', label: 'Business Type' },
  { id: 'operateUrl', label: 'Request URL' },
  { id: 'status', label: 'Status', required: true },
  { id: 'duration', label: 'Duration' },
  { id: 'traceId', label: 'Trace ID', defaultVisible: false },
  { id: 'actions', label: 'Actions', required: true },
];

/** Column preference localStorage key (same semantics as tx/token lists). */
const LOG_COLUMN_PREF_KEY = 'gw.log-list.columns';

/** Sort key → row accessor (prototype sortBy whitelist; Request URL/Status/Actions are not sortable). */
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

/* ─────────────── Filter form (prototype fields + explicit Search/Reset submit) ─────────────── */

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

/** Submitted filter: req carries the server-side parameters (module +
 * millisecond time range); operator/status have no server-side parameters
 * (local filtering transition) and stay out of the request body. */
interface LogQueryState {
  req: LogListReq;
  operator: string;
  status: string;
}

/** RHF filter form → submitted state. Prototype DateRangeField day granularity:
 * from = 00:00 of the day / to = 23:59 of the day. */
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

/* ─────────────── Row stash + request-param redaction (GAP-GW-02) ─────────────── */

const LOG_STASH_PREFIX = 'gw_log_stash:';

/** Stash the clicked row (sessionStorage; write failures fail silently — the
 * detail page then lands on its not-found state). */
function stashLogRow(logId: string, row: LogRow): void {
  try {
    sessionStorage.setItem(`${LOG_STASH_PREFIX}${logId}`, JSON.stringify(row));
  } catch {
    /* private mode / quota exceeded — give up on the stash */
  }
}

/** Read the stashed row; missing/corrupt/ID mismatch → null. */
function peekLogRow(logId: string): LogRow | null {
  try {
    const raw = sessionStorage.getItem(`${LOG_STASH_PREFIX}${logId}`);
    const parsed = raw ? (JSON.parse(raw) as LogRow) : null;
    return parsed?.operateLogId === Number(logId) ? parsed : null;
  } catch {
    return null;
  }
}

/** Redaction key rule (GAP-GW-02 disposition column: password/token-like keys
 * → ••••••••, implemented on the frontend). */
const REDACT_KEY_PATTERN = /pass(word)?|token|secret|credential/i;
const REDACTED_TEXT = '••••••••';

/** Redacted request-param display: parseable JSON → values under sensitive keys
 * are masked before pretty-printing; unparseable input passes through verbatim
 * (backend format unknown, no destructive rewrite); empty → '-'. */
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
/* List page (registry: /system/log → list)                            */
/* ================================================================== */

export function LogListPage() {
  const router = useRouter();
  const toast = useToast();

  const { register, reset, control, getValues } = useForm<LogFilterForm>({
    resolver: createFormResolver(logFilterSchema),
    defaultValues: LOG_FILTER_DEFAULT,
  });

  const [query, setQuery] = React.useState<LogQueryState>(() =>
    formToQuery(LOG_FILTER_DEFAULT),
  );
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(LOG_PAGE_SIZE);
  const { sort, toggle } = useTableSort('createdAt', 'desc');
  const columnPreferences = useColumnPreferences(
    LOG_COLUMN_PREF_KEY,
    LOG_COLUMNS,
  );

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } =
    useLogPageQuery(KISSEN_GATEWAY_PROJECT_ID, {
      pageNum,
      pageSize,
      filter: query.req,
    });

  /* The source swallows errors via the interceptor; this portal surfaces them
   * with an explicit toast + Retry. */
  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load operation logs', {
        description:
          error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  const onSearch = React.useCallback(() => {
    setQuery(formToQuery(getValues()));
    setPageNum(1);
  }, [getValues]);

  const onReset = React.useCallback(() => {
    reset(LOG_FILTER_DEFAULT);
    setQuery(formToQuery(LOG_FILTER_DEFAULT));
    setPageNum(1);
  }, [reset]);

  const allRows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  /* Local filtering transition (/log/page filter has no operateName/status
   * parameters; Operator fuzzy / Status exact only affect the current page,
   * and the pagination total keeps the unfiltered count; switch back to
   * server-side search once the backend parameters exist). */
  const rows = React.useMemo(() => {
    const q = query.operator.toLowerCase();
    return allRows.filter(
      (r) =>
        (!q || (r.operateName ?? '').toLowerCase().includes(q)) &&
        (!query.status || String(r.status ?? '') === query.status),
    );
  }, [allRows, query]);

  /** Module dropdown options derive from the current page data (the prototype
   * options come from the API; token page same convention). */
  const moduleSelectOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const modules: string[] = [];
    for (const r of allRows) {
      if (!r.module || seen.has(r.module)) continue;
      seen.add(r.module);
      modules.push(r.module);
    }
    modules.sort((a, b) => a.localeCompare(b));
    return [
      { value: OPT_ALL, label: 'All' },
      ...modules.map((m) => ({ value: m, label: m })),
    ];
  }, [allRows]);

  /** Status filter options: ordered by rank (0 Success → 1 Failed, not alphabetical). */
  const statusSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All' },
      ...Object.entries(PROTO_LOG_RESULT)
        .sort(([, a], [, b]) => a.rank - b.rank)
        .map(([code, meta]) => ({ value: code, label: meta.text })),
    ],
    [],
  );

  /* Sorting: /log/page has no server-side sort parameter — sort within the
   * current page (sortable-key whitelist matches the prototype: createdAt /
   * operator / module / businessType / duration / traceId; default createdAt
   * desc; same convention as the tx list). */
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

  /** Detail navigation (registry: /log/detail?logId=): stash the row first —
   * GAP-GW-02 has no /log/{id} endpoint, so the detail page renders straight
   * from the row data. */
  const onView = React.useCallback(
    (row: LogRow) => {
      stashLogRow(String(row.operateLogId), row);
      router.push(`${LOG_DETAIL_PATH}?logId=${row.operateLogId}`);
    },
    [router],
  );

  /**
   * Column order mirrors the BP prototype COLUMNS (labels per the task
   * wording: Time (UTC+8) / Business Type / Status / Duration / Trace ID):
   * Trace ID hidden by default, Actions is the Details entry.
   */
  const columns = React.useMemo<ColumnDef<LogRow & { id: string }>[]>(() => {
    return [
      {
        id: 'createdAt',
        header: () => (
          <SortHeader
            label="Time"
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
        header: () => (
          <SortHeader
            label="Operator"
            direction={sort.key === 'operator' ? sort.direction : null}
            onToggle={() => toggle('operator')}
          />
        ),
        cell: ({ row }) => orDash(row.original.operateName),
      },
      {
        id: 'module',
        header: () => (
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
        header: () => (
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
            className="block max-w-[260px] truncate font-mono text-xs"
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
        header: () => (
          <SortHeader
            label="Duration"
            direction={sort.key === 'duration' ? sort.direction : null}
            onToggle={() => toggle('duration', 'desc')}
            numeric
          />
        ),
        cell: ({ row }) => (
          <span className="block whitespace-nowrap text-right tabular-nums">
            {row.original.costTime != null
              ? `${row.original.costTime} ms`
              : orDash(row.original.costTime)}
          </span>
        ),
      },
      {
        id: 'traceId',
        header: () => (
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

  /* Column preferences: required columns always render, the rest follow the
   * user's selection (Trace ID hidden by default). */
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
      {/* Page head (title only, matching the admin ListPageHeader). */}
      <PageHead title="Operation Logs" />

      <section className="rounded-lg border border-border/60 bg-card">
        {/* Table panel header: entity name + result count + refresh time +
            page-level actions on the right. */}
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6">
              Operation Logs
            </div>
            {!isLoading && data?.pagination ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {total} results
              </span>
            ) : null}
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

        {/* Filter bar: Search submits the current conditions, Reset clears;
            field order follows the prototype Date Range → Operator → Module →
            Status. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium leading-snug text-foreground">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  aria-label="Date Range from"
                  {...register('startTime')}
                />
                <Input
                  type="date"
                  aria-label="Date Range to"
                  {...register('endTime')}
                />
              </div>
            </div>
            {/* Operator has no server-side parameter — local fuzzy filter over
             * the current page (see the rows transition comment). */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium leading-snug text-foreground">
                Operator
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search operator"
                  {...register('operator')}
                />
              </div>
            </div>
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
            <div className="flex items-end gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                Reset
              </Button>
            </div>
          </div>
        </form>

        <div className="p-4">
          <DataTable
            columns={visibleColumns}
            data={tableData}
            isLoading={isLoading}
            emptyMessage="No operation logs found."
            pagination={
              data?.pagination
                ? {
                    page: pageNum,
                    pageSize,
                    total,
                    onPageChange: setPageNum,
                    onPageSizeChange: (nextPageSize) => {
                      setPageSize(nextPageSize);
                      setPageNum(1);
                    },
                  }
                : undefined
            }
          />
        </div>
      </section>
    </div>
  );
}

/* ================================================================== */
/* Detail page (registry: /log/detail → detail; prototype OperationLogDetailPage) */
/* ================================================================== */

/** Detail read-only field (label above / bold value below; admin
 * OperateLogDetailField parity). */
function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium capitalize text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 min-w-0 break-all text-sm font-medium leading-6">
        {children}
      </div>
    </div>
  );
}

export function LogDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logId = searchParams.get('logId')?.trim() ?? '';

  /* STATIC-FILLER(GAP-GW-02): no /log/{id} detail endpoint — the detail renders
   * from the stashed list row (sessionStorage gw_log_stash:{logId}); deep
   * links / new tabs without a stash → not-found state. */
  const row = React.useMemo(() => (logId ? peekLogRow(logId) : null), [logId]);

  const backToList = React.useCallback(
    () => router.push(LOG_LIST_PATH),
    [router],
  );

  if (row == null) {
    return (
      <div className="space-y-4">
        {/* Form-style page head: back + title (admin FormPageHeader parity). */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Button
              variant="outline"
              size="iconSm"
              aria-label="Back to Operation Logs"
              onClick={backToList}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-7">
                Operation Details
              </h1>
            </div>
          </div>
        </div>
        <section className="rounded-lg border border-border/60 bg-card">
          <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
            <p className="text-sm font-medium">Operation log not found</p>
            <p className="text-sm text-muted-foreground">
              The record may have been removed. Go back to the list.
            </p>
            <div className="mt-3">
              <Button variant="outline" onClick={backToList}>
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
      {/* Identity head (admin detail header): ← back + title + result badge +
          meta row (Trace ID | Timestamp). */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="iconSm"
            aria-label="Back to Operation Logs"
            onClick={backToList}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold leading-7">
                Operation Details
              </h1>
              <ProtoStatusBadge
                label={protoStatusText(PROTO_LOG_RESULT, row.status)}
                tone={row.status === 0 ? 'success' : 'danger'}
              />
            </div>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                Trace ID:{' '}
                {row.traceId ? <CopyableId value={row.traceId} /> : orDash(null)}
              </span>
              <span aria-hidden="true">|</span>
              <span>
                Timestamp:{' '}
                <b className="font-semibold tabular-nums text-foreground">
                  {formatUtc8(row.operateTime)}
                </b>
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <section className="rounded-lg border border-border/60 bg-card p-4 text-card-foreground shadow-float">
          <h2 className="mb-4 text-sm font-semibold leading-5">Request</h2>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <DetailField label="Module">
                {row.module?.toUpperCase() === 'LOGIN'
                  ? 'Login Management'
                  : orDash(row.module)}
              </DetailField>
              <DetailField label="Business Type">
                {/* Type 4 (Sign-in) keeps the rounded teal pill styling. */}
                <Badge
                  variant={logBusinessTypeVariant(row.businessType)}
                  className={
                    row.businessType === 4
                      ? 'rounded-full border-transparent bg-teal-700 text-white dark:bg-teal-700 dark:text-white'
                      : undefined
                  }
                >
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
                {row.costTime != null ? `${row.costTime} ms` : orDash(row.costTime)}
              </DetailField>
              <DetailField label="Operator">{orDash(row.operateName)}</DetailField>
            </div>
            <div className="border-t border-border/60 pt-4">
              <div className="mb-2 text-xs font-medium capitalize text-muted-foreground">
                Request Parameters
              </div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground">
                {redactParams(row.operateParam)}
              </pre>
            </div>
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
