'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

import {
  Badge,
  Button,
  CopyableEllipsisText,
  DataTable,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  exportTx,
  txBankRoleText,
  txBankRoleVariant,
  txDirectionText,
  txFlowEventTitle,
  txMsgTypeText,
  txMsgTypeVariant,
  txProcessStatusText,
  txProcessStatusVariant,
  useFxViewQuery,
  useTxChain,
  useTxDetail,
  useTxPage,
  type FxPairItem,
  type TxFlowNode,
  type TxListReq,
  type TxMessage,
  type TxRecord,
} from '@myorg/modules/kissen-gateway/data-access';

import { DescField, DescGrid } from './desc-grid';
import { OPT_ALL, fmtAmount, formatTime, orDash, toEpochMs } from './kit';
import { CopyableId, ProtoStatusBadge, type ProtoStatusTone } from './proto-ui';
import { formatRate, formatTokenAmount, formatUtc8 } from './proto-format';
import { PROTO_TX_STATUS, protoStatusText } from './proto-enums';
import {
  ColumnPicker,
  SortHeader,
  compareProtoValues,
  filterVisibleColumns,
  useColumnPreferences,
  useTableSort,
  type ProtoColumnDef,
} from './proto-table';
import { useGatewayPerm } from './use-gateway-perm';

/**
 * 交易记录域页面（源 `views/tx/list.vue` + a9dc10e 新增独立详情 `views/tx/detail.vue`：
 * 列表 7 控件筛选/分页/CSV 导出；详情双栏——主栏基本信息 + 报文留痕 timeline，
 * 右侧 400px 交易链路六段口径，两栏同源 chain 接口）。
 * 详情从源 Dialog 改为独立路由页（registry：/tx + detail key）。
 */
/** 路由 query 中的交易 ID → 正整数；非法 → undefined。 */
function parseTxId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 源 v-perm="'bank:tx:export'"：导出按钮权限码。 */
const TX_EXPORT_PERM = 'bank:tx:export';

/**
 * 链路节点圆点直查色（源 flowNodeType TagType × Element 主题色，overview 页
 * DIST_BAR_COLOR 同款口径）：40|35 success 绿 / 90|70 danger 橙红 / 60|50 warning
 * 橙 / 其余 primary 蓝。data-access TX_STATUS variant 分层已折叠 warning/primary，
 * 无法反推，故页面层直查（与 overview-pages 处理一致）。
 */
const FLOW_NODE_COLOR: Record<number, string> = {
  35: '#0B6B53', // success Credited
  40: '#0B6B53', // success Completed
  50: '#B45309', // warning Reversing
  60: '#B45309', // warning Reversed
  70: '#C2410C', // danger Error (Manual Handling)
  90: '#C2410C', // danger Failed
};
const FLOW_NODE_COLOR_DEFAULT = '#3B82F6'; // primary（源 flowNodeType 兜底）

/** 链路节点圆点色（源 flowNodeType：按迁移后状态取色）。 */
function flowNodeColor(statusTo?: number): string {
  return FLOW_NODE_COLOR[statusTo ?? -1] ?? FLOW_NODE_COLOR_DEFAULT;
}

/** 终态判定（源 isTerminal）：35 入账 / 40 完成 / 60 冲正 / 80 取消 / 90 失败 → 实心（cdc9fa0 补 35）。 */
function isFlowTerminal(statusTo?: number): boolean {
  return (
    statusTo === 35 ||
    statusTo === 40 ||
    statusTo === 60 ||
    statusTo === 80 ||
    statusTo === 90
  );
}

/**
 * kissenChain 树展平（源 openDetail 的 walk；d764217 起不再按 eventTime
 * 升序重排——顺序由后端 gw_tx_flow ORDER BY step ASC, flow_id ASC 落库序保证）。
 */
function flattenChain(nodes: TxFlowNode[] | null | undefined): TxFlowNode[] {
  const flat: TxFlowNode[] = [];
  const walk = (list?: TxFlowNode[] | null): void => {
    (list ?? []).forEach((n) => {
      flat.push(n);
      walk(n.children);
    });
  };
  walk(nodes);
  return flat;
}

/** 本地报文按 createTime 升序（源 openDetail 的 messages sort）。 */
function sortMessages(messages: TxMessage[] | null | undefined): TxMessage[] {
  return [...(messages ?? [])].sort(
    (a, b) => (a.createTime ?? 0) - (b.createTime ?? 0),
  );
}

/* ================================================================== */
/* 列表页（源筛选 a9dc10e 扩容：Transaction No. / Tokens / From / To /  */
/* LP / Status / 时间范围，文本均回车提交、trim 非空才传）              */
/* ================================================================== */

const txFilterSchema = z.object({
  txNo: z.string(),
  pairId: z.string(),
  senderAccount: z.string(),
  receiverAccount: z.string(),
  lpName: z.string(),
  status: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});
type TxFilterForm = z.infer<typeof txFilterSchema>;

const TX_FILTER_DEFAULT: TxFilterForm = {
  txNo: '',
  pairId: OPT_ALL,
  senderAccount: '',
  receiverAccount: '',
  lpName: '',
  status: OPT_ALL,
  startTime: '',
  endTime: '',
};

/** 源 nz()：trim 后非空才作为模糊条件传给后端。 */
function nz(v: string): string | undefined {
  const t = v.trim();
  return t ? t : undefined;
}

function formToFilter(form: TxFilterForm): TxListReq {
  return {
    txNo: nz(form.txNo),
    pairId: form.pairId === OPT_ALL ? undefined : Number(form.pairId),
    senderAccount: nz(form.senderAccount),
    receiverAccount: nz(form.receiverAccount),
    lpName: nz(form.lpName),
    status: form.status === OPT_ALL ? undefined : Number(form.status),
    /* 原型 DateRangeField 日粒度：from 当日 00:00 / to 当日 23:59（含全天）。 */
    startTime: form.startTime ? toEpochMs(`${form.startTime}T00:00`) : undefined,
    endTime: form.endTime ? toEpochMs(`${form.endTime}T23:59`) : undefined,
  };
}

/** 源分页 pageSize 固定 10（el-pagination layout 无 sizes/jumper）。 */
const TX_PAGE_SIZE = 10;

/* ─────────────── 列表：列契约 / 状态色 / 列偏好（原型 TransactionRecordsPage） ─────────────── */

/** 列契约（原型 COLUMNS 逐字；LP Name 默认隐藏，GAP 登记外的原型默认）。 */
const TX_COLUMNS: ProtoColumnDef[] = [
  { id: 'transactionNo', label: 'Transaction No.', required: true },
  { id: 'tokens', label: 'Tokens' },
  { id: 'from', label: 'From' },
  { id: 'to', label: 'To' },
  { id: 'fxRate', label: 'FX Rate' },
  { id: 'lp', label: 'LP Name', defaultVisible: false },
  { id: 'createdAt', label: 'Created on (UTC+8)', required: true },
  { id: 'status', label: 'Status', required: true },
  { id: 'actions', label: 'Actions', required: true },
];

/** 列偏好 localStorage 键（原型 useTableColumnPreferences 同语义）。 */
const TX_COLUMN_PREF_KEY = 'gw.tx-list.columns';

/**
 * 状态码 → 徽章语义色（13 态生命周期分层；35/40 成功、50/60 冲正警示、
 * 70/90 异常失败、80 取消灰、其余流转中 info）。原型徽章带点，走 ProtoStatusBadge。
 */
const TX_STATUS_TONES: Record<number, ProtoStatusTone> = {
  1: 'info',
  5: 'info',
  10: 'info',
  20: 'info',
  25: 'info',
  30: 'info',
  35: 'success',
  40: 'success',
  50: 'warning',
  60: 'warning',
  70: 'danger',
  80: 'muted',
  90: 'danger',
};

/** 列表 → 详情行数据暂存前缀（源 openDetail 先用行数据立即渲染，接口返回后覆盖）。 */
const TX_STASH_PREFIX = 'kissen-gateway.tx.seed.';

/** 暂存被点击的行（sessionStorage；写失败静默——详情页回退纯接口渲染）。 */
function stashTxSeed(row: TxRecord): void {
  try {
    sessionStorage.setItem(
      `${TX_STASH_PREFIX}${row.transactionId}`,
      JSON.stringify(row),
    );
  } catch {
    /* 隐私模式/配额超限时放弃暂存 */
  }
}

/** 读取暂存行；缺失/损坏/ID 不符 → null。 */
function readTxSeed(transactionId: number): TxRecord | null {
  try {
    const raw = sessionStorage.getItem(`${TX_STASH_PREFIX}${transactionId}`);
    const parsed = raw ? (JSON.parse(raw) as TxRecord) : null;
    return parsed?.transactionId === transactionId ? parsed : null;
  } catch {
    return null;
  }
}

/* ================================================================== */
/* fx 聚合视图缓存派生（源 pairOf/srcSymbol/tgtSymbol/pairRateOf）        */
/* ================================================================== */

/**
 * 行 token 对聚合项（源 pairOf：pairId → fxView 聚合视图缓存）。
 * 缓存保留整个 FxPairItem——tokenPair 供 tokens/From 列，rate 供 FX Rate 列。
 */
function pairViewOf(
  pairId: number | null | undefined,
  pairMap: ReadonlyMap<number, FxPairItem>,
): FxPairItem | undefined {
  return pairId != null ? pairMap.get(pairId) : undefined;
}

/** pairId → fx 聚合项索引（整项保留：tokenPair 与 rate 快照均可取；列表/详情两页共用）。 */
function buildPairMap(
  pairs: FxPairItem[] | null | undefined,
): ReadonlyMap<number, FxPairItem> {
  const map = new Map<number, FxPairItem>();
  for (const item of pairs ?? []) {
    map.set(item.tokenPair.pairId, item);
  }
  return map;
}
/**
 * 阶段事件关联字段行（fe61223 admin 同款口径，源 stageFields）：金额/汇率取交易
 * 主表（值缺失整行跳过），金额带 token symbol（缺缓存退纯数字），凭证优先节点
 * csTxId 回退主表 sourceCsTxId/targetCsTxId；step2 无字段，0=通用事件恒空。
 * ddd9fe2：源端金额口径=userDeduction（用户实际扣款，含汇率加价承担）；
 * principal 仅为按接收金额换算的发起基准值，不作源端金额展示。
 * ddae8d4：汇率展示统一 4 位小数（对齐 FX 页 / 交易列表口径）。
 */
function stageFieldsOf(
  node: TxFlowNode,
  record: TxRecord | null | undefined,
  pairMap: ReadonlyMap<number, FxPairItem>,
): Array<{ label: string; value: string }> {
  const step = node.stageStep ?? 0;
  if (step === 0) return [];
  const fields: Array<{ label: string; value: string }> = [];
  const pair = pairViewOf(record?.pairId, pairMap)?.tokenPair;
  const src = pair?.sourceTokenSymbol || pair?.sourceTokenCode;
  const tgt = pair?.targetTokenSymbol || pair?.targetTokenCode;
  const withSym = (
    v: number | null | undefined,
    sym: string | undefined,
  ): string | undefined =>
    v == null ? undefined : sym ? `${fmtAmount(v)} ${sym}` : fmtAmount(v);
  const lp = record?.lpNames?.length
    ? record.lpNames.join(', ')
    : (record?.lpCode || undefined);
  const deduction = withSym(record?.userDeduction, src);
  const receiver = withSym(record?.receiverAmount, tgt);
  const rate =
    record?.userRate != null
      ? Number(record.userRate).toFixed(4)
      : undefined;
  if (step === 1) {
    if (lp) fields.push({ label: 'LP', value: lp });
    if (deduction) fields.push({ label: 'Source Amount', value: deduction });
    if (receiver) fields.push({ label: 'Target Amount', value: receiver });
    if (rate) fields.push({ label: 'Rate', value: rate });
  } else if (step === 3 || step === 4) {
    if (deduction) fields.push({ label: 'Source Amount', value: deduction });
    const proof = node.csTxId || record?.sourceCsTxId;
    if (proof) fields.push({ label: 'Proof', value: proof });
  } else if (step === 5 || step === 6) {
    if (receiver) fields.push({ label: 'Target Amount', value: receiver });
    const proof = node.csTxId || record?.targetCsTxId;
    if (proof) fields.push({ label: 'Proof', value: proof });
  }
  return fields;
}

export function TxListPage() {
  const router = useRouter();
  const toast = useToast();
  const hasPerm = useGatewayPerm();
  const { register, reset, control, watch } = useForm<TxFilterForm>({
    resolver: zodResolver(txFilterSchema),
    defaultValues: TX_FILTER_DEFAULT,
  });

  const [filter, setFilter] = React.useState<TxListReq>(() =>
    formToFilter(TX_FILTER_DEFAULT),
  );
  const [pageNum, setPageNum] = React.useState(1);
  const [exporting, setExporting] = React.useState(false);
  const { sort, toggle } = useTableSort('createdAt', 'desc');
  const columnPreferences = useColumnPreferences(
    TX_COLUMN_PREF_KEY,
    TX_COLUMNS,
  );

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useTxPage({
    pageNum,
    pageSize: TX_PAGE_SIZE,
    filter,
  });

  /**
   * fx 聚合视图缓存（源 onMounted fxView → pairViews）：tokens/From/FX Rate 列
   * 的 token 对与最新汇率数据源。与 /fx 页共用同一 query key，缓存命中不新增请求。
   */
  const { data: fxViewData } = useFxViewQuery();
  /** pairId → 聚合项索引（整项保留：tokenPair 与 rate 快照均可取）。 */
  const pairMap = React.useMemo(
    () => buildPairMap(fxViewData?.pairs),
    [fxViewData],
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load transactions', {
        description:
          error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  /* 原型 Filters embedded：输入即时生效（300ms 防抖回写服务端检索 + 回页 1），
   * 无 Query/搜索按钮；Reset 一键清空（token/fx 页同款口径）。 */
  const filterTimer = React.useRef<number | null>(null);
  React.useEffect(() => {
    const subscription = watch((values) => {
      if (filterTimer.current != null) window.clearTimeout(filterTimer.current);
      filterTimer.current = window.setTimeout(() => {
        setFilter(formToFilter(values as TxFilterForm));
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
    (watched.txNo ?? '').trim() !== '' ||
    (watched.senderAccount ?? '').trim() !== '' ||
    (watched.receiverAccount ?? '').trim() !== '' ||
    (watched.lpName ?? '').trim() !== '' ||
    (watched.pairId ?? OPT_ALL) !== OPT_ALL ||
    (watched.status ?? OPT_ALL) !== OPT_ALL ||
    (watched.startTime ?? '') !== '' ||
    (watched.endTime ?? '') !== '';

  const onReset = React.useCallback(() => {
    reset(TX_FILTER_DEFAULT);
    setFilter(formToFilter(TX_FILTER_DEFAULT));
    setPageNum(1);
  }, [reset]);

  /**
   * 导出 Excel（源 onExport，eafcab0 起 CSV→xlsx）：POST /tx/export blob 直通，
   * 按当前筛选条件全量导出（列表与导出共用同一 filter 口径，即源 buildReq），
   * 文件名 `tx-export-{Date.now()}.xlsx`。有意偏差：原型为 Export CSV，本仓保留 xlsx。
   */
  const onExport = React.useCallback(async () => {
    setExporting(true);
    try {
      const resp = await exportTx(filter);
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tx-export-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // 源 catch 静默靠拦截器；本门户约定 toast 显性提示（traceId 由 KissenApiError 拼入 message）。
      toast.error('Failed to export transactions', {
        description: e instanceof Error ? e.message : 'Please try again later',
      });
    } finally {
      setExporting(false);
    }
  }, [filter, toast]);

  /** 详情跳转（registry：/tx + detail key；源行点击/详情按钮同一目标）。
   *  先暂存行数据——详情页据此立即渲染，等接口返回后覆盖（源 openDetail L194-207）。 */
  const onView = React.useCallback(
    (row: TxRecord) => {
      stashTxSeed(row);
      router.push(`/tx/detail?id=${row.transactionId}`);
    },
    [router],
  );

  /** Status 筛选 options：13 态全表按生命周期 rank 排序（AGENTS.md §3.3.4，不按字母）。 */
  const statusSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All' },
      ...Object.entries(PROTO_TX_STATUS)
        .sort(([, a], [, b]) => a.rank - b.rank)
        .map(([code, meta]) => ({ value: code, label: meta.text })),
    ],
    [],
  );
  /** Tokens 筛选下拉（源 pairLabel：symbol 缺省回退 code，双侧 + 银行后缀）。 */
  const pairSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All Token Pairs' },
      ...[...pairMap.values()].map((v) => {
        const p = v.tokenPair;
        const src = p.sourceTokenSymbol || p.sourceTokenCode;
        const tgt = p.targetTokenSymbol || p.targetTokenCode;
        return {
          value: String(p.pairId),
          label: `${src} → ${tgt} · ${p.sourceBankCode || '-'}→${p.targetBankCode || '-'}`,
        };
      }),
    ],
    [pairMap],
  );

  /* 排序：服务端 /tx/page 无排序参数——当前页内排序（可排键白名单与原型一致：
   * transactionNo / fxRate / lp / createdAt；默认 createdAt desc）。 */
  const sortAccessors = React.useMemo<
    Record<string, (r: TxRecord) => string | number | null | undefined>
  >(
    () => ({
      transactionNo: (r) => r.txNo || r.txUuid || String(r.transactionId),
      fxRate: (r) => pairViewOf(r.pairId, pairMap)?.rate?.userRate,
      lp: (r) => (r.lpNames?.length ? r.lpNames.join(', ') : undefined),
      createdAt: (r) => r.createTime,
    }),
    [pairMap],
  );
  const sortedRows = React.useMemo(() => {
    const accessor = sort.key ? sortAccessors[sort.key] : undefined;
    if (!accessor) return rows;
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...rows].sort(
      (a, b) => compareProtoValues(accessor(a), accessor(b)) * dir,
    );
  }, [rows, sort, sortAccessors]);

  const tableData = React.useMemo(
    () => sortedRows.map((r) => ({ ...r, id: String(r.recordId) })),
    [sortedRows],
  );

  /**
   * 列序对齐 BP 原型 COLUMNS 逐字：Transaction No. / Tokens / From / To /
   * FX Rate / LP Name（默认隐藏）/ Created on (UTC+8) / Status / Actions；
   * 源端·目标端交易 ID 与本行角色/银行/本金/待处理单列移入详情页。
   */
  const columns = React.useMemo<ColumnDef<TxRecord & { id: string }>[]>(() => {
    return [
      {
        id: 'transactionNo',
        header: () => (
          <SortHeader
            label="Transaction No."
            direction={sort.key === 'transactionNo' ? sort.direction : null}
            onToggle={() => toggle('transactionNo')}
          />
        ),
        cell: ({ row }) => (
          <div className="inline-flex min-w-0 items-center gap-1 font-mono">
            <CopyableId
              value={String(
                row.original.txNo ||
                  row.original.txUuid ||
                  row.original.transactionId,
              )}
            />
            {/* 源 f5009b3：selfTrade 追加「自转」warning plain 小 tag + tooltip（Badge 不转发 ref，asChild 需原生 span）。 */}
            {row.original.selfTrade && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-default align-middle">
                      <Badge
                        variant="outline"
                        className="border-amber-300 px-1.5 text-[10px] text-amber-700 dark:border-amber-700 dark:text-amber-400"
                      >
                        Self-Trade
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Self-trade: source and target are both this bank
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ),
      },
      {
        id: 'tokens',
        header: 'Tokens',
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const view = pairViewOf(row.original.pairId, pairMap);
          /* 缺缓存回退：`#pairId ?? '-'`（源 num 样式兜底）。 */
          if (!view) {
            return (
              <span className="font-mono">#{row.original.pairId ?? '-'}</span>
            );
          }
          const pair = view.tokenPair;
          return (
            <div>
              {/* 源 pair-cell：双侧「tag + 下方 11px 灰字 bankCode」纵排（token + Bank）。 */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-0.5">
                  <Badge variant="outline">
                    {pair.sourceTokenSymbol || pair.sourceTokenCode || '-'}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {pair.sourceBankCode || '-'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">→</span>
                <div className="flex flex-col items-center gap-0.5">
                  <Badge
                    variant="outline"
                    className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                  >
                    {pair.targetTokenSymbol || pair.targetTokenCode || '-'}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {pair.targetBankCode || '-'}
                  </span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'from',
        header: 'From',
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const pair = pairViewOf(row.original.pairId, pairMap)?.tokenPair;
          const sym = pair?.sourceTokenSymbol || pair?.sourceTokenCode || '-';
          return (
            <div className="min-w-0">
              {/* 原型 WalletAmountCell：金额行在上（ddd9fe2 扣款口径 userDeduction，源币种）。 */}
              <div className="text-sm font-medium tabular-nums">
                {row.original.userDeduction != null ? (
                  <>
                    {formatTokenAmount(row.original.userDeduction)} {sym}
                  </>
                ) : (
                  <span className="text-muted-foreground/60">-</span>
                )}
              </div>
              {/* 地址行在下（中间省略+可复制，§7-43②），缺地址回退银行名。 */}
              {row.original.senderAccount ? (
                <CopyableId value={row.original.senderAccount} />
              ) : (
                <div className="text-xs text-muted-foreground">
                  {row.original.senderBankName || '-'}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'to',
        header: 'To',
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const pair = pairViewOf(row.original.pairId, pairMap)?.tokenPair;
          const sym = pair?.targetTokenSymbol || pair?.targetTokenCode || '-';
          return (
            <div className="min-w-0">
              {/* a9dc10e：到账金额 receiverAmount（目标端 G-5 落账，未同步 '-'）。 */}
              <div className="text-sm font-medium tabular-nums">
                {row.original.receiverAmount != null ? (
                  <>
                    {formatTokenAmount(row.original.receiverAmount)} {sym}
                  </>
                ) : (
                  <span className="text-muted-foreground/60">-</span>
                )}
              </div>
              {row.original.receiverAccount ? (
                <CopyableId value={row.original.receiverAccount} />
              ) : (
                <div className="text-xs text-muted-foreground">
                  {row.original.receivingBankName || '-'}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'fxRate',
        header: () => (
          <SortHeader
            label="FX Rate"
            direction={sort.key === 'fxRate' ? sort.direction : null}
            onToggle={() => toggle('fxRate', 'desc')}
            numeric
          />
        ),
        cell: ({ row }) => {
          /* 快照口径非成交时点（源 pairRateOf）：未推送/未知 '-'。 */
          const rate = pairViewOf(row.original.pairId, pairMap)?.rate;
          return (
            <span className="block text-right tabular-nums">
              {rate?.userRate == null ? '-' : formatRate(rate.userRate)}
            </span>
          );
        },
      },
      {
        id: 'lp',
        header: () => (
          <SortHeader
            label="LP Name"
            direction={sort.key === 'lp' ? sort.direction : null}
            onToggle={() => toggle('lp')}
          />
        ),
        cell: ({ row }) => {
          /* 原型 TruncateCell：单行截断文本（title 悬浮全量），非徽章。 */
          const lp = row.original.lpNames?.length
            ? row.original.lpNames.join(', ')
            : null;
          return lp ? (
            <span className="block max-w-[180px] truncate" title={lp}>
              {lp}
            </span>
          ) : (
            <span>-</span>
          );
        },
      },
      {
        id: 'createdAt',
        header: () => (
          <SortHeader
            label="Created on (UTC+8)"
            direction={sort.key === 'createdAt' ? sort.direction : null}
            onToggle={() => toggle('createdAt', 'desc')}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const badge = (
            <ProtoStatusBadge
              label={protoStatusText(PROTO_TX_STATUS, row.original.status)}
              tone={TX_STATUS_TONES[row.original.status ?? -1] ?? 'muted'}
            />
          );
          /* 待处理不单列，收进状态旁小号 warning 角标（源有、原型无——保留）。 */
          return row.original.pendingFlag === 1 ? (
            <span className="inline-flex items-center gap-1">
              {badge}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-default">
                      <Badge
                        variant="outline"
                        className="border-amber-300 px-1.5 text-[10px] text-amber-700 dark:border-amber-700 dark:text-amber-400"
                      >
                        Pending
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Pending (ACTION_REQUIRED), see detail for reason
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          ) : (
            badge
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
            onClick={() => onView(row.original)}
          >
            Details
          </Button>
        ),
      },
    ];
  }, [onView, pairMap, sort, toggle]);

  /* 列偏好：required 列恒显，其余按用户选择过滤（LP Name 默认隐藏）。 */
  const visibleColumns = React.useMemo(
    () =>
      filterVisibleColumns(
        columns,
        TX_COLUMNS,
        columnPreferences.isColumnVisible,
      ),
    [columns, columnPreferences],
  );

  return (
    <div className="space-y-4">
      {/* 页头（原型 PageHeader：标题 + 一句话口径）。 */}
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Transaction
        </div>
        <h1 className="text-xl font-semibold">Transaction Records</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Transactions this bank instance has recorded locally, with the
          status returned by Kissen.
        </p>
      </div>

      <section className="rounded-lg border border-border/60 bg-card">
        {/* §6.2 Table Panel 头条：实体名 + 结果数 + 刷新时间 + 页面级操作右置。 */}
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Transactions
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
              columns={TX_COLUMNS}
              isColumnVisible={columnPreferences.isColumnVisible}
              onColumnVisibilityChange={columnPreferences.setColumnVisible}
              onReset={columnPreferences.resetColumns}
            />
            {/* 源 page-head-actions 的导出按钮：v-perm 'bank:tx:export' 未命中不渲染。 */}
            {hasPerm(TX_EXPORT_PERM) && (
              <Button
                variant="outline"
                disabled={exporting}
                onClick={onExport}
              >
                {exporting && <Loader2 className="motion-safe:animate-spin" />}
                Export Excel
              </Button>
            )}
          </div>
        </div>

        {/* §6.2 Filter Bar（原型 Filters embedded：即时生效，无 Query 按钮）。
            GAP-GW-04：/tx/page filter 的 txNo/from/to/lp 匹配语义（精确或模糊）待与
            后端核对——占位文案不承诺「模糊」；completedOn 字段待核对（原型列集无该列）。 */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              name="txNo"
              label="Transaction No."
              register={register('txNo')}
            />
            <FormSelect
              name="pairId"
              control={control}
              label="Tokens"
              options={pairSelectOptions}
              placeholder="All Token Pairs"
            />
            <FormField
              name="senderAccount"
              label="From"
              register={register('senderAccount')}
            />
            <FormField
              name="receiverAccount"
              label="To"
              register={register('receiverAccount')}
            />
            <FormField
              name="lpName"
              label="LP Name"
              register={register('lpName')}
            />
            <FormSelect
              name="status"
              control={control}
              label="Status"
              options={statusSelectOptions}
              placeholder="All"
            />
            {/* 原型 DateRangeField：日粒度 Creation Date（from→T00:00 / to→T23:59，见 formToFilter）。 */}
            <FormField
              name="startTime"
              label="Created From"
              type="date"
              register={register('startTime')}
            />
            <FormField
              name="endTime"
              label="Created To"
              type="date"
              register={register('endTime')}
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
            emptyMessage="No transactions found. Try adjusting the filters."
          />
          <TxPager total={total} pageNum={pageNum} onPageChange={setPageNum} />
        </div>
      </section>
    </div>
  );
}

/**
 * 分页（源 el-pagination layout `total, prev, pager, next`，pageSize 固定 10 无
 * sizes/jumper。有意差异与 log-pages 同口径：省略页码 pager，仅 total + prev/next）。
 */
function TxPager({
  total,
  pageNum,
  onPageChange,
}: {
  total: number;
  pageNum: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / TX_PAGE_SIZE));

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
/* 详情页（源详情 Dialog 字段 + tabs：交易链路/报文留痕，同源 chain 接口）*/
/* ================================================================== */

/** 单条报文卡（源 el-timeline-item：时间戳 + 三标签 + TraceId/幂等键）。 */
function TxMessageItem({ message }: { message: TxMessage }) {
  return (
    <li className="relative pl-6">
      <span
        className="absolute left-0 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-background"
        style={{
          backgroundColor:
            message.direction === 2
              ? '#3B82F6'
              : '#0B6B53' /* 源：出向 primary / 入向 success */,
        }}
        aria-hidden="true"
      />
      <div className="text-xs text-muted-foreground">
        {formatTime(message.createTime)}
      </div>
      <div className="mt-2 rounded-md border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={txMsgTypeVariant(message.msgType)}>
            {txMsgTypeText(message.msgType)}
          </Badge>
          {/* 源 tag type：出向 warning / 入向 primary，语义分层后同为 secondary，以文案区分 */}
          <Badge variant="secondary">
            {txDirectionText(message.direction)}
          </Badge>
          <Badge variant={txProcessStatusVariant(message.processStatus)}>
            {txProcessStatusText(message.processStatus)}
          </Badge>
        </div>
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">TraceId</span>
            <CopyableEllipsisText
              value={message.traceId}
              emptyText="-"
              maxWidth={320}
              className="t-identifier"
            />
          </div>
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">
              Idempotency Key
            </span>
            <CopyableEllipsisText
              value={message.idempotentKey}
              emptyText="-"
              maxWidth={320}
              className="t-identifier"
            />
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * 单条链路节点（fe61223 对齐 admin 六段最终口径，纯时间轴）：标题 =
 * txFlowEventTitle（阶段业务动作名 / 通用事件回退状态文案）+ Operator 前缀标签；
 * 字段行 = stageFieldsOf（LP/金额/汇率/凭证，label+value 逐行）；remark 独立行。
 * 终态（35|40|60|80|90）实心，中间态空心。
 */
function TxFlowItem({
  node,
  record,
  pairMap,
}: {
  node: TxFlowNode;
  record: TxRecord | null | undefined;
  pairMap: ReadonlyMap<number, FxPairItem>;
}) {
  const color = flowNodeColor(node.statusTo);
  const terminal = isFlowTerminal(node.statusTo);
  const fields = stageFieldsOf(node, record, pairMap);
  return (
    <li className="relative pl-6">
      <span
        className={`absolute left-0 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-background ${
          terminal ? '' : 'bg-background'
        }`}
        style={terminal ? { backgroundColor: color } : { borderColor: color }}
        aria-hidden="true"
      />
      <div className="text-xs text-muted-foreground">
        {formatTime(node.eventTime)}
      </div>
      <div className="mt-2 rounded-md border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold">
            {txFlowEventTitle(node)}
          </span>
          {node.operator ? (
            <Badge variant="outline">Operator: {node.operator}</Badge>
          ) : null}
        </div>
        {fields.length > 0 && (
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {fields.map((f) => (
              <div key={f.label}>
                {f.label}{' '}
                <span className="font-mono break-all">{f.value}</span>
              </div>
            ))}
          </div>
        )}
        {node.remark ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {node.remark}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function TxDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transactionId = parseTxId(searchParams.get('id'));

  const {
    data: detailData,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErrorInfo,
    refetch: refetchDetail,
  } = useTxDetail(transactionId);

  /**
   * 源 HEAD：报文留痕与交易链路同源 GET /tx/chain（localMessages + kissenChain
   * 合并返回），原 GET /tx/messages 端点不再被页面消费。Kissen 不可达时
   * kissenChain 为 null（降级提示），localMessages 仍可用。
   */
  const {
    data: chainData,
    isLoading: chainLoading,
    isError: chainError,
    error: chainErrorInfo,
    refetch: refetchChain,
  } = useTxChain(transactionId);

  /** 源 openDetail：localMessages 按 createTime 升序。 */
  const messages = React.useMemo(
    () => sortMessages(chainData?.localMessages),
    [chainData],
  );
  /** 源 openDetail：kissenChain 树展平（d764217 起不重排，落库序直出）。 */
  const flowNodes = React.useMemo(
    () => flattenChain(chainData?.kissenChain),
    [chainData],
  );
  /** kissenChain=null → Kissen 不可达降级（源 el-empty 提示）。 */
  const chainDegraded = chainData != null && chainData.kissenChain == null;

  /**
   * fe61223 stageFields 的 token symbol 派生（源 pairOf 依赖的 pairViews 缓存）：
   * 详情为独立路由页，须自取 fxView（与 /fx、列表页同 query key，缓存命中免请求）。
   */
  const { data: fxViewData } = useFxViewQuery();
  const pairMap = React.useMemo(
    () => buildPairMap(fxViewData?.pairs),
    [fxViewData],
  );

  /**
   * 源 openDetail 语义：进入详情先用被点击的行立即渲染（链路起始为空），
   * detail 接口返回后覆盖；接口失败则停留行数据。直链无暂存时回退骨架屏。
   */
  const seed = React.useMemo(
    () => (transactionId != null ? readTxSeed(transactionId) : null),
    [transactionId],
  );
  const record = detailData ?? seed;
  const recordPair = pairViewOf(record?.pairId, pairMap)?.tokenPair;
  /* Settlement Overview 派生：源/目标 symbol、最新汇率快照（列表同源 pairMap）。 */
  const srcSymbol =
    recordPair?.sourceTokenSymbol || recordPair?.sourceTokenCode || null;
  const tgtSymbol =
    recordPair?.targetTokenSymbol || recordPair?.targetTokenCode || null;
  const rateValue = pairViewOf(record?.pairId, pairMap)?.rate?.userRate ?? null;

  const toast = useToast();
  React.useEffect(() => {
    if (detailError) {
      toast.error('Failed to load transaction detail', {
        description:
          detailErrorInfo instanceof Error
            ? detailErrorInfo.message
            : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetchDetail() },
      });
    }
  }, [detailError, detailErrorInfo, refetchDetail, toast]);
  React.useEffect(() => {
    if (chainError) {
      toast.error('Failed to load transaction trail', {
        description:
          chainErrorInfo instanceof Error
            ? chainErrorInfo.message
            : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetchChain() },
      });
    }
  }, [chainError, chainErrorInfo, refetchChain, toast]);

  if (!transactionId) {
    return (
      <div className="rounded-lg border border-border/60 bg-card panel-pad">
        <p className="text-sm text-muted-foreground">
          Missing a transaction ID. Unable to view details.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* §6.3 Hero Summary（原型 PageHeader）：返回 + 标题 + 状态徽章（带点）+
          待处理角标 + 元信息行（Transaction No. | Created on）。 */}
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Back to list"
          onClick={() => router.push('/tx')}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Transaction Details
            </h1>
            {record ? (
              <ProtoStatusBadge
                label={protoStatusText(PROTO_TX_STATUS, record.status)}
                tone={TX_STATUS_TONES[record.status ?? -1] ?? 'muted'}
              />
            ) : null}
            {record?.pendingFlag === 1 ? (
              <Badge
                variant="outline"
                className="border-amber-300 px-1.5 text-[10px] text-amber-700 dark:border-amber-700 dark:text-amber-400"
              >
                Pending
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-baseline gap-1.5">
              Transaction No.:
              <span className="font-medium text-foreground">
                <CopyableId
                  value={String(
                    record?.txNo ||
                      record?.txUuid ||
                      (transactionId != null ? transactionId : ''),
                  )}
                />
              </span>
            </span>
            <span aria-hidden="true">|</span>
            <span>
              Created on{' '}
              <span className="font-medium tabular-nums text-foreground">
                {formatUtc8(record?.createTime)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* 原型 3/5-2/5 双栏：左 = Settlement Overview + Transaction Information；
          右 = Transaction Log + Transaction Chain（源报文留痕/链路两卡，真实信息量
          大于原型，保留为超集——见 GAP-GW-08 说明）。 */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-6">
          {record ? (
            <>
              {/* ① Settlement Overview（原型 Card：Sent | rate/swap/LP | Received）。 */}
              <section className="rounded-lg border border-border/60 bg-card panel-pad">
                <h2 className="mb-4 text-sm font-semibold text-foreground">
                  Settlement Overview
                </h2>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                  {/* Sent（原型 subtle 块；ddd9fe2 扣款口径 userDeduction + 源币种）。 */}
                  <div className="min-w-0 flex-1 rounded-lg bg-muted/40 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Sent Amount
                    </div>
                    <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                      {record.userDeduction != null ? (
                        <>
                          {formatTokenAmount(record.userDeduction)}{' '}
                          {srcSymbol || '-'}
                        </>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {record.senderBankName || '-'}
                    </div>
                  </div>
                  {/* 中列：汇率盒（快照口径，未推送 '-'）+ ⇄ + LP 名。 */}
                  <div className="flex shrink-0 flex-col items-center justify-center gap-2 lg:w-48">
                    <div className="rounded-md border border-border/70 px-3 py-2 text-center font-mono text-xs text-foreground">
                      1 {srcSymbol || '-'} ={' '}
                      {rateValue != null ? formatRate(rateValue) : '-'}{' '}
                      {tgtSymbol || '-'}
                    </div>
                    <span
                      className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"
                      aria-hidden="true"
                    >
                      <ArrowLeftRight className="size-4" />
                    </span>
                    <div className="flex max-w-full items-center gap-1.5 text-xs text-foreground">
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {record.lpNames?.length
                          ? record.lpNames.join(', ')
                          : record.lpCode || '-'}
                      </span>
                    </div>
                  </div>
                  {/* Received（原型 emerald 块；a9dc10e receiverAmount 目标币种）。 */}
                  <div className="min-w-0 flex-1 rounded-lg bg-emerald-500/10 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Received Amount
                    </div>
                    <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {record.receiverAmount != null ? (
                        <>
                          + {formatTokenAmount(record.receiverAmount)}{' '}
                          {tgtSymbol || '-'}
                        </>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {record.receivingBankName || '-'}
                    </div>
                  </div>
                </div>
                <div className="mt-4 border-t border-border/50 pt-4">
                  <DescGrid>
                    <DescField label="LP Name">
                      <span>
                        {record.lpNames?.length
                          ? record.lpNames.join(', ')
                          : record.lpCode || '-'}
                      </span>
                    </DescField>
                    {/* STATIC-FILLER(GAP-GW-08): lpPool 双池地址对象缺失（待核对）——暂渲染 '-'。 */}
                    <DescField label="LP Source Pool Address">
                      <span>-</span>
                    </DescField>
                    <DescField label="LP Target Pool Address">
                      <span>-</span>
                    </DescField>
                  </DescGrid>
                </div>
              </section>

              {/* ② Transaction Information（原型 Card 字段逐字 + 真实字段超集 Bank Role）。 */}
              <section className="rounded-lg border border-border/60 bg-card panel-pad">
                <h2 className="mb-4 text-sm font-semibold text-foreground">
                  Transaction Information
                </h2>
                <DescGrid>
                  <DescField label="Source Tx ID">
                    <CopyableId value={record.sourceCsTxId} />
                  </DescField>
                  <DescField label="Target Tx ID">
                    <CopyableId value={record.targetCsTxId} />
                  </DescField>
                  <DescField label="Sender Bank">
                    <span>{orDash(record.senderBankName)}</span>
                  </DescField>
                  <DescField label="Receiver Bank">
                    <span>{orDash(record.receivingBankName)}</span>
                  </DescField>
                  <DescField label="Sender Wallet">
                    <CopyableId value={record.senderAccount} />
                  </DescField>
                  <DescField label="Receiver Wallet">
                    <CopyableId value={record.receiverAccount} />
                  </DescField>
                  <DescField label="Tx UUID">
                    <CopyableId value={record.txUuid} />
                  </DescField>
                  <DescField label="Last Sync">
                    <span className="tabular-nums">
                      {formatUtc8(record.lastSyncTime)}
                    </span>
                  </DescField>
                  {/* 真实字段超集（原型无、源有——保留）：本行角色；
                      GAP-GW-08：bankRole 语义归一待核对。 */}
                  <DescField label="Bank Role">
                    {record.selfTrade ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                      >
                        Self-Trade (Source + Target)
                      </Badge>
                    ) : record.bankRole != null && record.bankRole !== 0 ? (
                      <Badge variant={txBankRoleVariant(record.bankRole)}>
                        {txBankRoleText(record.bankRole)}
                      </Badge>
                    ) : (
                      <span>-</span>
                    )}
                  </DescField>
                  {record.pendingFlag === 1 ? (
                    <>
                      <DescField label="Pending">
                        <Badge variant="secondary">Pending</Badge>
                      </DescField>
                      <DescField label="Pending Reason" span>
                        <span className="break-words">
                          {orDash(record.pendingReason)}
                        </span>
                      </DescField>
                    </>
                  ) : null}
                </DescGrid>
              </section>
            </>
          ) : detailLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-card panel-pad text-sm text-muted-foreground">
              No transaction detail available.
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-6 xl:sticky xl:top-4">
          {/* ③ Transaction Log（报文留痕；源有/原型无——保留超集）。 */}
          <section className="rounded-lg border border-border/60 bg-card panel-pad">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                Transaction Log
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {messages.length} records
              </span>
            </div>
            {chainLoading && !chainData ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-md" />
                ))}
              </div>
            ) : messages.length > 0 ? (
              <ol className="relative space-y-6 border-l">
                {messages.map((m) => (
                  <TxMessageItem key={m.msgId} message={m} />
                ))}
              </ol>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No message records
              </p>
            )}
          </section>

          {/* ④ Transaction Chain（链路六段口径；源有/原型无——保留超集）。 */}
          <section className="rounded-lg border border-border/60 bg-card panel-pad">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                Transaction Chain
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {flowNodes.length} records
              </span>
            </div>
            {chainLoading && !chainData ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-md" />
                ))}
              </div>
            ) : flowNodes.length > 0 ? (
              <ol className="relative space-y-6 border-l">
                {flowNodes.map((n) => (
                  <TxFlowItem
                    key={n.flowId}
                    node={n}
                    record={record}
                    pairMap={pairMap}
                  />
                ))}
              </ol>
            ) : (
              /* 源 el-empty：链路空 = Kissen 暂不可用或无节点，指向上方报文留痕兜底。 */
              <p className="py-10 text-center text-sm text-muted-foreground">
                {chainDegraded
                  ? 'Kissen chain is unavailable right now. Check the Transaction Log above.'
                  : 'No chain records'}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
