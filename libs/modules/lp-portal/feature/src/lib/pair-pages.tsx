'use client';

/**
 * Token Pair 管理页（原型对齐改造，方案 12 §6 L124；原型源
 * `TokenPairPage.jsx`——原型为行为规格，分区/列/筛选/文案/格式化照原型，
 * UI 用本仓 @myorg/shared/ui 体系重实现）。
 *
 * 页面结构（原型 2026-09-22 拍板，照 FX Transactions 样式）：
 * 页头（标题 = 菜单名 Token Pair Management）→ 筛选独立卡（Pair Code /
 * Status，GAP-LP-06 本地过滤）→ 列表卡（Token Pairs + count + Updated +
 * SyncRefreshButton domain=['pair','rate']）。旧单页签「My Token Pairs」
 * 包装删除（原型无页签）。
 *
 * 10 列（原型列序）：Pair Code（CopyableId）/ Token Pair（上行 `SRC → TGT`
 * 币对（§3.14.3 一律 → 不用 /），下行发行行）/ Base Rate / Markup /
 * Client Rate（配置侧固定词，'User Rate' 废弃）/ Standard Share / My Share
 * （status===5 保留 `?` 覆盖提示 tooltip）/ Readiness（Pool ready /
 * Pre-authorization not set 徽章 + Recv/Pay 地址，替代旧 Activation 列，
 * 全状态渲染——就绪为 null → '-'）/ Status（15 驳回保留原因 tooltip）/
 * As of (UTC+8)。
 *
 * 汇率/比率右对齐 tabular-nums（单元格不用等宽字体，§3.2.4）；时间列头标
 * (UTC+8)，值 formatUtc8（UTC+8 字面量，不随浏览器时区）。
 */

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  DataTable,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';

import {
  LP_PROJECT_ID,
  pairKeys,
  usePairListQuery,
  useTokenMeta,
  type PairRow,
} from '@myorg/modules/lp-portal/data-access';

import { SyncRefreshButton } from './sync-refresh-button';
import {
  LP_PAIR_READINESS_MAP,
  LP_PAIR_STATUS_MAP,
  lpPairReadinessKey,
} from './proto-enums';
import { formatRate, formatUtc8 } from './proto-format';
import { CopyableId, ProtoStatusBadge, type ProtoTone } from './proto-ui';

/* ================================================================== */
/* 文案与渲染辅助                                                        */
/* ================================================================== */

const LBL = {
  eyebrow: 'MARKET',
  title: 'Token Pair Management',
  entity: 'Token Pairs',
  countUnit: 'pairs',
  status5Hint:
    'The admin side may override the split ratio upon approval; this is the current reference value.',
  rejectReasonPrefix: 'Rejection reason: ',
  emptyMine:
    'No token pairs yet — token pairs become available once Kissen approves your participation',
} as const;

/**
 * 参与状态 → 徽章语义色（LP_PAIR_STATUS_MAP 文案：20 Active / 50
 * Inactive——'Disabled' 废除，§7.1；未知码显原值 + muted 兜底）。
 */
const PAIR_STATUS_TONE: Record<number, ProtoTone> = {
  5: 'warning',
  15: 'danger',
  20: 'success',
  50: 'muted',
};

/**
 * STATIC-FILLER(GAP-LP-06): 原型字段/行为缺口，三项处置：
 * (a) pair 行无 sourceBankName/targetBankName——Token Pair 次行发行行经
 *     useTokenMeta.bankOf（token 元数据 bankName→bankBic→标识回落）派生，
 *     为真实数据而非静态占位；
 * (b) 原型筛选为服务端参数（pairCode LIKE NOCASE 子串 / status 精确），
 *     本仓 /pair/list 无查询入参——前端本地过滤等价实现（Pair Code 子串
 *     不区分大小写 / Status 精确）+ 缺省排序 As of（syncTime）倒序；
 * (c) 原型 Status 筛选含 'Available'（eligible 可申请行专属态），本仓
 *     my-pairs 码表无对应码（proto-enums 不映射），选项仅 Active/Inactive。
 * 后端筛选参数 / 行内银行名字段就绪后回写。
 */
const PAIR_STATUS_OPTIONS = [
  { value: '20', label: 'Active' },
  { value: '50', label: 'Inactive' },
] as const;

/**
 * 比例字符串（十进制比值）→ 百分比展示："0.03" → "3.00%"（原型
 * toPercent：×100 固定 2 位小数加 %；lp-fields §2.4）。
 */
function percentText(v: string | number | null | undefined): string {
  return v == null || v === ''
    ? '-'
    : `${(Number(v) * 100).toFixed(2)}%`;
}

/** 右对齐数值列表头（表头/单元格同侧右对齐 §3.18）。 */
function NumHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-right">{children}</div>;
}

/** 右对齐数值单元格（配 NumHeader；tabular-nums，不用等宽字体 §3.2.4）。 */
function NumCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end whitespace-nowrap tabular-nums">
      {children}
    </div>
  );
}

/**
 * 币对紧凑两行式（原型 TokenPairCell）：上行 `symOf(src) → symOf(tgt)`
 * 加粗（§3.14.3 币对一律 →，不用 /），下行 `bankOf(src) → bankOf(tgt)`
 * 次要色（GAP-LP-06(a)：银行名经 token 元数据派生）。
 */
function Pairx({ tokens, banks }: { tokens: string; banks: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
        {tokens}
      </span>
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {banks}
      </span>
    </div>
  );
}

/**
 * Readiness 单元格（原型 ReadinessCell，替代旧 Activation 列）：行 booleans
 * → 语义键（lpPairReadinessKey：双侧池未就绪 → null 显 '-'）；徽章
 * 'Pool ready'（success）/ 'Pre-authorization not set'（warning）为类型
 * 徽章不带状态点；下方 Recv（源侧收款）/ Pay（目标侧出款）地址行，
 * 全状态渲染（旧版仅 status===20 渲染）。
 */
function ReadinessCell({ row }: { row: Omit<PairRow, 'id'> }) {
  const readinessKey = lpPairReadinessKey(row.poolReady, row.preauthOk);
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      {readinessKey == null ? (
        <span className="text-muted-foreground">-</span>
      ) : (
        <Badge
          variant={readinessKey === 'poolReady' ? 'success' : 'warning'}
          className="font-normal"
        >
          {LP_PAIR_READINESS_MAP[readinessKey].label}
        </Badge>
      )}
      {row.sourcePoolAddress ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <Badge variant="mute" size="sm" className="font-normal">
            Recv
          </Badge>
          <CopyableId
            value={row.sourcePoolAddress}
            className="text-xs text-muted-foreground"
          />
        </span>
      ) : null}
      {row.targetPoolAddress ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <Badge variant="mute" size="sm" className="font-normal">
            Pay
          </Badge>
          <CopyableId
            value={row.targetPoolAddress}
            className="text-xs text-muted-foreground"
          />
        </span>
      ) : null}
    </div>
  );
}

/* ================================================================== */
/* 页面装配                                                              */
/* ================================================================== */

/**
 * DataTable 行标识 id:string 与模型记录 ID:number 撞名，id 转字符串满足
 * TanStack 泛型约束（模型记录 ID 不再单独承载展示）。
 */
type PairTableRow = Omit<PairRow, 'id'> & { id: string };

export function PairListPage() {
  const queryClient = useQueryClient();
  const query = usePairListQuery(LP_PROJECT_ID);
  const { symOf, bankOf } = useTokenMeta(LP_PROJECT_ID);

  // GAP-LP-06(b)：本地筛选状态（原型 filters 受控输入同构；本地即时过滤）
  const [filters, setFilters] = React.useState({
    pairCode: '',
    status: '',
  });
  const hasFilter = filters.pairCode !== '' || filters.status !== '';
  const handleReset = () => setFilters({ pairCode: '', status: '' });

  // GAP-LP-06(b)：本地过滤（Pair Code 子串不区分大小写 / Status 精确）+
  // 缺省排序 As of（syncTime）倒序
  const tableData = React.useMemo<PairTableRow[]>(() => {
    const pairCode = filters.pairCode.trim().toLowerCase();
    return (query.data ?? [])
      .filter(
        (r) =>
          (!pairCode || r.pairCode.toLowerCase().includes(pairCode)) &&
          (!filters.status || String(r.status) === filters.status),
      )
      .slice()
      .sort((a, b) => b.syncTime - a.syncTime)
      .map((r) => ({ ...r, id: String(r.id) }));
  }, [query.data, filters]);

  const columns = React.useMemo<ColumnDef<PairTableRow>[]>(
    () => [
      // 原型列序 1：Pair Code（36 位不透明 ID，CopyableId 中段截断；
      // 无码行回落 pairId 原值）
      {
        accessorKey: 'pairCode',
        header: 'Pair Code',
        meta: { overflow: 'ellipsis' },
        cell: ({ row }) => (
          <CopyableId
            value={row.original.pairCode || String(row.original.pairId)}
            maxWidth={160}
          />
        ),
      },
      // 原型列序 2：Token Pair（上行 SRC → TGT，下行发行行 GAP-LP-06(a)）
      {
        id: 'pairx',
        header: 'Token Pair',
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <Pairx
              tokens={`${symOf(r.sourceTokenCode)} → ${symOf(r.targetTokenCode)}`}
              banks={`${bankOf(r.sourceTokenCode)} → ${bankOf(r.targetTokenCode)}`}
            />
          );
        },
      },
      // 原型列序 3：Base Rate（= 行 VO baseRate，比值原值不加 %）
      {
        accessorKey: 'baseRate',
        header: () => <NumHeader>Base Rate</NumHeader>,
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <NumCell>{formatRate(row.original.baseRate)}</NumCell>
        ),
      },
      // 原型列序 4：Markup（0〜1 比率 ×100 显 2 位小数 %）
      {
        accessorKey: 'markupRate',
        header: () => <NumHeader>Markup</NumHeader>,
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <NumCell>{percentText(row.original.markupRate)}</NumCell>
        ),
      },
      // 原型列序 5：Client Rate（配置侧固定词，'User Rate' 废弃；
      // = 行 VO userRate = base + markup）
      {
        accessorKey: 'userRate',
        header: () => <NumHeader>Client Rate</NumHeader>,
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <NumCell>{formatRate(row.original.userRate)}</NumCell>
        ),
      },
      // 原型列序 6：Standard Share（对默认分成比例；列序在 My Share 前）
      {
        accessorKey: 'defaultSplitRatio',
        header: () => <NumHeader>Standard Share</NumHeader>,
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <NumCell>{percentText(row.original.defaultSplitRatio)}</NumCell>
        ),
      },
      // 原型列序 7：My Share（status===5 保留 `?` 覆盖提示 tooltip）
      {
        accessorKey: 'mySplitRatio',
        header: () => <NumHeader>My Share</NumHeader>,
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <span className="tabular-nums">
              {percentText(row.original.mySplitRatio)}
            </span>
            {row.original.status === 5 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="shrink-0">
                    ?
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  {LBL.status5Hint}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ),
      },
      // 原型列序 8：Readiness（替代旧 Activation；全状态渲染）
      {
        id: 'readiness',
        header: 'Readiness',
        meta: { overflow: 'none' },
        cell: ({ row }) => <ReadinessCell row={row.original} />,
      },
      // 原型列序 9：状态（15 驳回 → tooltip 原因）
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const badge = (
            <ProtoStatusBadge
              label={
                LP_PAIR_STATUS_MAP[row.original.status]?.label ??
                String(row.original.status)
              }
              tone={PAIR_STATUS_TONE[row.original.status] ?? 'muted'}
            />
          );
          if (row.original.status === 15 && row.original.rejectReason) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>{badge}</TooltipTrigger>
                <TooltipContent className="max-w-sm break-all">
                  {LBL.rejectReasonPrefix}
                  {row.original.rejectReason}
                </TooltipContent>
              </Tooltip>
            );
          }
          return badge;
        },
      },
      // 原型列序 10：As of（时间列头标 (UTC+8)，值 formatUtc8）
      {
        accessorKey: 'syncTime',
        header: 'As of (UTC+8)',
        meta: { maxWidth: 200 },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatUtc8(row.original.syncTime)}
          </span>
        ),
      },
    ],
    [symOf, bankOf],
  );

  /**
   * 源 SyncRefreshButton @refreshed='loadAll'：失效整个 pair 家族——
   * 活动查询立即重查；未挂载的缓存标记失效，下次切入自动重查。
   */
  const refreshAll = React.useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: pairKeys.all(LP_PROJECT_ID),
    });
  }, [queryClient]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {LBL.eyebrow}
          </div>
          <h1 className="text-xl font-semibold">{LBL.title}</h1>
        </div>

        {/* 原型筛选独立卡（§6.2 分区）：Pair Code / Status */}
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <Label className="mb-1.5 block">Pair Code</Label>
              <Input
                value={filters.pairCode}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, pairCode: e.target.value }))
                }
              />
            </div>
            <div className="min-w-0">
              <Label className="mb-1.5 block">Status</Label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, status: v === 'all' ? '' : v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {PAIR_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasFilter}
                onClick={handleReset}
              >
                Reset
              </Button>
            </div>
          </div>
        </section>

        {/* §6.2 Table Panel：实体名 + 结果数 + 数据时间 + 页面级操作右置 */}
        <section className="rounded-lg border border-border/60 bg-card">
          <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="text-base font-semibold leading-6 text-foreground">
                {LBL.entity}
              </div>
              {query.data != null && (
                <span className="text-sm text-muted-foreground tabular-nums">
                  {tableData.length} {LBL.countUnit}
                </span>
              )}
              {query.dataUpdatedAt ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Updated {formatUtc8(query.dataUpdatedAt)}
                </span>
              ) : null}
            </div>
            <div className="shrink-0">
              <SyncRefreshButton
                domain={['pair', 'rate']}
                onRefreshed={refreshAll}
              />
            </div>
          </div>

          <div className="p-4">
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={query.isPending}
              emptyMessage={LBL.emptyMine}
            />
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}
