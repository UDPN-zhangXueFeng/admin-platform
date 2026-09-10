'use client';

/**
 * Token Pair 管理页（源 `src/views/pair/index.vue` §D7 v2.3 e591f85 1:1 迁移，
 * FR-LW-04）。原汇率页（rate）随 v2.3 菜单重组退役，汇率三列并入双 tab 行 VO。
 *
 * Mine「我的 token 对」v2.3 改 10 列（Token对 + pairx 紧凑式两行 +
 * 基础汇率/加价率/用户汇率 + 我的分成比例 + 对默认比例 + 生效条件 + 状态 +
 * 数据时间）。Portal 不再提供 Eligible/Apply 入口；参与对由管理侧发起并经
 * 审批后同步，页面只读展示真实的 Mine 数据。Bank/Token 展示
 * 统一走 useTokenMeta 口径（§E23/E24：symOf 优先、失败回退标识本身）；
 * rateText/percentText 为页面级 helper（源同款，不入 format.ts）。
 *
 * 源无关键词筛选、无状态下拉、无分页控件（接口全量返回），故不加任何
 * 筛选/分页（禁臆造）。SyncRefreshButton 刷新 pair/rate 实时数据。
 *
 * 口径：汇率/比率右对齐等宽字；状态/tag 色映射照源逐码
 * （STATUS_TAG warning/danger/success/info → R1 先例 outline/destructive/
 * default/secondary）；1280 主口径容器由壳层承担，页面仅纵向堆叠。
 */

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  DataTable,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';

import {
  LP_PROJECT_ID,
  PAIR_STATUS_TEXT,
  PAIR_STATUS_VARIANT,
  usePairListQuery,
  type PairRow,
  pairKeys,
  useTokenMeta,
} from '@myorg/modules/lp-portal/data-access';

import { SyncRefreshButton } from './sync-refresh-button';
import { formatTime } from './format';

/* ================================================================== */
/* 文案与渲染辅助                                                        */
/* ================================================================== */

const LBL = {
  eyebrow: 'MARKET',
  title: 'Token Pair Management',
  entity: 'Token Pairs',
  mineTab: 'My Token Pairs',
  status5Hint:
    'The admin side may override the split ratio upon approval; this is the current reference value.',
  rejectReasonPrefix: 'Rejection reason: ',
  emptyMine: 'No token pairs have been registered for this LP yet.',
} as const;

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 比率（0〜1 小数）→ 百分比文本两位小数，空显 '-'（源 percentText 1:1）。 */
function percentText(v: string | number | null | undefined): string {
  return v == null || v === '' ? '-' : `${(Number(v) * 100).toFixed(2)}%`;
}

/** 数值文本（源 .num 类：等宽字体 + 表格数字对齐）。 */
function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs tabular-nums">{children}</span>;
}

/** 右对齐数值列表头（比率列锁步）。 */
function NumHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-right">{children}</div>;
}

/** 汇率值展示（源 rateText 1:1）：基础/用户汇率为比值原值，不加 %、空显 '-'。 */
function rateText(v: string | number | null | undefined): string {
  return v == null || v === '' ? '-' : String(v);
}

/** 右对齐数值单元格（源 .num align=right 等价；表头配 NumHeader）。 */
function NumCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <Num>{children}</Num>
    </div>
  );
}

/**
 * pairx 紧凑式（源 .pairx，§E24 symOf 优先、失败回退标识本身）：
 * 第一行 symOf(src)/symOf(tgt) 等宽加粗、第二行 bankOf(src) → bankOf(tgt)
 * 次要色。e0fad0a 起 eligible 第三行 pairCode||pairId 占位行移除（两行式）。
 */
function Pairx({ tokens, banks }: { tokens: string; banks: string }) {
  return (
    <div className="whitespace-nowrap">
      <div className="font-mono text-xs font-semibold tabular-nums">
        {tokens}
      </div>
      <div className="text-xs text-muted-foreground">{banks}</div>
    </div>
  );
}

/** 参与状态 Badge 文案（未知码显原值）。 */
function statusText(status: number): string {
  return PAIR_STATUS_TEXT[status] ?? String(status);
}

/** 状态 tag 兜底色 info→secondary（源 statusTagType ?? 'info' 等价）。 */
function statusVariant(status: number): BadgeVariant {
  return PAIR_STATUS_VARIANT[status] ?? 'secondary';
}

/* ================================================================== */
/* Mine tab：我的 token 对（v2.3 改 10 列，列序照源 §D7）                   */
/* ================================================================== */

/**
 * DataTable 行标识 id:string 与模型记录 ID:number 撞名，id 转字符串满足
 * TanStack 泛型约束（v2.3 源无记录 ID 列，原值不再单独承载）。
 */
type MineRow = Omit<PairRow, 'id'> & { id: string };

function MineTable() {
  const query = usePairListQuery(LP_PROJECT_ID);
  const { symOf, bankOf } = useTokenMeta(LP_PROJECT_ID);
  const rows = React.useMemo<MineRow[]>(
    () => (query.data ?? []).map((r) => ({ ...r, id: String(r.id) })),
    [query.data],
  );

  const columns = React.useMemo<ColumnDef<MineRow>[]>(
    () => [
      {
        accessorKey: 'pairCode',
        header: 'Pair Code',
        // 无码行回落 pairId 原值（源 row.pairCode || row.pairId）
        cell: ({ row }) => (
          <span>{row.original.pairCode || row.original.pairId}</span>
        ),
        meta: { overflow: 'ellipsis' },
      },
      {
        id: 'pairx',
        header: 'Token Pair',
        cell: ({ row }) => {
          const r = row.original;
          return (
            <Pairx
              tokens={`${symOf(r.sourceTokenCode)}/${symOf(r.targetTokenCode)}`}
              banks={`${bankOf(r.sourceTokenCode)} → ${bankOf(r.targetTokenCode)}`}
            />
          );
        },
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'baseRate',
        header: () => <NumHeader>Base Rate</NumHeader>,
        cell: ({ row }) => <NumCell>{rateText(row.original.baseRate)}</NumCell>,
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'markupRate',
        header: () => <NumHeader>Markup Rate</NumHeader>,
        cell: ({ row }) => (
          <NumCell>{percentText(row.original.markupRate)}</NumCell>
        ),
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'userRate',
        header: () => <NumHeader>User Rate</NumHeader>,
        cell: ({ row }) => <NumCell>{rateText(row.original.userRate)}</NumCell>,
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'mySplitRatio',
        header: () => <NumHeader>My Split Ratio</NumHeader>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Num>{percentText(row.original.mySplitRatio)}</Num>
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
      {
        accessorKey: 'defaultSplitRatio',
        header: () => <NumHeader>Default Ratio</NumHeader>,
        cell: ({ row }) => (
          <NumCell>{percentText(row.original.defaultSplitRatio)}</NumCell>
        ),
      },
      {
        header: 'Activation',
        id: 'activation',
        // 生效条件：仅 status===20 渲染两组缺口 tag，否则 '-'（源 1:1）
        cell: ({ row }) =>
          row.original.status !== 20 ? (
            <span>-</span>
          ) : (
            <>
            <div className="flex flex-wrap items-center gap-1">
              <Badge
                variant={row.original.poolReady ? 'default' : 'destructive'}
              >
                {row.original.poolReady ? 'Pool Ready' : 'Pool Missing'}
              </Badge>
              <Badge variant={row.original.preauthOk ? 'default' : 'outline'}>
                {row.original.preauthOk ? 'Pre-auth Valid' : 'Pre-auth Not Set'}
              </Badge>
            </div>
            </>
          ),
        meta: { overflow: 'none' },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const badge = (
            <Badge variant={statusVariant(row.original.status)}>
              {statusText(row.original.status)}
            </Badge>
          );
          // 已驳回且带原因 → tooltip 展示驳回原因（源 1:1）
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
      {
        accessorKey: 'syncTime',
        header: 'Data Time',
        cell: ({ row }) => <Num>{formatTime(row.original.syncTime)}</Num>,
      },
    ],
    // symOf/bankOf 随 token 元数据缓存更新
    [symOf, bankOf],
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {query.data != null && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {rows.length} pairs
          </span>
        )}
        {query.dataUpdatedAt ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            Updated {formatTime(query.dataUpdatedAt)}
          </span>
        ) : null}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={query.isPending}
        emptyMessage={LBL.emptyMine}
      />
    </>
  );
}
/* ================================================================== */
/* 页面装配                                                              */
/* ================================================================== */

export function PairListPage() {
  const queryClient = useQueryClient();

  /**
   * 源 SyncRefreshButton @refreshed='loadAll'：两视图都刷。这里失效整个
   * pair 家族——激活 tab 的活动查询立即重查；未挂载的 tab 缓存被标记失效，
   * 下次切入自动重查（用户可见行为与 loadAll 等价，不会后台盲拉隐藏表）。
   */
  const refreshAll = React.useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: pairKeys.all(LP_PROJECT_ID),
    });
  }, [queryClient]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {LBL.eyebrow}
        </div>
        <h1 className="text-xl font-semibold">{LBL.title}</h1>
      </div>

      {/* §6.2 Table Panel：实体名 + 页面级操作右置（结果数/时间在 tab 体内随查询渲染） */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-base font-semibold leading-6 text-foreground">
            {LBL.entity}
          </div>
          <div className="shrink-0">
            <SyncRefreshButton
              domain={['pair', 'rate']}
              onRefreshed={refreshAll}
            />
          </div>
        </div>
        <TooltipProvider delayDuration={200}>
          <Tabs
            value="mine"
            className="p-4"
          >
            <TabsList>
              <TabsTrigger value="mine">{LBL.mineTab}</TabsTrigger>
            </TabsList>
            <TabsContent value="mine" className="mt-4">
              <MineTable />
            </TabsContent>
          </Tabs>
        </TooltipProvider>
      </section>
    </div>
  );
}
