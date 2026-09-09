'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

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
  TX_STATUS_OPTIONS,
  exportTx,
  txBankRoleText,
  txBankRoleVariant,
  txDirectionText,
  txFlowEventTitle,
  txMsgTypeText,
  txMsgTypeVariant,
  txProcessStatusText,
  txProcessStatusVariant,
  txStatusText,
  txStatusVariant,
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

/** RHF 筛选表单 → 后端 TxListReq（源 buildReq：a9dc10e 加 txNo/pairId/From/To/LP 五项；时间→毫秒）。 */
function formToFilter(form: TxFilterForm): TxListReq {
  return {
    txNo: nz(form.txNo),
    pairId: form.pairId === OPT_ALL ? undefined : Number(form.pairId),
    senderAccount: nz(form.senderAccount),
    receiverAccount: nz(form.receiverAccount),
    lpName: nz(form.lpName),
    status: form.status === OPT_ALL ? undefined : Number(form.status),
    startTime: toEpochMs(form.startTime),
    endTime: toEpochMs(form.endTime),
  };
}

/** 源分页 pageSize 固定 10（el-pagination layout 无 sizes/jumper）。 */
const TX_PAGE_SIZE = 10;

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
  const principal = withSym(record?.principal, src);
  const receiver = withSym(record?.receiverAmount, tgt);
  const rate =
    record?.userRate != null ? String(Number(record.userRate)) : undefined;
  if (step === 1) {
    if (lp) fields.push({ label: 'LP', value: lp });
    if (principal) fields.push({ label: 'Source Amount', value: principal });
    if (receiver) fields.push({ label: 'Target Amount', value: receiver });
    if (rate) fields.push({ label: 'Rate', value: rate });
  } else if (step === 3 || step === 4) {
    if (principal) fields.push({ label: 'Source Amount', value: principal });
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
  const { register, handleSubmit, reset, control } = useForm<TxFilterForm>({
    resolver: zodResolver(txFilterSchema),
    defaultValues: TX_FILTER_DEFAULT,
  });

  const [filter, setFilter] = React.useState<TxListReq>(() =>
    formToFilter(TX_FILTER_DEFAULT),
  );
  const [pageNum, setPageNum] = React.useState(1);
  const [exporting, setExporting] = React.useState(false);

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

  const onSubmit = React.useCallback((form: TxFilterForm) => {
    setFilter(formToFilter(form));
    setPageNum(1);
  }, []);

  const onReset = React.useCallback(() => {
    reset(TX_FILTER_DEFAULT);
    setFilter(formToFilter(TX_FILTER_DEFAULT));
    setPageNum(1);
  }, [reset]);

  /**
   * 导出 Excel（源 onExport，eafcab0 起 CSV→xlsx）：POST /tx/export blob 直通，
   * 按当前筛选条件全量导出（列表与导出共用同一 filter 口径，即源 buildReq），
   * 文件名 `tx-export-{Date.now()}.xlsx`。
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

  const statusSelectOptions = React.useMemo(
    () => [{ value: OPT_ALL, label: 'All Statuses' }, ...TX_STATUS_OPTIONS],
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


  /**
   * 列序对齐 UDPN 评审建议（39c8a2b）：Transaction No. / tokens / From / To /
   * FX Rate / LP / Status / Creation On / Action；源端·目标端交易ID 与本行角色/
   * 银行/本金/待处理单列移入详情页（详情 Descriptions 已覆盖）。
   */
  const columns = React.useMemo<ColumnDef<TxRecord & { id: string }>[]>(() => {
    return [
      {
        id: 'txNo',
        header: 'Transaction No.',
        cell: ({ row }) => (
          <div className="inline-flex min-w-0 items-center font-mono">
            <CopyableEllipsisText
              value={
                row.original.txNo ||
                row.original.txUuid ||
                row.original.transactionId
              }
              maxWidth={180}
              truncate="middle"
              emptyText="-"
              className="font-mono"
            />
            {/* 源 f5009b3：selfTrade 追加「自转」warning plain 小 tag + tooltip（Badge 不转发 ref，asChild 需原生 span）。 */}
            {row.original.selfTrade && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-1 inline-flex cursor-default align-middle">
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
              {/* 57f6ca0：pairCode 等宽小字随全站 pairCode 展示移除。 */}
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
        header: 'From (Wallet / Amount)',
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const pair = pairViewOf(row.original.pairId, pairMap)?.tokenPair;
          return (
            <div>
              {/* 钱包地址为主（中间省略+可复制，§7-43②），存量/缺地址回退银行名。 */}
              {row.original.senderAccount ? (
                <CopyableEllipsisText
                  value={row.original.senderAccount}
                  maxWidth={240}
                  truncate="middle"
                  emptyText="-"
                  className="font-mono"
                />
              ) : (
                <span>{row.original.senderBankName || '-'}</span>
              )}
              {/* 下行金额：本金 + 源侧符号（源 srcSymbol，缺缓存 '-'）。 */}
              <div className="mt-0.5 text-xs tabular-nums">
                {fmtAmount(row.original.principal)}{' '}
                {pair?.sourceTokenSymbol || pair?.sourceTokenCode || '-'}
              </div>
            </div>
          );
        },
      },
      {
        id: 'to',
        header: 'To (Wallet / Amount)',
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const pair = pairViewOf(row.original.pairId, pairMap)?.tokenPair;
          return (
            <div>
              {row.original.receiverAccount ? (
                <CopyableEllipsisText
                  value={row.original.receiverAccount}
                  maxWidth={240}
                  truncate="middle"
                  emptyText="-"
                  className="font-mono"
                />
              ) : (
                <span>{row.original.receivingBankName || '-'}</span>
              )}
              {/* a9dc10e：到账金额不再恒 '-'——receiverAmount!=null（目标端 G-5 落账）
                  显 `金额 + 目标币种`，未同步保持 muted '-'。 */}
              <div className="mt-0.5 text-xs tabular-nums">
                {row.original.receiverAmount != null ? (
                  <>
                    {fmtAmount(row.original.receiverAmount)}{' '}
                    {pair?.targetTokenSymbol || pair?.targetTokenCode || '-'}
                  </>
                ) : (
                  <span className="text-muted-foreground/60">-</span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: 'fxRate',
        header: 'FX Rate',
        cell: ({ row }) => {
          /* 快照口径非成交时点（源 pairRateOf）：未推送/未知 '-'。 */
          const rate = pairViewOf(row.original.pairId, pairMap)?.rate;
          return (
            <span className="block text-right tabular-nums">
              {rate?.userRate == null
                ? '-'
                : Number(rate.userRate).toFixed(4)}
            </span>
          );
        },
      },
      {
        id: 'lp',
        header: 'LP',
        cell: ({ row }) =>
          row.original.lpNames?.length ? (
            <span className="flex flex-wrap gap-1.5">
              {row.original.lpNames.map((name) => (
                <Badge key={name} variant="secondary">
                  {name}
                </Badge>
              ))}
            </span>
          ) : (
            <span>-</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1">
            <Badge variant={txStatusVariant(row.original.status)}>
              {txStatusText(row.original.status)}
            </Badge>
            {/* 待处理不再单列，收进状态旁小号 warning 角标（Badge 不转发 ref，asChild 需原生 span）。 */}
            {row.original.pendingFlag === 1 && (
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
            )}
          </span>
        ),
      },
      {
        id: 'createTime',
        header: 'Creation On',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.createTime)}
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
            onClick={() => onView(row.original)}
          >
            View
          </Button>
        ),
      },
    ];
  }, [onView, pairMap]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.recordId) })),
    [rows],
  );

  return (
    <div className="space-y-4">

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
                Updated {formatTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          {/* 源 page-head-actions 的导出按钮：v-perm 'bank:tx:export' 未命中不渲染。 */}
          {hasPerm(TX_EXPORT_PERM) && (
            <Button variant="outline" disabled={exporting} onClick={onExport}>
              {exporting && <Loader2 className="motion-safe:animate-spin" />}
              Export Excel
            </Button>
          )}
        </div>

        {/* §6.2 Filter Bar：3–4 列栅格；Search 主动作、Reset 次动作。 */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* a9dc10e：筛选扩容（源 7 控件；文本输入回车即提交 form）。 */}
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
              label="LP"
              register={register('lpName')}
            />
            <FormSelect
              name="status"
              control={control}
              label="Status"
              options={statusSelectOptions}
              placeholder="All Statuses"
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
            <Button type="submit">Search</Button>
            <Button type="button" variant="outline" onClick={onReset}>
              Reset
            </Button>
          </div>
        </form>

        <div className="p-4">
          <DataTable
            columns={columns}
            data={tableData}
            isLoading={isLoading}
            emptyMessage="No transactions found"
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
      {/* §6.3 Hero Summary：a9dc10e 标识 txNo 优先（回退 txUuid/#id，中间省略可复制）
          + 状态 + 待处理角标；「返回列表」显式回 /tx（源 router.push('/tx/list')）。 */}
      <section className="rounded-lg border border-border/60 bg-card panel-pad">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Transaction Detail
            </h1>
            <CopyableEllipsisText
              value={
                record?.txNo ||
                record?.txUuid ||
                (transactionId != null ? `#${transactionId}` : null)
              }
              emptyText="-"
              truncate="middle"
              className="t-identifier text-foreground"
            />
            {record ? (
              <Badge variant={txStatusVariant(record.status)}>
                {txStatusText(record.status)}
              </Badge>
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
          <Button variant="outline" size="sm" onClick={() => router.push('/tx')}>
            Back to List
          </Button>
        </div>
      </section>

      {/* a9dc10e 布局：左主栏 = 基本信息 + 报文留痕；右侧栏 = 交易链路（源 detail-layout 交换）。 */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {record ? (
            <section className="rounded-lg border border-border/60 bg-card panel-pad">
              {/* §6.3 分层：核心信息 — 账户与路由 — 审计信息；长文本（账户/UUID/原因）占行。
                  a9dc10e 字段对齐：Tokens 双 tag / 到账金额 / 付款·收款银行 / LP tags / 交易 UUID
                  （Record ID/Pair ID 上游详情无，随批移除）。 */}
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="mb-2.5 text-sm font-semibold text-foreground">
                    Overview
                  </h2>
                  <DescGrid>
                    <DescField label="Bank Role">
                      {record.selfTrade ? (
                        /* 源 f5009b3：selfTrade 优先于 bankRole（单条模型 G-4 补账覆盖 bankRole）。 */
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
                    {/* token 对双 tag（源 span=2 双 tag；缺缓存回退 #pairId）。 */}
                    <DescField label="Tokens">
                      {recordPair ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="flex flex-col items-center gap-0.5">
                            <Badge variant="outline">
                              {recordPair.sourceTokenSymbol ||
                                recordPair.sourceTokenCode ||
                                '-'}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {recordPair.sourceBankCode || '-'}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            →
                          </span>
                          <span className="flex flex-col items-center gap-0.5">
                            <Badge
                              variant="outline"
                              className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                            >
                              {recordPair.targetTokenSymbol ||
                                recordPair.targetTokenCode ||
                                '-'}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {recordPair.targetBankCode || '-'}
                            </span>
                          </span>
                        </span>
                      ) : (
                        <span className="font-mono">
                          #{record.pairId ?? '-'}
                        </span>
                      )}
                    </DescField>
                    <DescField label="Principal">
                      <span className="t-data">
                        {fmtAmount(record.principal)}{' '}
                        {recordPair?.sourceTokenSymbol ||
                          recordPair?.sourceTokenCode ||
                          '-'}
                      </span>
                    </DescField>
                    {/* a9dc10e：到账金额（目标端 G-5 落账，未同步 '-'）。 */}
                    <DescField label="Receiver Amount">
                      <span className="t-data">
                        {fmtAmount(record.receiverAmount)}{' '}
                        {recordPair?.targetTokenSymbol ||
                          recordPair?.targetTokenCode ||
                          '-'}
                      </span>
                    </DescField>
                    <DescField label="LP" span>
                      {record.lpNames?.length ? (
                        <span className="flex flex-wrap gap-1.5">
                          {record.lpNames.map((name) => (
                            <Badge key={name} variant="secondary">
                              {name}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </DescField>
                  </DescGrid>
                </div>
                <div>
                  <h2 className="mb-2.5 text-sm font-semibold text-foreground">
                    Accounts &amp; Routing
                  </h2>
                  <DescGrid>
                    <DescField label="Sender Bank">
                      <span>{orDash(record.senderBankName)}</span>
                    </DescField>
                    <DescField label="Receiving Bank">
                      <span>{orDash(record.receivingBankName)}</span>
                    </DescField>
                    <DescField label="Source Tx ID">
                      <CopyableEllipsisText
                        value={record.sourceCsTxId}
                        emptyText="-"
                        maxWidth={240}
                        truncate="middle"
                        className="t-identifier"
                      />
                    </DescField>
                    <DescField label="Target Tx ID">
                      <CopyableEllipsisText
                        value={record.targetCsTxId}
                        emptyText="-"
                        maxWidth={240}
                        truncate="middle"
                        className="t-identifier"
                      />
                    </DescField>
                    {/* 39c8a2b 付款/收款账户 + a9dc10e 交易 UUID（长文本占行，中间省略可复制）。 */}
                    <DescField label="Sender Account" span>
                      <CopyableEllipsisText
                        value={record.senderAccount}
                        emptyText="-"
                        maxWidth={480}
                        truncate="middle"
                        className="t-identifier"
                      />
                    </DescField>
                    <DescField label="Receiver Account" span>
                      <CopyableEllipsisText
                        value={record.receiverAccount}
                        emptyText="-"
                        maxWidth={480}
                        truncate="middle"
                        className="t-identifier"
                      />
                    </DescField>
                    <DescField label="Tx UUID" span>
                      <CopyableEllipsisText
                        value={record.txUuid}
                        emptyText="-"
                        maxWidth={480}
                        truncate="middle"
                        className="t-identifier"
                      />
                    </DescField>
                    <DescField label="Pending">
                      {record.pendingFlag === 1 ? (
                        <Badge variant="secondary">Pending</Badge>
                      ) : (
                        <span>No</span>
                      )}
                    </DescField>
                    <DescField label="Pending Reason" span>
                      <span className="break-words">
                        {orDash(record.pendingReason)}
                      </span>
                    </DescField>
                  </DescGrid>
                </div>
                <div>
                  <h2 className="mb-2.5 text-sm font-semibold text-foreground">
                    Audit
                  </h2>
                  <DescGrid cols={2}>
                    <DescField label="Created At">
                      <span className="font-mono">
                        {formatTime(record.createTime)}
                      </span>
                    </DescField>
                    <DescField label="Last Sync">
                      <span className="font-mono">
                        {formatTime(record.lastSyncTime)}
                      </span>
                    </DescField>
                  </DescGrid>
                </div>
              </div>
            </section>
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

          {/* a9dc10e：报文留痕移主栏（原右侧 Transaction Log）。 */}
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
        </div>

        {/* a9dc10e：交易链路移右侧栏（源 detail-side；单页签 Tabs 包装随交换移除）。 */}
        <aside className="rounded-lg border border-border/60 bg-card panel-pad xl:sticky xl:top-4 xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
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
            /* 源 el-empty：链路空 = Kissen 暂不可用或无节点，指向左侧报文留痕兜底。 */
            <p className="py-10 text-center text-sm text-muted-foreground">
              {chainDegraded
                ? 'Kissen chain is unavailable right now. Check the Transaction Log on the left.'
                : 'No chain records'}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
