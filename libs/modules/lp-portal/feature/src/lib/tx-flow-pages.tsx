'use client';

/**
 * FX Transactions 列表 + 交易详情（方案 12 §6 行 125-126，原型
 * `FxTransactionsPage.jsx` / `FxTransactionDetailPage.jsx` 行为规格重实现）。
 *
 * 行为契约：
 * - 列表：`Transaction No.` / `Tokens`（SYM → SYM 加粗 + 银行行）/ `From` / `To`
 *   （金额主行 + 钱包 CopyableId 次行）/ `FX Rate` / `Status`（13 态
 *   LP_TX_STATUS_MAP + 语义色圆点徽章，failReason 仍以 tooltip 挂状态徽章）/
 *   `Created on (UTC+8)` / `Completed on (UTC+8)`（0 哨兵 → '-'）/
 *   `Actions → Details`。筛选：Token Pair Code / Status / Completed 时间窗。
 * - 域刷新 SyncRefreshButton(domain='tx_flow') 保持页码 refetch；
 *   0024 服务降级 ServiceDownAlert 保留旧数据（A7 口径）。
 * - 详情：`?txNo=` 查询参分支（registry 仅映射 list；同参可独立挂
 *   `FxTransactionDetailPage`）。无 GET /lp/tx-flow/{id} 详情端点
 *   （GAP-LP-11）：以列表行暂存（sessionStorage，kissen-admin row-stash
 *   同款）为基准 + chain 端点拼装 Clearance Pipeline；直接深链无暂存 →
 *   not-found 态。流水线中段环节缺链路事件时间时按原型 deltaSec 展示
 *   （UI 展示口径非业务数据）。
 * - 金额口径（ed1a340/6a55188）：From = userDeduction 按源 token 精度、
 *   To = receiverAmount 按目标 token 精度，formatTokenAmount 千分位 +
 *   HALF_UP + 去尾零 + 币种缩写后缀。
 */
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, ArrowLeftRight, Check, Copy } from 'lucide-react';

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
import { useRouter } from '@myorg/shared/util-i18n';

import {
  LP_PROJECT_ID,
  isServiceDown,
  txNoText,
  useLpSessionQuery,
  useTokenMeta,
  useTxFlowChainQuery,
  useTxFlowListQuery,
  type TxRow,
} from '@myorg/modules/lp-portal/data-access';

import { formatDuration, formatRate, formatTokenAmount, formatUtc8 } from './proto-format';
import { CopyableId, Dash, ProtoStatusBadge, type ProtoTone } from './proto-ui';
import { LP_TX_STATUS_MAP } from './proto-enums';
import {
  ProtoSortHeader,
  useProtoSort,
  type ProtoSortGetter,
} from './proto-sort';
import { SyncRefreshButton } from './sync-refresh-button';
import { ServiceDownAlert } from './service-down-alert';
import { flattenChain } from './tx-chain';

/* ================================================================== */
/* 常量、筛选表单与暂存                                                 */
/* ================================================================== */

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'）。 */
const PAGE_SIZE = 10;
/** 列表路由（详情以 ?txNo= 查询参挂同一路由）。 */
const LIST_ROUTE = '/tx-flow';

const LBL = {
  eyebrow: 'BUSINESS',
  title: 'FX Transactions',
  panel: 'FX Transactions',
  query: 'Search',
  reset: 'Reset',
  countUnit: 'transactions',
  empty: 'No transactions match the current filters',
  detail: 'Details',
} as const;

/** 下拉「全部」哨兵（FormSelect 禁空 value；非 ALL 即转实参查询）。 */
const ALL = 'all';

/** 状态筛选项：LP_TX_STATUS_MAP 13 态逐字（码序 = 业务 rank 序）。 */
const STATUS_OPTIONS: SelectOption[] = Object.keys(LP_TX_STATUS_MAP).map(
  (k) => ({
    value: k,
    label: LP_TX_STATUS_MAP[Number(k)].label,
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

/** 已提交查询参数（时间已转毫秒；undefined 不入请求体）。 */
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
    pairCode: pairCodeRaw || undefined,
    status: f.status !== ALL ? Number(f.status) : undefined,
    startTime: f.startTime ? new Date(f.startTime).getTime() : undefined,
    endTime: f.endTime ? new Date(f.endTime).getTime() : undefined,
  };
}

/* ── 行暂存（列表 → 详情跨页传行；GAP-LP-11 无详情端点） ───────────── */

const TX_STASH_PREFIX = 'lp_tx_stash:';

/** 详情键：txNo 优先；无 txNo 行回退 transactionId 字符串。 */
function txDetailKey(row: TxRow): string {
  return row.txNo || String(row.transactionId);
}

function stashTxRow(txKey: string, row: TxRow): void {
  try {
    window.sessionStorage.setItem(
      `${TX_STASH_PREFIX}${txKey}`,
      JSON.stringify(row),
    );
  } catch {
    // 私密模式 / 配额满等场景静默（详情页落 not-found 态）
  }
}

function peekTxRow(txKey: string): TxRow | null {
  try {
    const raw = window.sessionStorage.getItem(`${TX_STASH_PREFIX}${txKey}`);
    return raw ? (JSON.parse(raw) as TxRow) : null;
  } catch {
    return null;
  }
}

/* ── 复制全文（异步 Clipboard API 优先，非 HTTPS 降级 execCommand） ── */

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到 execCommand 兜底
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ── 状态语义色（LP_TX_STATUS_MAP 码 → ProtoStatusBadge tone） ─────── */

/** 列表/详情同口径：35/40 成功，70/90 危险，50 警示，60/80 中性，其余进行中。 */
function txStatusTone(status: number): ProtoTone {
  if (status === 35 || status === 40) return 'success';
  if (status === 70 || status === 90) return 'danger';
  if (status === 50) return 'warning';
  if (status === 60 || status === 80) return 'muted';
  if (LP_TX_STATUS_MAP[status]) return 'primary';
  return 'muted';
}

/** 13 态圆点徽章；未知码显原值（muted）。 */
function TxStatusBadge({ status }: { status: number }) {
  const entry = LP_TX_STATUS_MAP[status];
  return (
    <ProtoStatusBadge
      label={entry?.label ?? String(status)}
      tone={txStatusTone(status)}
    />
  );
}

/* ── Clearance Pipeline（原型 7 环节；GAP-LP-11 链路拼装） ────────── */

/** 流水线 7 环节码（原型 steps 对应态）。 */
const RAIL_CODES = [1, 5, 10, 20, 25, 30, 40] as const;
const RAIL_CODE_LIST: readonly number[] = RAIL_CODES;
const RAIL_STEPS = [
  'Created',
  'Quoted',
  'Confirmed',
  'Source Transferring',
  'Source Verified',
  'Processing',
  'Completed',
] as const;

/** 环节描述（原型 stepInfo 逐字）。 */
const RAIL_STEP_INFO: readonly string[] = [
  'Transaction created and tracked by the system',
  'FX rate locked from the market rate + markup',
  'Payment confirmed by the client bank',
  'Funds moved from the sender bank to the escrow account',
  'Escrow balance verified on-chain',
  'Funds disbursed to the receiver bank',
  'Receiver confirmed the incoming funds',
];

/**
 * 状态 → 流水线索引：rail 内码直映；非 rail 态按业务位置钳制
 * （35 Credited 视同已过 Processing；50/60 冲正系完成/入账后回退；
 * 70/80/90 异常类通常在解付段暴露）。链路真实事件（chainMax）优先于此表。
 */
const STATUS_RAIL_INDEX: Record<number, number> = {
  1: 0,
  5: 1,
  10: 2,
  20: 3,
  25: 4,
  30: 5,
  35: 6,
  40: 6,
  50: 6,
  60: 6,
  70: 5,
  80: 5,
  90: 5,
};

/**
 * GAP-LP-11：中段环节无链路事件时间时的展示口径（原型 deltaSec），
 * UI 展示口径非业务数据；链路端点补全后自然被真实 eventTime 取代。
 */
const RAIL_FALLBACK_DELTA_SEC = [0, 5, 8, 20, 32, 45, 52] as const;

type RailState = 'done' | 'danger' | 'muted' | 'warning' | 'future';

/** 原型 railState 逐字：index<stage done；> future；==stage 按当前态标签分流。 */
function railState(
  statusLabel: string | undefined,
  index: number,
  stageIndex: number,
): RailState {
  if (index < stageIndex) return 'done';
  if (index > stageIndex) return 'future';
  if (statusLabel === 'Completed') return 'done';
  if (statusLabel === 'Abnormal' || statusLabel === 'Failed') return 'danger';
  if (
    statusLabel === 'Cancelled' ||
    statusLabel === 'Reversed' ||
    statusLabel === 'Reversing'
  ) {
    return 'muted';
  }
  return 'warning';
}

const RAIL_NODE_STYLES: Record<RailState, string> = {
  done: 'bg-emerald-600 text-white',
  danger: 'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white',
  muted: 'bg-slate-400 text-white',
  future: 'border-2 border-border bg-card text-muted-foreground',
};

const RAIL_WORD_STYLES: Record<RailState, string> = {
  done: 'text-emerald-600',
  danger: 'text-red-600',
  warning: 'text-amber-600',
  muted: 'text-muted-foreground',
  future: 'text-muted-foreground/70',
};

/* ================================================================== */
/* 渲染辅助                                                             */
/* ================================================================== */

/**
 * From/To 双行单元格（原型 PartyCell）：金额（含币种缩写）主行加粗 +
 * 钱包 CopyableId 次行（空 → '-'）。
 */
function PartyCell({
  amount,
  wallet,
}: {
  amount: string;
  wallet: string | undefined;
}) {
  return (
    <div className="min-w-0">
      <div className="text-sm font-semibold tabular-nums">{amount}</div>
      <div className="mt-1">
        <CopyableId
          value={wallet}
          className="font-mono text-xs text-muted-foreground"
        />
      </div>
    </div>
  );
}

/** 详情字段 widget：dt 小号灰标签，dd semibold；空值由 Dash 灰 '-'。 */
function Field({
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
      <dd className="mt-1 min-w-0 break-all text-sm font-semibold">
        {children}
      </dd>
    </div>
  );
}

/** Copy Summary 按钮：复制成功 ✓ 反馈（原型 writeClipboard + copied 态）。 */
function CopySummaryButton({ text }: { text: string }) {
  const [mark, setMark] = React.useState<'idle' | 'ok' | 'fail'>('idle');
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  async function onCopy() {
    const ok = await writeClipboard(text);
    setMark(ok ? 'ok' : 'fail');
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setMark('idle'), 1800);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void onCopy()}
      disabled={mark !== 'idle'}
    >
      {mark === 'ok' ? (
        <Check className="mr-1.5 size-3.5 text-emerald-600" aria-hidden="true" />
      ) : (
        <Copy className="mr-1.5 size-3.5" aria-hidden="true" />
      )}
      {mark === 'ok' ? 'Copied' : mark === 'fail' ? 'Copy failed' : 'Copy Summary'}
    </Button>
  );
}

/** 详情骨架（暂存行 effect 落定前的首帧）。 */
function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-16 motion-safe:animate-pulse rounded-lg bg-muted" />
      <div className="h-40 motion-safe:animate-pulse rounded-lg bg-muted" />
      <div className="h-32 motion-safe:animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

/** GAP-LP-11：无详情端点——直接深链（无暂存行）落 not-found 态。 */
function TxNotFound() {
  const router = useRouter();
  return (
    <section className="rounded-lg border border-border/60 bg-card p-8 text-center">
      <h2 className="text-lg font-semibold">Transaction not found.</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The record may have been removed.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => router.push(LIST_ROUTE)}
      >
        <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
        Back to FX Transactions
      </Button>
    </section>
  );
}

/* ================================================================== */
/* 列表页（含 ?txNo= 详情分支）                                         */
/* ================================================================== */

export function TxFlowListPage() {
  const searchParams = useSearchParams();
  const txKey = searchParams.get('txNo')?.trim() ?? '';
  // 无 hooks 早退：详情视图为独立子组件（hooks 互不影响）
  if (txKey) return <TxDetailView txKey={txKey} />;
  return <TxFlowListView />;
}

/**
 * 独立详情出口（同参 ?txNo=；registry 后续接 `detail` pageKey 时可直接复用）。
 */
export function FxTransactionDetailPage() {
  const searchParams = useSearchParams();
  const txKey = searchParams.get('txNo')?.trim() ?? '';
  if (!txKey) return <TxNotFound />;
  return <TxDetailView txKey={txKey} />;
}

/* ── 列表视图 ─────────────────────────────────────────────────────── */

function TxFlowListView() {
  const router = useRouter();
  const { register, handleSubmit, reset, control } =
    useForm<TxFlowFilterForm>({
      defaultValues: EMPTY_FILTER,
    });
  const [params, setParams] = React.useState<TxFlowQueryParams>(() =>
    formToParams(EMPTY_FILTER),
  );

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

  // v2.3 统一 token 元数据（symbol + 银行名）。
  const { symOf, bankOf, decimalsOf } = useTokenMeta(PROJECT_ID);

  /**
   * 金额口径（ed1a340/6a55188 → 原型 formatTokenAmount）：按对应 token 的
   * decimalDigits 定精度（千分位 + HALF_UP + 去尾零），后缀币种缩写；
   * 空值 '-' 不追加缩写。
   */
  const amountText = React.useCallback(
    (v: string | number | null | undefined, tokenCode?: string | null) => {
      const text = formatTokenAmount(v, decimalsOf(tokenCode));
      return text === '-' ? text : `${text} ${symOf(tokenCode)}`;
    },
    [decimalsOf, symOf],
  );

  // 0024 → 页级降级条保留旧数据；非 0024 失败清除（查询缓存保旧行）。
  const err = listQuery.error;
  const serviceDown = err != null && isServiceDown(err) ? err : null;

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.transactionId) })),
    [rows],
  );

  /**
   * GAP-LP-05：/lp/tx-flow/page 无服务端排序参数——表头排序为当前页本地
   * 排序（过渡口径，后端补 sortBy 后切换）；默认 Completed on 倒序。
   */
  type TxListRow = TxRow & { id: string };
  const sortGetters = React.useMemo<
    Record<string, ProtoSortGetter<TxListRow>>
  >(
    () => ({
      txNo: { value: (r) => txNoText(r) },
      tokens: {
        value: (r) =>
          `${symOf(r.sourceTokenCode)} → ${symOf(r.targetTokenCode)}`,
      },
      fxRate: {
        value: (r) =>
          r.userRate == null || r.userRate === '' ? null : Number(r.userRate),
      },
      status: { value: (r) => LP_TX_STATUS_MAP[r.status]?.rank ?? 99 },
      completedTime: {
        value: (r) => (r.completedTime === 0 ? null : r.completedTime),
        defaultDir: 'desc',
      },
      createTime: {
        value: (r) => (r.createTime || null) as number | null,
        defaultDir: 'desc',
      },
    }),
    [symOf],
  );
  const { sorted, toggle, sortState } = useProtoSort(
    tableData,
    sortGetters,
    'completedTime',
    'desc',
  );

  const columns = React.useMemo<ColumnDef<TxListRow>[]>(
    () => [
      {
        // Transaction No.：txNo 固定口径（无 txUuid/transactionId 回退），
        // CopyableId 中段截断 + 复制全文
        accessorKey: 'txNo',
        header: () => (
          <ProtoSortHeader
            label="Transaction No."
            columnKey="txNo"
            toggle={toggle}
            sortState={sortState('txNo')}
          />
        ),
        cell: ({ row }) => {
          const no = txNoText(row.original);
          return no === '-' ? (
            <span className="font-mono text-xs text-muted-foreground">-</span>
          ) : (
            <CopyableId value={no} className="font-mono text-xs" />
          );
        },
      },
      {
        // Tokens：SYM → SYM 加粗行（币对一律箭头口径）+ 银行次要行
        id: 'tokens',
        header: () => (
          <ProtoSortHeader
            label="Tokens"
            columnKey="tokens"
            toggle={toggle}
            sortState={sortState('tokens')}
          />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-mono text-xs font-semibold tabular-nums">
              {symOf(row.original.sourceTokenCode)} →{' '}
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
        // From：userDeduction（principal × (1+markup)，源端实际扣款）按源
        // token 精度；钱包次行 CopyableId
        id: 'from',
        header: 'From',
        cell: ({ row }) => (
          <PartyCell
            amount={amountText(
              row.original.userDeduction,
              row.original.sourceTokenCode,
            )}
            wallet={row.original.senderAccount}
          />
        ),
      },
      {
        // To：receiverAmount 按目标 token 精度；钱包次行 CopyableId
        id: 'to',
        header: 'To',
        cell: ({ row }) => (
          <PartyCell
            amount={amountText(
              row.original.receiverAmount,
              row.original.targetTokenCode,
            )}
            wallet={row.original.receiverAccount}
          />
        ),
      },
      {
        // FX Rate：formatRate 固定 4 位小数（原型口径）
        accessorKey: 'userRate',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="FX Rate"
              columnKey="fxRate"
              toggle={toggle}
              sortState={sortState('fxRate')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right font-mono text-xs tabular-nums">
            {formatRate(row.original.userRate)}
          </span>
        ),
      },
      {
        // Status：圆点徽章；failReason 仍以 tooltip 挂徽章
        accessorKey: 'status',
        header: () => (
          <ProtoSortHeader
            label="Status"
            columnKey="status"
            toggle={toggle}
            sortState={sortState('status')}
          />
        ),
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
        // Created on：毫秒 → formatUtc8（表头标 UTC+8）
        accessorKey: 'createTime',
        header: () => (
          <ProtoSortHeader
            label="Created on"
            columnKey="createTime"
            toggle={toggle}
            sortState={sortState('createTime')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
      {
        // Completed on：0 哨兵（未完成）→ '-'
        accessorKey: 'completedTime',
        header: () => (
          <ProtoSortHeader
            label="Completed on"
            columnKey="completedTime"
            toggle={toggle}
            sortState={sortState('completedTime')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.completedTime === 0
              ? '-'
              : formatUtc8(row.original.completedTime)}
          </span>
        ),
      },
      {
        // Actions → Details：暂存行后跳 ?txNo= 详情视图
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => {
              const key = txDetailKey(row.original);
              stashTxRow(key, row.original);
              router.push({ pathname: LIST_ROUTE, query: { txNo: key } });
            }}
          >
            {LBL.detail}
          </Button>
        ),
      },
    ],
    [symOf, bankOf, amountText, toggle, sortState, router],
  );

  /** Refetch keeps the current page number (source sync-reload semantics). */
  function reloadKeepingPage() {
    void listQuery.refetch();
  }

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
              {LBL.panel}
            </div>
            {listQuery.data != null && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {total} {LBL.countUnit}
              </span>
            )}
            {listQuery.dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatUtc8(listQuery.dataUpdatedAt)}
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
              data={sorted}
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
    </div>
  );
}

/* ── 详情视图（GAP-LP-11：暂存行 + chain 端点拼装） ────────────────── */

function TxDetailView({ txKey }: { txKey: string }) {
  const router = useRouter();

  // 暂存行读取收进 effect（SSR 首帧与客户端一致，避免 hydration 错位）
  const [seed, setSeed] = React.useState<TxRow | null>(null);
  const [seedReady, setSeedReady] = React.useState(false);
  React.useEffect(() => {
    setSeed(peekTxRow(txKey));
    setSeedReady(true);
  }, [txKey]);

  // 链路端点（环节真实 eventTime）；暂存行未落定前禁用
  const chainQuery = useTxFlowChainQuery(
    PROJECT_ID,
    seed?.transactionId ?? 0,
    seed != null,
  );
  const sessionQuery = useLpSessionQuery(PROJECT_ID);
  const { symOf, bankOf, decimalsOf } = useTokenMeta(PROJECT_ID);

  /** rail 码 → 首个链路事件时间（nodeType 环节/动作均计，取最早）。 */
  const chainTimes = React.useMemo(() => {
    const times = new Map<number, number>();
    if (!chainQuery.data) return times;
    for (const node of flattenChain(chainQuery.data)) {
      const to = node.statusTo ?? 0;
      if (
        to !== 0 &&
        RAIL_CODE_LIST.includes(to) &&
        !times.has(to) &&
        node.eventTime
      ) {
        times.set(to, node.eventTime);
      }
    }
    return times;
  }, [chainQuery.data]);

  /** 链路已抵达的最深环节（优先于 STATUS_RAIL_INDEX 静态钳制）。 */
  const chainMax = React.useMemo(() => {
    let max = -1;
    chainTimes.forEach((_t, code) => {
      const idx = RAIL_CODE_LIST.indexOf(code);
      if (idx > max) max = idx;
    });
    return max;
  }, [chainTimes]);

  const amountText = React.useCallback(
    (v: string | number | null | undefined, tokenCode?: string | null) => {
      const text = formatTokenAmount(v, decimalsOf(tokenCode));
      return text === '-' ? text : `${text} ${symOf(tokenCode)}`;
    },
    [decimalsOf, symOf],
  );

  // hooks 结束后的条件渲染
  if (!seedReady) return <DetailSkeleton />;
  if (!seed) return <TxNotFound />;

  const src = symOf(seed.sourceTokenCode);
  const tgt = symOf(seed.targetTokenCode);
  const lpName = sessionQuery.data?.lpName ?? '';
  const statusEntry = LP_TX_STATUS_MAP[seed.status];
  const statusLabel = statusEntry?.label ?? String(seed.status);
  const completed = seed.completedTime !== 0 && seed.completedTime != null;
  const durationMs =
    completed && seed.createTime
      ? seed.completedTime - seed.createTime
      : null;
  const stageIndex =
    chainMax >= 0 ? chainMax : (STATUS_RAIL_INDEX[seed.status] ?? 0);

  const railStates = RAIL_STEPS.map((_label, i) =>
    railState(statusEntry ? statusLabel : undefined, i, stageIndex),
  );
  const doneCount = railStates.filter((s) => s === 'done').length;

  /** 环节时间：链路真实 eventTime 优先；两端用行内 createTime/completedTime；
   *  中段无链路数据按原型 deltaSec 展示（UI 展示口径非业务数据，GAP-LP-11）。 */
  function railTimeText(i: number): string {
    const chainTs = chainTimes.get(RAIL_CODES[i]);
    if (chainTs) return formatUtc8(chainTs);
    if (i === 0) return formatUtc8(seed?.createTime);
    if (i === RAIL_CODES.length - 1) {
      return completed ? formatUtc8(seed?.completedTime) : '-';
    }
    return `+${RAIL_FALLBACK_DELTA_SEC[i]}s`;
  }

  const summaryText = [
    `Transaction No.: ${txNoText(seed)}`,
    `Status: ${statusLabel}`,
    `Token Pair: ${src} → ${tgt}`,
    `Sent Amount: ${amountText(seed.userDeduction, seed.sourceTokenCode)}`,
    `Received Amount: ${amountText(seed.receiverAmount, seed.targetTokenCode)}`,
    `FX Rate: 1 ${src} = ${formatRate(seed.userRate)} ${tgt}`,
    `LP: ${lpName || '-'}`,
    `Created: ${formatUtc8(seed.createTime)}`,
    `Completed: ${completed ? formatUtc8(seed.completedTime) : '-'}`,
  ].join('\n');

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* 页头：返回 + 标题/状态 + 单号/创建时间 + Copy Summary */}
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="mt-0.5 h-8 w-8 shrink-0"
              aria-label="Back to FX Transactions"
              onClick={() => router.push(LIST_ROUTE)}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {LBL.eyebrow}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">Transaction Details</h1>
                <TxStatusBadge status={seed.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>Transaction No.:</span>
                {txNoText(seed) === '-' ? (
                  <span>-</span>
                ) : (
                  <CopyableId value={txNoText(seed)} className="font-mono" />
                )}
                <span aria-hidden="true">|</span>
                <span className="tabular-nums">
                  Created on {formatUtc8(seed.createTime)}
                </span>
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <CopySummaryButton text={summaryText} />
          </div>
        </section>

        {/* §1 Settlement Overview */}
        <section className="rounded-lg border border-border/60 bg-card">
          <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-base font-semibold leading-6 text-foreground">
              Settlement Overview
            </div>
            {completed && durationMs != null && (
              // 完成件：结算耗时语义色徽章
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-50 font-normal text-emerald-700"
              >
                Settled in {formatDuration(durationMs)}
              </Badge>
            )}
          </div>
          <div className="space-y-5 p-4">
            <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
              {/* Sent Amount（源行金额卡） */}
              <div className="rounded-lg border border-border/60 bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium capitalize text-muted-foreground">
                    Sent Amount
                  </span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {bankOf(seed.sourceTokenCode)}
                  </Badge>
                </div>
                <div className="mt-2 text-xl font-bold tabular-nums">
                  {formatTokenAmount(
                    seed.userDeduction,
                    decimalsOf(seed.sourceTokenCode),
                  )}
                  <span className="ml-1.5 text-sm font-semibold">
                    {src}
                  </span>
                </div>
              </div>

              {/* 中心汇率徽章 + 换向图标 */}
              <div className="flex flex-col items-center gap-2 lg:px-4">
                <Badge
                  variant="outline"
                  className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground"
                >
                  1 {src} = {formatRate(seed.userRate)} {tgt}
                </Badge>
                <span className="grid size-8 place-items-center rounded-full border border-border/60 bg-background text-muted-foreground">
                  <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                </span>
              </div>

              {/* Received Amount（目标行金额卡，语义色描边） */}
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium capitalize text-emerald-700">
                    Received Amount
                  </span>
                  <Badge
                    variant="outline"
                    className="border-emerald-300 bg-background font-mono text-xs"
                  >
                    {bankOf(seed.targetTokenCode)}
                  </Badge>
                </div>
                <div className="mt-2 text-xl font-bold tabular-nums text-emerald-700">
                  {formatTokenAmount(
                    seed.receiverAmount,
                    decimalsOf(seed.targetTokenCode),
                  )}
                  <span className="ml-1.5 text-sm font-semibold">
                    {tgt}
                  </span>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="LP Name">
                <Dash value={lpName} />
              </Field>
              <Field label="Token Pair">
                <span className="font-mono">
                  {src} → {tgt}
                </span>
              </Field>
              <Field label="Pair Code">
                <CopyableId
                  value={seed.pairCode}
                  maxWidth={220}
                  className="font-mono"
                />
              </Field>
            </dl>
          </div>
        </section>

        {/* §2 Transaction Information */}
        <section className="rounded-lg border border-border/60 bg-card">
          <div className="border-b border-border/50 px-4 py-3">
            <div className="text-base font-semibold leading-6 text-foreground">
              Transaction Information
            </div>
          </div>
          <div className="p-4">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Sender Bank">
                <Dash value={bankOf(seed.sourceTokenCode)} />
              </Field>
              <Field label="Receiver Bank">
                <Dash value={bankOf(seed.targetTokenCode)} />
              </Field>
              <Field label="Principal">
                <span className="tabular-nums">
                  {amountText(seed.principal, seed.sourceTokenCode)}
                </span>
              </Field>
              <Field label="Sender Wallet">
                <CopyableId
                  value={seed.senderAccount}
                  maxWidth={200}
                  className="font-mono text-sm"
                />
              </Field>
              <Field label="Receiver Wallet">
                <CopyableId
                  value={seed.receiverAccount}
                  maxWidth={200}
                  className="font-mono text-sm"
                />
              </Field>
            </dl>
          </div>
        </section>

        {/* §3 Timing */}
        <section className="rounded-lg border border-border/60 bg-card">
          <div className="border-b border-border/50 px-4 py-3">
            <div className="text-base font-semibold leading-6 text-foreground">
              Timing
            </div>
          </div>
          <div className="p-4">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Created on">
                <span className="tabular-nums">
                  {formatUtc8(seed.createTime)}
                </span>
              </Field>
              <Field label="Completed on">
                <span className="tabular-nums">
                  {completed ? formatUtc8(seed.completedTime) : '-'}
                </span>
              </Field>
              <Field label="Duration">
                <span className="tabular-nums">
                  {durationMs != null ? formatDuration(durationMs) : '-'}
                </span>
              </Field>
            </dl>
          </div>
        </section>

        {/* §4 Clearance Pipeline（7 环节；链路真实 eventTime 优先） */}
        <section className="rounded-lg border border-border/60 bg-card">
          <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-base font-semibold leading-6 text-foreground">
              Clearance Pipeline
            </div>
            <Badge
              variant="outline"
              className={
                doneCount === RAIL_STEPS.length
                  ? 'border-emerald-300 bg-emerald-50 font-normal text-emerald-700'
                  : 'font-normal text-muted-foreground'
              }
            >
              <span
                className={
                  doneCount === RAIL_STEPS.length
                    ? 'mr-1.5 size-1.5 rounded-full bg-emerald-500'
                    : 'mr-1.5 size-1.5 rounded-full bg-muted-foreground/60'
                }
                aria-hidden="true"
              />
              {doneCount} of {RAIL_STEPS.length} Finalized
            </Badge>
          </div>
          <div className="p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {RAIL_STEPS.map((step, i) => {
                const state = railStates[i];
                const isLast = i === RAIL_STEPS.length - 1;
                const word =
                  state === 'done'
                    ? 'Completed'
                    : state === 'danger' || state === 'muted'
                      ? statusLabel
                      : state === 'warning'
                        ? 'In Progress'
                        : 'Pending';
                return (
                  <div
                    key={step}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-background p-3"
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold ${RAIL_NODE_STYLES[state]}`}
                      aria-hidden="true"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-5">
                        {step}
                      </div>
                      <div
                        className={`mt-0.5 text-xs font-medium ${RAIL_WORD_STYLES[state]}`}
                      >
                        {isLast && state === 'done' ? (
                          // 末环节完成：Finalized 语义色徽章（原型 SuccessBadge）
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-emerald-50 font-normal text-emerald-700"
                          >
                            Finalized
                          </Badge>
                        ) : (
                          word
                        )}
                      </div>
                      <div className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                        {railTimeText(i)}
                      </div>
                      <div className="mt-1.5 text-xs leading-5 text-muted-foreground">
                        {RAIL_STEP_INFO[i]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}
