'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
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
import { PageHead } from './page-head';
import { useGatewayPerm } from './use-gateway-perm';

/**
 * 交易记录域页面（源 `views/tx/list.vue`：列表筛选/分页/CSV 导出 + 详情字段 +
 * tabs「交易链路/报文留痕」，两页签同源 chain 接口）。
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

/** 终态判定（源 isTerminal）：40 完成 / 60 冲正 / 80 取消 / 90 失败 → 实心。 */
function isFlowTerminal(statusTo?: number): boolean {
  return (
    statusTo === 40 || statusTo === 60 || statusTo === 80 || statusTo === 90
  );
}

/** kissenChain 树展平 + eventTime 升序（源 openDetail 的 walk + sort）。 */
function flattenChain(nodes: TxFlowNode[] | null | undefined): TxFlowNode[] {
  const flat: TxFlowNode[] = [];
  const walk = (list?: TxFlowNode[] | null): void => {
    (list ?? []).forEach((n) => {
      flat.push(n);
      walk(n.children);
    });
  };
  walk(nodes);
  return flat.sort((a, b) => (a.eventTime ?? 0) - (b.eventTime ?? 0));
}

/** 本地报文按 createTime 升序（源 openDetail 的 messages sort）。 */
function sortMessages(messages: TxMessage[] | null | undefined): TxMessage[] {
  return [...(messages ?? [])].sort(
    (a, b) => (a.createTime ?? 0) - (b.createTime ?? 0),
  );
}

/* ================================================================== */
/* 列表页（源筛选：状态 + 仅看待处理 + 时间范围）                       */
/* ================================================================== */

const txFilterSchema = z.object({
  status: z.string(),
  pendingOnly: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
});
type TxFilterForm = z.infer<typeof txFilterSchema>;

const TX_FILTER_DEFAULT: TxFilterForm = {
  status: OPT_ALL,
  pendingOnly: false,
  startTime: '',
  endTime: '',
};

/** RHF 筛选表单 → 后端 TxListReq（源 load() 的 query 组装：pendingOnly→pendingFlag=1、时间→毫秒）。 */
function formToFilter(form: TxFilterForm): TxListReq {
  return {
    status: form.status === OPT_ALL ? undefined : Number(form.status),
    pendingFlag: form.pendingOnly ? 1 : undefined,
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
  const pairMap = React.useMemo(() => {
    const map = new Map<number, FxPairItem>();
    for (const item of fxViewData?.pairs ?? []) {
      map.set(item.tokenPair.pairId, item);
    }
    return map;
  }, [fxViewData]);

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
   * 导出 CSV（源 onExport）：POST /tx/export blob 直通，按当前筛选条件全量导出
   * （列表与导出共用同一 filter 口径，即源 buildReq），文件名 `tx-export-{Date.now()}.csv`。
   */
  const onExport = React.useCallback(async () => {
    setExporting(true);
    try {
      const resp = await exportTx(filter);
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tx-export-${Date.now()}.csv`;
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

  /**
   * 列序对齐 UDPN 评审建议（39c8a2b）：Transaction No. / tokens / From / To /
   * FX Rate / LP / Status / Last Sync / Action；源端·目标端交易ID 与本行角色/
   * 银行/本金/待处理单列移入详情页（详情 Descriptions 已覆盖）。
   */
  const columns = React.useMemo<ColumnDef<TxRecord & { id: string }>[]>(() => {
    return [
      {
        id: 'txNo',
        header: 'Transaction No.',
        cell: ({ row }) => (
          <span className="font-mono">
            {row.original.txNo || row.original.txUuid || row.original.transactionId}
          </span>
        ),
      },
      {
        id: 'tokens',
        header: 'tokens',
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
              {/* pairCode 小字（行内值优先，回退缓存 token 对编码）。 */}
              <div className="mt-0.5 break-all font-mono text-[11px] tracking-wide text-muted-foreground">
                {row.original.pairCode || pair.pairCode || '-'}
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
          return (
            <div>
              {/* 钱包地址为主（title 悬浮全量），存量/缺地址回退银行名。 */}
              <div
                className="max-w-[15rem] truncate"
                title={row.original.senderAccount || undefined}
              >
                {row.original.senderAccount ||
                  row.original.senderBankName ||
                  '-'}
              </div>
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
        header: 'To',
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <div>
            <div
              className="max-w-[15rem] truncate"
              title={row.original.receiverAccount || undefined}
            >
              {row.original.receiverAccount ||
                row.original.receivingBankName ||
                '-'}
            </div>
            {/* 解付金额本地不落库（网关无交易状态机），以 Kissen 详情为准。 */}
            <div className="mt-0.5 text-xs text-muted-foreground/60">-</div>
          </div>
        ),
      },
      {
        id: 'fxRate',
        header: 'FX Rate',
        cell: ({ row }) => {
          /* 快照口径非成交时点（源 pairRateOf）：未推送/未知 '-'。 */
          const rate = pairViewOf(row.original.pairId, pairMap)?.rate;
          return (
            <span className="block text-right tabular-nums">
              {rate?.userRate != null ? String(rate.userRate) : '-'}
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
        id: 'lastSyncTime',
        header: 'Last Sync',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.lastSyncTime)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => onView(row.original)}
          >
            Detail
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
      <PageHead eyebrow="TRANSACTIONS" title="Transactions" />

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
              Export CSV
            </Button>
          )}
        </div>

        {/* §6.2 Filter Bar：3–4 列栅格；Search 主动作、Reset 次动作。 */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormSelect
              name="status"
              control={control}
              label="Status"
              options={statusSelectOptions}
              placeholder="All Statuses"
            />
            <Controller
              control={control}
              name="pendingOnly"
              render={({ field }) => (
                <div>
                  <label
                    htmlFor="field-pendingOnly"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Pending
                  </label>
                  <div className="flex h-10 items-center gap-2">
                    <Checkbox
                      id="field-pendingOnly"
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                    />
                    <span className="text-sm text-foreground">Pending only</span>
                  </div>
                </div>
              )}
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
            <span className="break-all">{orDash(message.traceId)}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">
              Idempotency Key
            </span>
            <span className="break-all">{orDash(message.idempotentKey)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * 单条链路节点（源 chain tab 的 el-timeline-item）：状态迁移 `from → to` +
 * operator 标签 + remark/csTxId 元信息；终态（40|60|80|90）实心，中间态空心。
 */
function TxFlowItem({ node }: { node: TxFlowNode }) {
  const color = flowNodeColor(node.statusTo);
  const terminal = isFlowTerminal(node.statusTo);
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
            {txStatusText(node.statusFrom)} → {txStatusText(node.statusTo)}
          </span>
          {node.operator ? (
            <Badge variant="outline">{node.operator}</Badge>
          ) : null}
        </div>
        {(node.remark || node.csTxId) && (
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {node.remark ? <span>{node.remark}</span> : null}
            {node.csTxId ? (
              <span className="font-mono">csTxId: {node.csTxId}</span>
            ) : null}
          </div>
        )}
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
  /** 源 openDetail：kissenChain 树展平后按 eventTime 升序。 */
  const flowNodes = React.useMemo(
    () => flattenChain(chainData?.kissenChain),
    [chainData],
  );
  /** kissenChain=null → Kissen 不可达降级（源 el-empty 提示）。 */
  const chainDegraded = chainData != null && chainData.kissenChain == null;

  /**
   * 源 openDetail 语义：进入详情先用被点击的行立即渲染（链路起始为空），
   * detail 接口返回后覆盖；接口失败则停留行数据。直链无暂存时回退骨架屏。
   */
  const seed = React.useMemo(
    () => (transactionId != null ? readTxSeed(transactionId) : null),
    [transactionId],
  );
  const record = detailData ?? seed;

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
      <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
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
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">
          Transaction Detail #{transactionId}
        </h1>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      {record ? (
        <section className="rounded-lg border-border/60 bg-card p-6 shadow-float">
          <DescGrid>
            <DescField label="Record ID">
              <span>{record.recordId ?? '-'}</span>
            </DescField>
            <DescField label="TransactionId">
              <span>{record.transactionId ?? '-'}</span>
            </DescField>
            <DescField label="Bank Role">
              {record.bankRole != null && record.bankRole !== 0 ? (
                <Badge variant={txBankRoleVariant(record.bankRole)}>
                  {txBankRoleText(record.bankRole)}
                </Badge>
              ) : (
                <span>-</span>
              )}
            </DescField>
            <DescField label="PairId">
              <span>{record.pairId ?? '-'}</span>
            </DescField>
            <DescField label="Principal">
              <span>{fmtAmount(record.principal)}</span>
            </DescField>
            <DescField label="Status">
              <Badge variant={txStatusVariant(record.status)}>
                {txStatusText(record.status)}
              </Badge>
            </DescField>
            <DescField label="Source Tx ID">
              <span>{orDash(record.sourceCsTxId)}</span>
            </DescField>
            <DescField label="Target Tx ID">
              <span>{orDash(record.targetCsTxId)}</span>
            </DescField>
            {/* 39c8a2b 新增：付款/收款账户（钱包地址，num 样式；空 '-'）。 */}
            <DescField label="Sender Account">
              <span className="break-all font-mono">
                {orDash(record.senderAccount)}
              </span>
            </DescField>
            <DescField label="Receiver Account">
              <span className="break-all font-mono">
                {orDash(record.receiverAccount)}
              </span>
            </DescField>
            <DescField label="Pending">
              {record.pendingFlag === 1 ? (
                <Badge variant="secondary">Pending</Badge>
              ) : (
                <span>No</span>
              )}
            </DescField>
            <DescField label="Pending Reason">
              <span>{orDash(record.pendingReason)}</span>
            </DescField>
            <DescField label="Last Sync">
              <span>{formatTime(record.lastSyncTime)}</span>
            </DescField>
            <DescField label="Created At">
              <span>{formatTime(record.createTime)}</span>
            </DescField>
          </DescGrid>
        </section>
      ) : detailLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : (
        <div className="rounded-lg border-border/60 bg-card p-6 text-sm text-muted-foreground shadow-float">
          No transaction detail available.
        </div>
      )}

      {/* 源 el-tabs（默认页签 chain 交易链路；报文留痕页签带条数后缀）。 */}
      <section className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <Tabs defaultValue="chain">
          <TabsList>
            <TabsTrigger value="chain">Transaction Chain</TabsTrigger>
            <TabsTrigger value="messages">
              Message Trail ({messages.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chain" className="mt-4">
            {chainLoading && !chainData ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-md" />
                ))}
              </div>
            ) : flowNodes.length > 0 ? (
              <ol className="relative space-y-6 border-l">
                {flowNodes.map((n) => (
                  <TxFlowItem key={n.flowId} node={n} />
                ))}
              </ol>
            ) : (
              /* 源 el-empty：链路空 = Kissen 暂不可用或无节点，指向报文页签兜底。 */
              <p className="py-10 text-center text-sm text-muted-foreground">
                {chainDegraded
                  ? 'Kissen chain is unavailable right now. Check the Message Trail tab instead.'
                  : 'No chain records'}
              </p>
            )}
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
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
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
