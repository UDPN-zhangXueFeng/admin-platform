'use client';

/**
 * 资金池页（源 `src/views/pool/index.vue` 1:1 语义迁移，工作清单 B1）。
 *
 * 结构：池表（水位条）+ 近期补资 top5 双卡片，纯只读、无筛选、无分页、
 * 无权限按钮（源即如此）。
 *
 * 关键迁移决策：
 * - 源 `loadAll()` 的 `Promise.allSettled([poolList, topupPage])` 映射为两条独立
 *   useQuery；「一侧失败另一侧旧数据保留」由 TanStack 错误保留上次成功 data 兜底，
 *   页面仅从两侧 error 推导降级条，不在 queryFn 层聚合。
 * - 0024 双侧降级语义（源 down.value = hit）：任一侧 error 命中 isServiceDown →
 *   渲染 ServiceDownAlert（traceId 取错误携带）；两侧都成功、或失败为非 0024 时
 *   hit 为 null → 降级条清除，但旧数据仍保留（不清 rows）。此为源有意行为，勿
 *   「顺手修正」。
 * - 近期补资取 pageSize=5、排序不传（后端 declare_time DESC，裁决 C-12），复用
 *   topup 域 useTopupListQuery（同 data-access 包域间协作，经主 barrel 消费）。
 * - percentText 容 undefined：v == null → '-'，否则 (Number(v)*100).toFixed(1)%
 *   （水位比值 0〜1 展示为百分比，非金额口径，裁决 C-8）。
 * - 水位条配色：源 CSS 变量 --ks-line/--ks-clearing/--ks-settle 在目标主题无对应
 *   token，按平台设计系统映射——轨道 bg-muted、正常 bg-primary、低水位/警示
 *   amber 系（与 ServiceDownAlert 的警示色族一致），不散落硬编码色值。
 * - 「查看全部」经 @myorg/shared/util-i18n 的 locale 感知 router 跳 /topup。
 * - 文案中文硬编码（kissen-admin 先例），不注册 i18n key。
 */

import * as React from 'react';
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
import { useRouter } from '@myorg/shared/util-i18n';
import { ServiceDownAlert } from './service-down-alert';
import { formatMoney, formatTime, maskAddress } from './format';
import {
  LP_PROJECT_ID,
  POOL_STATUS_TEXT,
  POOL_STATUS_VARIANT,
  POOL_SYSTEM_TYPE_TEXT,
  TOPUP_STATUS_LABEL,
  TOPUP_STATUS_VARIANT,
  isServiceDown,
  usePoolListQuery,
  useTopupListQuery,
  type PoolRow,
  type TopupRow,
} from '@myorg/modules/lp-portal/data-access';

const LBL = {
  eyebrow: 'LIQUIDITY',
  title: '资金池',
  poolCard: '资金池列表',
  topupCard: '近期补资',
  viewAll: '查看全部',
  empty: '暂无数据',
  lowLevel: '低水位',
} as const;

/** 近期补资固定取前 5 条（源 topupApi.page pageSize:5；排序后端默认）。 */
const TOPUP_TOP_N = 5;

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 小数比率 → 百分比文本，保留 1 位小数（裁决 C-7）；空（含 undefined）→ '-'。 */
function percentText(v: number | string | null | undefined): string {
  return v == null ? '-' : `${(Number(v) * 100).toFixed(1)}%`;
}

/** 水位条宽 = clamp(level×100, 0, 100)%（裁决 C-7）。 */
function levelBarWidth(row: PoolRow): string {
  return `${Math.min(100, Math.max(0, Number(row.level) * 100))}%`;
}

/** 低水位判定（裁决 C-8）：level 与 remindThreshold 均为 0〜1 比值直接比较。 */
function isLow(row: PoolRow): boolean {
  return row.level != null && Number(row.level) < Number(row.remindThreshold);
}

/** 池状态 Badge：未知码显原值，variant 兜底 secondary（源兜底 info 的中性映射）。 */
function PoolStatusBadge({ status }: { status: number }) {
  const variant: BadgeVariant = POOL_STATUS_VARIANT[status] ?? 'secondary';
  return <Badge variant={variant}>{POOL_STATUS_TEXT[status] ?? status}</Badge>;
}

/** 补资状态 Badge：未知码显原值，variant 兜底 secondary。 */
function TopupStatusBadge({ status }: { status: number }) {
  const variant: BadgeVariant = TOPUP_STATUS_VARIANT[status] ?? 'secondary';
  return <Badge variant={variant}>{TOPUP_STATUS_LABEL[status] ?? status}</Badge>;
}

export function PoolListPage() {
  const router = useRouter();
  const poolQuery = usePoolListQuery(LP_PROJECT_ID);
  const topupQuery = useTopupListQuery(LP_PROJECT_ID, {
    pageNum: 1,
    pageSize: TOPUP_TOP_N,
    filter: {},
  });

  // 源 down 语义：遍历两侧 settled 结果，rejected && isServiceDown → hit；
  // 最终 down = hit —— 非 0024 失败时 hit 为 null 会清除降级条（旧数据保留）。
  const down = React.useMemo(() => {
    for (const err of [poolQuery.error, topupQuery.error]) {
      if (err != null && isServiceDown(err)) return { traceId: err.traceId };
    }
    return null;
  }, [poolQuery.error, topupQuery.error]);

  const poolColumns = React.useMemo<ColumnDef<PoolRow & { id: string }>[]>(
    () => [
      { accessorKey: 'currency', header: '币种' },
      {
        accessorKey: 'currencySystemType',
        header: '系统形态',
        cell: ({ row }) => (
          <span>
            {POOL_SYSTEM_TYPE_TEXT[row.original.currencySystemType] ??
              row.original.currencySystemType}
          </span>
        ),
      },
      {
        accessorKey: 'accountAddress',
        header: '账户地址',
        cell: ({ row }) => (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-xs">
                  {maskAddress(row.original.accountAddress)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="font-mono text-xs">
                  {row.original.accountAddress}
                </span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        accessorKey: 'minLimit',
        header: '最低限额',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatMoney(row.original.minLimit)}
          </span>
        ),
      },
      {
        accessorKey: 'remindThreshold',
        header: '提醒阈值',
        // 水位比值 0〜1，与 level 同口径展示为百分比（裁决 C-8，非金额）
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {percentText(row.original.remindThreshold)}
          </span>
        ),
      },
      {
        accessorKey: 'availableBalanceCache',
        header: '可用余额缓存',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatMoney(row.original.availableBalanceCache)}
          </span>
        ),
      },
      {
        accessorKey: 'level',
        header: '水位',
        cell: ({ row }) => {
          const { level } = row.original;
          // level 为 null（minLimit≤0）显 '-'，不画条（裁决 C-7）
          if (level == null) return <span>-</span>;
          const low = isLow(row.original);
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${
                    low ? 'bg-amber-600' : 'bg-primary'
                  }`}
                  style={{ width: levelBarWidth(row.original) }}
                />
              </div>
              <span
                className={`font-mono text-xs tabular-nums ${
                  low ? 'text-amber-600' : ''
                }`}
              >
                {percentText(level)}
              </span>
              {low && (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-900"
                >
                  {LBL.lowLevel}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'balanceUpdateTime',
        header: '数据更新时间',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatTime(row.original.balanceUpdateTime)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => <PoolStatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  const topupColumns = React.useMemo<ColumnDef<TopupRow & { id: string }>[]>(
    () => [
      { accessorKey: 'currency', header: '币种' },
      {
        accessorKey: 'amount',
        header: '金额',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatMoney(row.original.amount)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => <TopupStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'declareTime',
        header: '申报时间',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatTime(row.original.declareTime)}
          </span>
        ),
      },
      {
        accessorKey: 'confirmTime',
        header: '到账时间',
        // 源口径：confirmTime 为 falsy（含 0 = 未到账）显 '-'
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.confirmTime
              ? formatTime(row.original.confirmTime)
              : '-'}
          </span>
        ),
      },
      {
        accessorKey: 'csTxId',
        header: '货币系统交易 ID',
        cell: ({ row }) => (
          <span
            className="block max-w-[220px] truncate font-mono text-xs"
            title={row.original.csTxId || undefined}
          >
            {row.original.csTxId || '-'}
          </span>
        ),
      },
    ],
    [],
  );

  const poolData = React.useMemo(
    () => (poolQuery.data ?? []).map((r) => ({ ...r, id: String(r.poolId) })),
    [poolQuery.data],
  );
  const topupData = React.useMemo(
    () =>
      (topupQuery.data?.data ?? []).map((r) => ({
        ...r,
        id: String(r.topupId),
      })),
    [topupQuery.data],
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {LBL.eyebrow}
        </div>
        <h1 className="text-xl font-semibold">{LBL.title}</h1>
      </div>

      {down && <ServiceDownAlert traceId={down.traceId} />}

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">{LBL.poolCard}</div>
        </div>
        <DataTable
          columns={poolColumns}
          data={poolData}
          isLoading={poolQuery.isPending}
          emptyMessage={LBL.empty}
        />
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">{LBL.topupCard}</div>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => router.push('/topup')}
          >
            {LBL.viewAll}
          </Button>
        </div>
        <DataTable
          columns={topupColumns}
          data={topupData}
          isLoading={topupQuery.isPending}
          emptyMessage={LBL.empty}
        />
      </div>
    </div>
  );
}
