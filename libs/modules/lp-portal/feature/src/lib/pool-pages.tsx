'use client';

/**
 * 资金池页（源 `src/views/pool/index.vue` 1:1 迁移，FAIL 修复 B，基线 01 §D4）。
 *
 * 源语义要点（v1.4 职责迁移，行号对照源文件）：
 * - 头部：eyebrow LIQUIDITY + 标题；右 SyncRefreshButton domain=
 *   ['pool','preauth','topup']（依赖域拉齐），刷新成功重拉当前列表；
 *   页面不提供申请、修改或切换写入操作，配置由 Admin 侧完成。
 * - 表格 12 列全列序：池 ID / Token（tag tokenSymbol||tokenNo +
 *   第二行银行）/
 *   池地址 maskAddress+tooltip 原文 / 授权对象（spenderAddress →
 *   maskAddress + ⧉ 可点复制；空 → muted「Not configured」）/ 可用余额 /
 *   授权额度 / 可用授权额度 / 水位 / 余额数据时间 / 状态 / 数据时间 /
 *   （无出款池标识或切换操作）。
 * - STATUS 四码表：5 Pending / 15 Rejected / 20 Active / 50 Disabled（域模型）。
 * - 池页只读；管理侧负责地址、门槛和审批写入，Portal 不再提交申请。
 */

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Copy as CopyIcon } from 'lucide-react';

import {
  Badge,
  DataTable,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';

import {
  LP_PROJECT_ID,
  POOL_STATUS_TEXT,
  POOL_STATUS_VARIANT,
  usePoolListQuery,
  type PoolRow,
} from '@myorg/modules/lp-portal/data-access';

import { SyncRefreshButton } from './sync-refresh-button';
import { formatMoney, formatTime, maskAddress } from './format';

/* ================================================================== */
/* 常量                                                                 */
/* ================================================================== */
const LBL = {
  eyebrow: 'LIQUIDITY',
  title: 'Liquidity Pools',
  entity: 'Pools',
  countUnit: 'pools',
  empty:
    'No liquidity pools yet — pools are configured and maintained by the admin team',
  spenderNotConfigured: 'Not configured (cannot settle)',
  spenderTooltip:
    'Approve this pool wallet for this token to this address in the token system; otherwise settlement cannot use the authorized balance',
  spenderCopied:
    'Copied — approve this pool wallet for this token to this address in the currency system',
  spenderCopyFailed: 'Copy failed — please copy the address manually',
} as const;

/* ================================================================== */
/* 单元格渲染                                                           */
/* ================================================================== */

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 数值文本（源 .num 类：等宽字体 + 数字对齐）。 */
function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs tabular-nums">{children}</span>;
}

/** 金额单元格：formatMoney + 右对齐（源「可用余额」列 align="right"）。 */
function MoneyCell({ v }: { v: number | string }) {
  return (
    <span className="block text-right font-mono text-xs tabular-nums">
      {formatMoney(v)}
    </span>
  );
}

/** 小数比率 → 百分比文本，保留 1 位小数（源 percentText）；空（含 undefined）→ '-'。 */
function percentText(v: number | string | null | undefined): string {
  return v == null ? '-' : `${(Number(v) * 100).toFixed(1)}%`;
}

/** 水位条宽 = clamp(level×100, 0, 100)%（源 levelBarWidth）。 */
function levelBarWidth(row: PoolRow): string {
  return `${Math.min(100, Math.max(0, Number(row.level) * 100))}%`;
}

/**
 * 池状态 Badge：未知码显原值，variant 兜底 secondary（源兜底 info 的中性映射）；
 * status===15 且 rejectReason 有值时挂 tooltip 展示驳回原因（源状态列三元分支）。
 */
function PoolStatusCell({ row }: { row: PoolRow }) {
  const variant: BadgeVariant = POOL_STATUS_VARIANT[row.status] ?? 'secondary';
  const badge = (
    <Badge variant={variant}>
      {POOL_STATUS_TEXT[row.status] ?? row.status}
    </Badge>
  );
  if (row.status === 15 && row.rejectReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-sm break-all">
          Rejection reason: {row.rejectReason}
        </TooltipContent>
      </Tooltip>
    );
  }
  return badge;
}

/** 水位单元格：level 非 null 显 96px 宽进度条 + 百分比；null（分母缺失）显 '-'。 */
function LevelCell({ row }: { row: PoolRow }) {
  if (row.level == null) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex items-center gap-2">
      {/* 96px 进度条：源 .level-bar/.level-fill 同款尺寸 */}
      <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: levelBarWidth(row) }}
        />
      </div>
      <Num>{percentText(row.level)}</Num>
    </div>
  );
}

/**
 * 解付授权对象单元（f0d5b6f）：spenderAddress 有值 → maskAddress + ⧉ 品牌
 * 色可点复制（成功/失败分级 toast），tooltip 常挂解释授权语义；空 → muted
 * 「Not configured (cannot pay out)」。
 */
function AuthorizationSpenderCell({ row }: { row: PoolRow }) {
  const toast = useToast();
  const spender = row.spenderAddress;
  if (!spender) {
    return (
      <span className="text-xs text-muted-foreground">
        {LBL.spenderNotConfigured}
      </span>
    );
  }
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(spender);
      toast.success(LBL.spenderCopied);
    } catch {
      toast.warning(LBL.spenderCopyFailed);
    }
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1">
          <span className="font-mono text-xs">{maskAddress(spender)}</span>
          <button
            type="button"
            aria-label="Copy spender address"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-primary hover:bg-primary/10"
            onClick={handleCopy}
          >
            <CopyIcon className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-words">
        {LBL.spenderTooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/* ================================================================== */
/* 列表页                                                               */
/* ================================================================== */

export function PoolListPage() {
  // 主表数据源（不分页全量；源 load() 直连 poolApi.list 等价）
  const listQuery = usePoolListQuery(LP_PROJECT_ID);
  const rows = listQuery.data ?? [];

  const columns = React.useMemo<ColumnDef<PoolRow & { id: string }>[]>(
    () => [
      // 源列序 1：池 ID（width 90，num）
      {
        accessorKey: 'poolId',
        header: 'Pool ID',
        cell: ({ row }) => <Num>{row.original.poolId}</Num>,
      },
      // 源列序 2：Token（f0d5b6f：tag 显 tokenSymbol||tokenNo，tokenCode 退役；
      // Token + bank identity.
      {
        accessorKey: 'tokenSymbol',
        header: 'Token',
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="w-fit rounded-full font-normal font-mono"
              >
                {row.original.tokenSymbol || row.original.tokenNo || '-'}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.bankName || row.original.bankCode || '-'}
            </div>
          </div>
        ),
      },
      // 源列序 3：池地址（maskAddress + tooltip 全文）
      {
        accessorKey: 'poolAddress',
        header: 'Pool Address',
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs">
                {maskAddress(row.original.poolAddress)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm break-all font-mono text-xs">
              {row.original.poolAddress}
            </TooltipContent>
          </Tooltip>
        ),
      },

      // 源列序 4（f0d5b6f 新增）：解付授权对象（spenderAddress mask + 复制；
      // 空 → Not configured）
      {
        accessorKey: 'spenderAddress',
        header: 'Authorization Spender',
        cell: ({ row }) => <AuthorizationSpenderCell row={row.original} />,
      },
      {
        accessorKey: 'availableBalanceCache',
        header: () => <div className="text-right">Available Balance</div>,
        cell: ({ row }) => <MoneyCell v={row.original.availableBalanceCache} />,
      },
      // 源列序 5（v2.4 新增）：授权额度（preauthAuthAmount；null → '-'
      // 挂 tooltip「暂无预授权快照」——preauth 独立页退役后快照并入池列表）
      {
        accessorKey: 'preauthAuthAmount',
        header: () => <div className="text-right">Authorized Amount</div>,
        cell: ({ row }) =>
          row.original.preauthAuthAmount == null ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>-</span>
              </TooltipTrigger>
              <TooltipContent>No pre-authorization snapshot</TooltipContent>
            </Tooltip>
          ) : (
            <MoneyCell v={row.original.preauthAuthAmount} />
          ),
      },
      // 源列序 6（v2.4 新增）：可用授权额度（null → '-'，无 tooltip）
      {
        accessorKey: 'preauthAvailableAmount',
        header: () => (
          <div className="text-right">Available Authorization</div>
        ),
        cell: ({ row }) =>
          row.original.preauthAvailableAmount == null ? (
            <span>-</span>
          ) : (
            <MoneyCell v={row.original.preauthAvailableAmount} />
          ),
      },
      // 源列序 7：水位（level!=null → 进度条 + 百分比；null → '-'）
      {
        accessorKey: 'level',
        header: 'Level',
        cell: ({ row }) => <LevelCell row={row.original} />,
      },
      // 源列序 8：余额数据时间（balanceUpdateTime falsy → '-'）
      {
        accessorKey: 'balanceUpdateTime',
        header: 'Balance Data Time',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.balanceUpdateTime
              ? formatTime(row.original.balanceUpdateTime)
              : '-'}
          </span>
        ),
      },
      // 源列序 7：状态（15 && rejectReason → tooltip 驳回原因）
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <PoolStatusCell row={row.original} />,
      },
      // 源列序 8：数据时间
      {
        accessorKey: 'syncTime',
        header: 'Data Time',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {formatTime(row.original.syncTime)}
          </span>
        ),
      },

    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.poolId) })),
    [rows],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {LBL.eyebrow}
          </div>
          <h1 className="text-xl font-semibold">{LBL.title}</h1>
        </div>

        {/* §6.2 Table Panel：实体名 + 结果数 + 数据时间 + 页面级操作右置 */}
        <section className="rounded-lg border border-border/60 bg-card">
          <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="text-base font-semibold leading-6 text-foreground">
                {LBL.entity}
              </div>
            {listQuery.data != null && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {rows.length} {LBL.countUnit}
              </span>
            )}
            {listQuery.dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatTime(listQuery.dataUpdatedAt)}
              </span>
            ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* 源 @refreshed="load"：仅重拉当前视图 */}
              <SyncRefreshButton
                domain={['pool', 'preauth', 'topup']}
                onRefreshed={() => void listQuery.refetch()}
              />
            </div>
          </div>

          <div className="p-4">
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={listQuery.isPending}
              emptyMessage={LBL.empty}
            />
          </div>
        </section>

      </div>
    </TooltipProvider>
  );
}
