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
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Clock3,
  Copy,
  FileText,
  Repeat,
  Workflow,
  X,
} from 'lucide-react';

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
import {
  RAIL_CODES,
  RAIL_CODE_LIST,
  RAIL_FALLBACK_DELTA_SEC,
  RAIL_STEPS,
  RAIL_STEP_INFO,
  STATUS_RAIL_INDEX,
  chainEventRailCode,
  railState,
  type RailState,
} from './tx-flow-rail';
import { CopyableId, Dash, ProtoStatusBadge, type ProtoTone } from './proto-ui';
import { LP_TX_STATUS_MAP } from './proto-enums';
import {
  ProtoSortHeader,
  useProtoSort,
  type ProtoSortGetter,
} from './proto-sort';
import { SyncRefreshButton } from './sync-refresh-button';
import { ServiceDownAlert } from './service-down-alert';

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
/* rail 纯推导（环节码/钳制表/railState/事件码归一）抽至 tx-flow-rail，此处仅留样式映射。 */

const RAIL_NODE_STYLES: Record<RailState, string> = {
  done: 'bg-success text-white',
  danger: 'bg-destructive text-white',
  warning: 'bg-warning text-white',
  muted: 'bg-muted text-muted-foreground',
  future: 'border-2 border-border bg-background text-muted-foreground',
};

const RAIL_WORD_STYLES: Record<RailState, string> = {
  done: 'text-success',
  danger: 'text-destructive',
  warning: 'text-warning',
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

/** 详情字段：标签小字灰、值一行；保留 dt/dd 语义。 */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <dt className="text-xs font-medium capitalize text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-all text-sm text-foreground">{children}</dd>
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
    // 2026-10-29 统一链路：服务端扁平事件（自环已过滤），取最早 eventTime；
    // 事件码经 chainEventRailCode 归一（35 Credited→40）——tx125 事故前 35 不在
    // RAIL_CODES 被直接丢弃，Credited 终态交易 chainMax 卡在 Processing、第 7 环永远 Pending
    const times = new Map<number, number>();
    for (const e of chainQuery.data?.events ?? []) {
      const railCode = chainEventRailCode(e.statusTo ?? 0);
      if (
        railCode !== 0 &&
        RAIL_CODE_LIST.includes(railCode) &&
        !times.has(railCode) &&
        e.eventTime
      ) {
        times.set(railCode, e.eventTime);
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
    railState(
      seed.status,
      statusEntry ? statusLabel : undefined,
      i,
      stageIndex,
    ),
  );
  const doneCount = railStates.filter((s) => s === 'done').length;
  const progressPct = Math.round((doneCount / RAIL_STEPS.length) * 100);
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-start gap-3">
            <Button
              type="button"
              variant="outline"
              size="iconSm"
              aria-label="Back to FX Transactions"
              onClick={() => router.push(LIST_ROUTE)}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-semibold">Transaction Details</h1>
                <TxStatusBadge status={seed.status} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  Transaction No:{' '}
                  <span className="font-semibold text-foreground">
                    {txNoText(seed) === '-' ? (
                      '-'
                    ) : (
                      <CopyableId value={txNoText(seed)} />
                    )}
                  </span>
                </span>
                <span aria-hidden="true">|</span>
                <span className="tabular-nums">
                  Created on {formatUtc8(seed.createTime)}
                </span>
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <CopySummaryButton text={summaryText} />
          </div>
        </div>

        {/* Kissen-style detail layout: transaction information beside the stage rail. */}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <ArrowLeftRight className="size-4" aria-hidden="true" />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">
                    Transaction Overview
                  </h2>
                </div>
                {completed && durationMs != null ? (
                  <Badge variant="success" dot>
                    Settled in {formatDuration(durationMs)}
                  </Badge>
                ) : null}
              </header>
              <div className="p-6">
                <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
                  <div className="min-w-0 rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Sent Amount
                      </span>
                      <Badge variant="mute">{bankOf(seed.sourceTokenCode)}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
                      <span className="text-2xl font-bold tabular-nums">
                        {formatTokenAmount(
                          seed.userDeduction,
                          decimalsOf(seed.sourceTokenCode),
                        )}
                      </span>
                      <span className="text-sm font-semibold tracking-wide">
                        {src}
                      </span>
                    </div>
                  </div>
                  <div className="flex min-w-0 shrink-0 flex-col items-center gap-2 md:px-6">
                    <Badge
                      variant="outline"
                      className="whitespace-nowrap tabular-nums"
                    >
                      1 {src} ≈ {formatRate(seed.userRate)} {tgt}
                    </Badge>
                    <Repeat
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    <Badge className="max-w-full truncate whitespace-nowrap">
                      {lpName || '-'}
                    </Badge>
                  </div>
                  <div className="min-w-0 rounded-lg border border-success bg-success/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Received Amount
                      </span>
                      <Badge variant="mute">{bankOf(seed.targetTokenCode)}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-success">
                      <span className="text-2xl font-bold tabular-nums">
                        +{formatTokenAmount(
                          seed.receiverAmount,
                          decimalsOf(seed.targetTokenCode),
                        )}
                      </span>
                      <span className="text-sm font-semibold tracking-wide">
                        {tgt}
                      </span>
                    </div>
                  </div>
                </div>
                <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
                  <Field label="LP Name">
                    <Dash value={lpName} />
                  </Field>
                  <Field label="Token Pair">
                    <span className="font-mono">
                      {src}/{tgt}
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

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <FileText className="size-4" aria-hidden="true" />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">
                    Transaction Information
                  </h2>
                </div>
              </header>
              <div className="space-y-5 p-6">
                <dl>
                  <Field label="Transaction ID">
                    <span className="font-mono tabular-nums">
                      {seed.transactionId}
                    </span>
                  </Field>
                </dl>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <section
                    aria-label="Source currency details"
                    className="min-w-0 rounded-lg border border-border p-4"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        Source Currency
                      </h3>
                      <span className="rounded-full border border-border px-2.5 py-1 font-mono text-xs text-foreground">
                        {src}
                      </span>
                    </div>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                      <Field label="Sender Bank">
                        <Dash value={bankOf(seed.sourceTokenCode)} />
                      </Field>
                      <Field label="Sender Wallet">
                        <CopyableId value={seed.senderAccount} />
                      </Field>
                      <Field label="Principal">
                        <span className="font-mono tabular-nums">
                          {amountText(seed.principal, seed.sourceTokenCode)}
                        </span>
                      </Field>
                      <Field label="User Deduction">
                        <span className="font-mono tabular-nums">
                          {amountText(seed.userDeduction, seed.sourceTokenCode)}
                        </span>
                      </Field>
                      <Field label="Source Chain Tx ID">
                        <CopyableId value={seed.sourceCsTxId} />
                      </Field>
                    </dl>
                  </section>
                  <section
                    aria-label="Target currency details"
                    className="min-w-0 rounded-lg border border-border p-4"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        Target Currency
                      </h3>
                      <span className="rounded-full border border-border px-2.5 py-1 font-mono text-xs text-foreground">
                        {tgt}
                      </span>
                    </div>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                      <Field label="Receiver Bank">
                        <Dash value={bankOf(seed.targetTokenCode)} />
                      </Field>
                      <Field label="Receiver Wallet">
                        <CopyableId value={seed.receiverAccount} />
                      </Field>
                      <Field label="Received Amount">
                        <span className="font-mono tabular-nums">
                          {amountText(seed.receiverAmount, seed.targetTokenCode)}
                        </span>
                      </Field>
                    </dl>
                  </section>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <header className="flex items-center gap-3 border-b border-border px-6 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Clock3 className="size-4" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">Timing</h2>
              </header>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 md:grid-cols-3">
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
            </section>
          </div>

          <aside className="min-w-0 xl:col-span-4">
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <header className="border-b border-border px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Workflow className="size-4" aria-hidden="true" />
                      </span>
                      <h2 className="text-sm font-semibold text-foreground">
                        Clearance Pipeline
                      </h2>
                      <Badge variant="success" className="tabular-nums">
                        {doneCount}/{RAIL_STEPS.length} Finalized
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Transaction lifecycle
                    </p>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-success">
                    {progressPct}%
                  </span>
                </div>
              </header>
              <div className="p-6">
                <div
                  role="progressbar"
                  aria-label="Transaction settlement progress"
                  aria-valuemin={0}
                  aria-valuemax={RAIL_STEPS.length}
                  aria-valuenow={doneCount}
                >
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        doneCount === RAIL_STEPS.length
                          ? 'bg-success'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
                <ol className="mt-6">
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
                    const timeText =
                      state === 'future' ? '' : railTimeText(i);
                    return (
                      <li
                        key={step}
                        aria-current={i === stageIndex ? 'step' : undefined}
                        className="relative min-w-0 pb-6 pl-12 last:pb-0"
                      >
                        {i < RAIL_STEPS.length - 1 ? (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0 left-[15px] top-8 w-px bg-border"
                          />
                        ) : null}
                        <span
                          aria-hidden="true"
                          className={`absolute left-0 top-0 grid size-8 place-items-center rounded-full ${RAIL_NODE_STYLES[state]}`}
                        >
                          {state === 'done' ? (
                            <Check className="size-4" aria-hidden="true" />
                          ) : null}
                          {state === 'danger' ? (
                            <X className="size-4" aria-hidden="true" />
                          ) : null}
                          {state === 'warning' ? (
                            <span className="size-2 rounded-full bg-white" />
                          ) : null}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span
                                className={`text-sm font-semibold ${
                                  state === 'future'
                                    ? 'text-muted-foreground'
                                    : 'text-foreground'
                                }`}
                              >
                                {step}
                              </span>
                              {isLast && state === 'done' ? (
                                <Badge variant="success">Finalized</Badge>
                              ) : (
                                <span
                                  className={`text-xs ${RAIL_WORD_STYLES[state]}`}
                                >
                                  {word}
                                </span>
                              )}
                            </div>
                            {timeText && timeText !== '-' ? (
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {timeText}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {RAIL_STEP_INFO[i]}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
