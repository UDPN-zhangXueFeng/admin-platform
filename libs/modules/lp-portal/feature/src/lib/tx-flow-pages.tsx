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
 *   formatMoney) so both columns group thousands identically.
 * - Entry into the chain drawer: source opens it on row click; DataTable
 *   has no row-click API, so an explicit View Chain action provides the
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
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';

import {
  LP_PROJECT_ID,
  TX_STATUS_LABEL,
  isServiceDown,
  txNoText,
  useTxFlowListQuery,
  type TxRow,
} from '@myorg/modules/lp-portal/data-access';
import { ChainDrawer } from './chain-drawer';
import { formatMoney, formatTime } from './format';
import { SyncRefreshButton } from './sync-refresh-button';
import { ServiceDownAlert } from './service-down-alert';
import {
  asTxRowVO,
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
  empty: 'No data',
  viewChain: 'View Chain',
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

/** Money cell using the shared formatter - identical caliber for both columns. */
function Money({ v }: { v: number }) {
  return (
    <span className="font-mono text-xs tabular-nums">{formatMoney(v)}</span>
  );
}

/* ================================================================== */
/* List page                                                           */
/* ================================================================== */

export function TxFlowListPage() {
  const { register, handleSubmit, reset, control } =
    useForm<TxFlowFilterForm>({ defaultValues: EMPTY_FILTER });
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
        // Business number: txUuid preferred, txNo fallback, else '-'
        accessorKey: 'txNo',
        header: 'Tx No.',
        cell: ({ row }) => (
          <span className="font-mono text-xs">{txNoText(row.original)}</span>
        ),
      },
      {
        accessorKey: 'transactionId',
        header: 'Transaction ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.transactionId}
          </span>
        ),
      },
      {
        accessorKey: 'pairCode',
        header: 'Token Pair',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {asTxRowVO(row.original).pairCode || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'direction',
        header: 'Direction',
        cell: ({ row }) => {
          const vo = asTxRowVO(row.original);
          return (
            <span>
              {vo.sourceCurrency}
              {'→'}
              {vo.targetCurrency}
            </span>
          );
        },
      },
      {
        accessorKey: 'principal',
        header: 'Principal',
        cell: ({ row }) => <Money v={row.original.principal} />,
      },
      {
        accessorKey: 'receiverAmount',
        header: 'Receiver Amount',
        cell: ({ row }) => {
          const v = asTxRowVO(row.original).receiverAmount;
          return typeof v === 'number' && Number.isFinite(v) ? (
            <Money v={v} />
          ) : (
            <span>-</span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        // failReason surfaces as a tooltip piggybacked on the status badge
        cell: ({ row }) => {
          const reason = asTxRowVO(row.original).failReason;
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
        accessorKey: 'syncTime',
        header: 'Data Time',
        cell: ({ row }) => {
          const t = asTxRowVO(row.original).syncTime;
          return (
            <span className="font-mono text-xs tabular-nums">
              {t == null || t === 0 ? '-' : formatTime(t)}
            </span>
          );
        },
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
            {LBL.viewChain}
          </Button>
        ),
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.transactionId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {LBL.eyebrow}
          </div>
          <h1 className="text-xl font-semibold">{LBL.title}</h1>
        </div>
        {/* Domain sync: tx_flow; keeps current page after refresh */}
        <SyncRefreshButton domain="tx_flow" onRefreshed={reloadKeepingPage} />
      </div>

      {serviceDown && <ServiceDownAlert traceId={serviceDown.traceId} />}

      <form
        onSubmit={handleSubmit((f) => setParams(formToParams(f, 1)))}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search Criteria</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <TooltipProvider>
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
              pageSize: PAGE_SIZE,
              total,
              onPageChange: (page) =>
                setParams((prev) => ({ ...prev, pageNum: page })),
              pageSizeOptions: [PAGE_SIZE],
            }}
          />
        </div>
      </TooltipProvider>

      {/* Drawer mounts only with a row target and unmounts once closed */}
      {drawerRow && (
        <ChainDrawer row={drawerRow} onClosed={() => setDrawerRow(null)} />
      )}
    </div>
  );
}
