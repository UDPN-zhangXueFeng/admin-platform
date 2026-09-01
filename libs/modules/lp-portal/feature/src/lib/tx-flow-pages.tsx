'use client';

/**
 * Transaction flow list page (doc 01 section D9, semantic port of legacy
 * `src/views/tx-flow/index.vue`).
 *
 * Behavior contract:
 * - Domain refresh: SyncRefreshButton(domain='tx_flow') refetches the list
 *   keeping the current page number (source reload keeps pageNum).
 * - Filters: status dropdown with the full 13-value TX table, a Token Pair
 *   ID text input (native Enter inside the form submits = load(1)), and a
 *   completed-time range whose values are converted to millisecond numbers
 *   (source datetimerange value-format='x' then Number()).
 * - Status badges follow the LIST caliber: 40 success, 70/90 danger,
 *   50 warning stroke, 60/80 info; every other code - including 35 credited -
 *   stays in-flight primary. Unknown codes fall back to a neutral badge
 *   showing the raw number. The drawer intentionally renders its own
 *   caliber (35 success) - see chain-drawer.tsx / tx-chain.ts.
 * - completedTime is compared strictly against 0 (unfinished sentinel) and
 *   rendered '-', never fed into formatTime's invalid branch.
 * - Principal and Receiver Amount share one money caliber (global
 *   formatMoney, v2.3 null fallback) so both columns group thousands
 *   identically; an absent receiverAmount renders '-'.
 * - Tokens column (v2.3) replaces the old direction column with the
 *   compact two-line pair: symOf(src)/symOf(tgt) over the muted
 *   bankOf(src) -> bankOf(tgt) row, resolved via useTokenMeta.
 * - Entry into the chain drawer: source opens it on row click; DataTable
 *   has no row-click API, so an explicit Detail action provides the
 *   affordance while mount/unmount semantics match the source.
 * - Service-down (0024) shows the page banner and keeps previous data;
 *   non-0024 failures clear the banner (query cache retains old rows).
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  DataTable,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import {
  FormField,
  FormSelect,
  type SelectOption,
} from '@myorg/shared/ui-forms';

import {
  LP_PROJECT_ID,
  TX_STATUS_LABEL,
  isServiceDown,
  txNoText,
  useTokenMeta,
  useTxFlowListQuery,
  type TxRow,
} from '@myorg/modules/lp-portal/data-access';
import { ChainDrawer } from './chain-drawer';
import { formatMoney, formatTime } from './format';
import { SyncRefreshButton } from './sync-refresh-button';
import { ServiceDownAlert } from './service-down-alert';
import {
  completedTimeText,
  txListVariant,
  txStatusLabel,
  txWarnClass,
} from './tx-chain';

/* ================================================================== */
/* Constants and filter form                                           */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;
/** Source el-pagination fixed page-size 10 (layout total, prev, pager, next). */
const PAGE_SIZE = 10;

const LBL = {
  eyebrow: 'BUSINESS',
  title: 'Transaction Flow',
  query: 'Search',
  reset: 'Reset',
  records: 'Transaction Flow',
  countUnit: 'transactions',
  empty: 'No transactions match the current filters',
  detail: 'Detail',
} as const;

/** Dropdown all sentinel (FormSelect forbids empty values). */
const ALL = 'all';

/** Status options generated in key order of the shared 13-value table. */
const STATUS_OPTIONS: SelectOption[] = Object.keys(TX_STATUS_LABEL).map(
  (k) => ({
    value: k,
    label: TX_STATUS_LABEL[Number(k)],
  }),
);

interface TxFlowFilterForm {
  pairCode: string;
  status: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FILTER: TxFlowFilterForm = {
  pairCode: '',
  status: ALL,
  startTime: '',
  endTime: '',
};

/** Submitted query params (times already ms numbers; undefined stays out of body). */
interface TxFlowQueryParams {
  pageNum: number;
  pairCode?: string;
  status?: number;
  startTime?: number;
  endTime?: number;
}

function formToParams(f: TxFlowFilterForm, pageNum = 1): TxFlowQueryParams {
  const pairCodeRaw = f.pairCode.trim();
  return {
    pageNum,
    // Token-pair code input (e.g. PR-xxxx); empty stays out of the request body.
    pairCode: pairCodeRaw || undefined,
    status: f.status !== ALL ? Number(f.status) : undefined,
    startTime: f.startTime ? new Date(f.startTime).getTime() : undefined,
    endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
  };
}

/** List-caliber status badge; unknown codes fall back without throwing. */
function TxStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={txListVariant(status)} className={txWarnClass(status)}>
      {txStatusLabel(status)}
    </Badge>
  );
}


/**
 * Tx No. cell: fixed v2.3 caliber (`txNo || '-'`, no txUuid/transactionId
 * fallback), truncated with an overflow tooltip (source
 * show-overflow-tooltip).
 */
function TxNoCell({ value }: { value: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block max-w-44 truncate font-mono text-xs">
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-all">{value}</TooltipContent>
    </Tooltip>
  );
}

/* ================================================================== */
/* List page                                                           */
/* ================================================================== */

export function TxFlowListPage() {
  const { register, handleSubmit, reset, control } = useForm<TxFlowFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [params, setParams] = React.useState<TxFlowQueryParams>(() =>
    formToParams(EMPTY_FILTER),
  );

  // Row target of the chain drawer; set on entry action, cleared to unmount.
  const [drawerRow, setDrawerRow] = React.useState<TxRow | null>(null);

  const listQuery = useTxFlowListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize: PAGE_SIZE,
    filter: {
      pairCode: params.pairCode,
      status: params.status,
      startTime: params.startTime,
      endTime: params.endTime,
    },
  });

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination.total ?? 0;

  // v2.3 unified token metadata (symbol + bank names) for the Tokens column.
  const { symOf, bankOf } = useTokenMeta(PROJECT_ID);

  // 0024 -> page-level banner; non-0024 failures clear it (previous data kept).
  const err = listQuery.error;
  const serviceDown = err != null && isServiceDown(err) ? err : null;

  /** Refetch keeps the current page number (source sync-reload semantics). */
  function reloadKeepingPage() {
    void listQuery.refetch();
  }

  const columns = React.useMemo<ColumnDef<TxRow & { id: string }>[]>(
    () => [
      {
        // v2.3 fixed caliber: txNo only - no txUuid/transactionId fallback;
        // overflow tooltip mirrors source show-overflow-tooltip
        accessorKey: 'txNo',
        header: 'Tx No.',
        cell: ({ row }) => <TxNoCell value={txNoText(row.original)} />,
      },
      {
        // v2.3 compact pair replaces the direction column: bold symbol row
        // over the muted bank row (symOf/bankOf fall back to the raw code)
        id: 'tokens',
        header: 'Tokens',
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-mono text-xs font-semibold tabular-nums">
              {symOf(row.original.sourceTokenCode)}/
              {symOf(row.original.targetTokenCode)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {bankOf(row.original.sourceTokenCode)} →{' '}
              {bankOf(row.original.targetTokenCode)}
            </div>
          </div>
        ),
      },
      {
        // v2.4 From column: sender wallet (tooltip full text, mono
        // truncated) over the principal amount (source .wallet/.amount)
        id: 'from',
        header: 'From',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="max-w-[200px] truncate font-mono text-xs">
                  {row.original.senderAccount || '-'}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm break-all font-mono text-xs">
                {row.original.senderAccount || '-'}
              </TooltipContent>
            </Tooltip>
            <div className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatMoney(row.original.principal)}
            </div>
          </div>
        ),
      },
      {
        // v2.4 To column: receiver wallet + receiver amount (same two-line
        // shape as From; optional fields fall back to '-' via formatMoney)
        id: 'to',
        header: 'To',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="max-w-[200px] truncate font-mono text-xs">
                  {row.original.receiverAccount || '-'}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm break-all font-mono text-xs">
                {row.original.receiverAccount || '-'}
              </TooltipContent>
            </Tooltip>
            <div className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatMoney(row.original.receiverAmount)}
            </div>
          </div>
        ),
      },
      {
        // v2.4 FX Rate: userRate null/''/NaN/0 -> '-', else en-US grouping
        // with up to 8 fraction digits (source rateText, admin FX caliber)
        accessorKey: 'userRate',
        header: () => <div className="text-right">FX Rate</div>,
        cell: ({ row }) => {
          const v = row.original.userRate;
          const n = v == null || v === '' ? NaN : Number(v);
          return (
            <span className="block text-right font-mono text-xs tabular-nums">
              {Number.isNaN(n) || n === 0
                ? '-'
                : n.toLocaleString('en-US', { maximumFractionDigits: 8 })}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        // failReason surfaces as a tooltip piggybacked on the status badge
        cell: ({ row }) => {
          const reason = row.original.failReason;
          const badge = <TxStatusBadge status={row.original.status} />;
          return reason ? (
            <Tooltip>
              <TooltipTrigger asChild>{badge}</TooltipTrigger>
              <TooltipContent className="max-w-sm break-all">
                {reason}
              </TooltipContent>
            </Tooltip>
          ) : (
            badge
          );
        },
      },
      {
        accessorKey: 'completedTime',
        header: 'Completed At',
        // Strict === 0 sentinel -> '-' (source caliber; not truthiness)
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {completedTimeText(row.original.completedTime)}
          </span>
        ),
      },
      {
        // v2.4 Created At: createTime falsy -> '-' (new column; the Data
        // Time / syncTime column was retired upstream)
        accessorKey: 'createTime',
        header: 'Created At',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.createTime
              ? formatTime(row.original.createTime)
              : '-'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setDrawerRow(row.original)}
          >
            {LBL.detail}
          </Button>
        ),
      },
    ],
    [symOf, bankOf],
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

      {/* §6.2 List Panel：header（实体名 + 结果数 + 数据时间 + 操作）→ filter 条 → 表格 */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              {LBL.records}
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
          <div className="shrink-0">
            {/* Domain sync: tx_flow; keeps current page after refresh */}
            <SyncRefreshButton domain="tx_flow" onRefreshed={reloadKeepingPage} />
          </div>
        </div>

        <form
          onSubmit={handleSubmit((f) => setParams(formToParams(f, 1)))}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              name="pairCode"
              label="Token Pair Code"
              type="text"
              placeholder="e.g. PR-0001, Enter to search"
              register={register('pairCode')}
            />
            <FormSelect
              name="status"
              control={control}
              label="Status"
              options={[{ value: ALL, label: 'All' }, ...STATUS_OPTIONS]}
            />
            <FormField
              name="startTime"
              label="Completed From"
              type="datetime-local"
              register={register('startTime')}
            />
            <FormField
              name="endTime"
              label="Completed To"
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
                setParams(formToParams(EMPTY_FILTER, 1));
              }}
            >
              {LBL.reset}
            </Button>
          </div>
        </form>

        <div className="p-4">
          <TooltipProvider>
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={listQuery.isLoading}
              emptyMessage={LBL.empty}
              pagination={{
                page: params.pageNum,
                pageSize: PAGE_SIZE,
                total,
                onPageChange: (page) =>
                  setParams((prev) => ({ ...prev, pageNum: page })),
                pageSizeOptions: [PAGE_SIZE],
              }}
            />
          </TooltipProvider>
        </div>
      </section>

      {/* Drawer mounts only with a row target and unmounts once closed */}
      {drawerRow && (
        <ChainDrawer row={drawerRow} onClosed={() => setDrawerRow(null)} />
      )}
    </div>
  );
}
