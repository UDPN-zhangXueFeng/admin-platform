'use client';

/**
 * 资金池页（原型对齐改造，方案 12 §6 L122-123；原型源
 * `PoolManagementListPage.jsx` + `PoolDetailPage.jsx`——原型为行为规格，
 * 分区/列/筛选/文案/格式化照原型，UI 用本仓 @myorg/shared/ui 体系重实现）。
 *
 * 列表页（原型 2026-09-23 拍板列序）：
 * - 页头（标题 = 菜单名 Pool Management）→ 筛选独立卡（Pool ID / Token /
 *   Status，GAP-LP-02 本地过滤）→ 列表卡（Pools + count + Updated +
 *   SyncRefreshButton domain=['pool','preauth','topup']）。
 * - 10 列：Pool Address（首列，CopyableId）/ Pool ID / Token（symbol +
 *   bankCode + Payout 徽章）/ Payout Spender（ⓘ 表头 tooltip）/ Wallet
 *   Balance（右对齐）/ Authorized Amount（次行 Avail:）/ Liq. Coverage
 *   （水位条 + % + Sufficient/Low，阈值 20%）/ Updated on (UTC+8) / Status /
 *   Actions（Details → 详情页）。
 * - 旧 3a57bbd 只读 info alert 删除：原型列表页无此分区，且其「无操作」
 *   口径与新 Actions-Details 行为矛盾；空态文案承接同语义。
 * - 旧 Available Authorization 独立列并入 Authorized Amount 次行（原型
 *   PreAuthorizedCell 同款）；余额数据时间列（balanceUpdateTime）删除，
 *   统一 Updated on = syncTime。
 *
 * 详情页（新增，路由 /pool/detail?poolId=N&tab=…；registry 需注册 pool
 * detail pageKey）：
 * - 标题 = Pool Address（地址才是唯一标识，原型 2026-09-24 拍板）+ 状态徽章
 *   + meta 行 `Pool ID: N | Updated on …`；返回按钮回列表。
 * - 3 Tab（?tab= 写 URL，basic 缺省不写）：Basic Information / Balance &
 *   Authorization / Transactions（GAP-LP-03/04，见下）。
 * - 时间列头标 (UTC+8)，值 formatUtc8（UTC+8 字面量，不随浏览器时区）。
 */

import * as React from 'react';
import { ArrowLeft, Info as InfoIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { useRouter } from '@myorg/shared/util-i18n';
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
  usePoolListQuery,
  type PoolRow,
} from '@myorg/modules/lp-portal/data-access';

import { SyncRefreshButton } from './sync-refresh-button';
import { LP_POOL_STATUS_MAP, LP_TX_STATUS_MAP } from './proto-enums';
import { formatRate, formatTokenAmount, formatUtc8 } from './proto-format';
import {
  CopyableId,
  ProtoStatusBadge,
  type ProtoTone,
} from './proto-ui';

/* ================================================================== */
/* 常量                                                                 */
/* ================================================================== */

const LIST_PATH = '/pool';
const DETAIL_PATH = '/pool/detail';

const LBL = {
  eyebrow: 'LIQUIDITY',
  title: 'Pool Management',
  entity: 'Pools',
  countUnit: 'pools',
  empty:
    'No pools yet — pools open automatically once your token pair participation is approved',
  payoutSpenderHint: 'Address authorized to draw down this pool',
  noPreauthSnapshot: 'No pre-authorization snapshot',
  rejectReasonPrefix: 'Rejection reason: ',
  notFoundTitle: 'Pool not found',
  notFoundDesc: 'This pool does not exist or has been removed.',
  backToList: 'Back to pools',
  loading: 'Loading pool…',
  tabBasic: 'Basic Information',
  tabBalance: 'Balance & Authorization',
  tabTransactions: 'Transactions',
  txEmpty: 'No transactions for this pool yet.',
} as const;

/**
 * 池状态 → 徽章语义色（§7.1：20 Active / 50 Inactive——'Disabled' 废除；
 * 5/15 为本仓后端全码覆盖保留，Pending / Rejected 沿用原型词表）。
 * 未知码由页面显原值 + muted 兜底。
 */
const POOL_STATUS_TONE: Record<number, ProtoTone> = {
  5: 'warning',
  15: 'danger',
  20: 'success',
  50: 'muted',
};

/**
 * 水位条视觉（原型 PoolManagementListPage 同款）：条宽 120px，100% 即
 * 最低流动性线（0.456 处刻度）；充足阈值 20%（参考页 17% 红 Low /
 * 64% 绿 Sufficient）。
 */
const COVERAGE_BAR_SCALE = 0.456;
const MIN_LEVEL_MARK = COVERAGE_BAR_SCALE * 100;
const COVERAGE_SUFFICIENT_PERCENT = 20;

/**
 * STATIC-FILLER(GAP-LP-02): 原型筛选为服务端参数（poolId LIKE 模糊 /
 * token 精确 / status 精确），本仓 /lp/pool/list 无查询入参——前端本地
 * 过滤等价实现（Pool ID 子串、Token 精确、Status 精确）+ 缺省排序
 * Updated on 倒序（原型服务端排序白名单的本地等价；表头排序 UI 待
 * DataTable 支持后补）。后端筛选参数就绪后回写。
 */
const POOL_STATUS_OPTIONS = [
  { value: '20', label: 'Active' },
  { value: '50', label: 'Inactive' },
] as const;

/**
 * STATIC-FILLER(GAP-LP-03): 详情字段全部取自 /lp/pool/list 行快照
 * （无 GET /lp/pool/{poolId} 端点；?poolId= 在列表数据内检索，未命中
 * → 原型 404 同款空态）。独立详情端点就绪后回写。
 */
/**
 * STATIC-FILLER(GAP-LP-04): Transactions Tab 无「按池地址过滤交易」端点
 * （原型走 GET /fx-transactions?wallet=）；本页先落列契约 + 静态空表
 * （计数 0）。端点就绪后接 tx 域查询并回写。
 */

/* ================================================================== */
/* 渲染辅助                                                             */
/* ================================================================== */

/**
 * 金额 + token 符号（原型 AmountWithToken，KNMS Wallet Balance 样式）：
 * 数值加粗 + 符号次级小字；金额按 token 精度去尾零（§3.12）；空 → '-'。
 */
function AmountWithToken({
  value,
  token,
}: {
  value: string | number | null | undefined;
  token?: string;
}) {
  if (value == null || value === '') {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold text-foreground">
        {formatTokenAmount(value)}
      </span>
      {token ? (
        <span className="ml-1 text-xs font-medium text-muted-foreground">
          {token}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Authorized Amount 单元格（原型 PreAuthorizedCell）：上行授权额加粗，
 * 下行 `Avail: {可用授权}` 次级；amount 为空 → '-' 挂「暂无预授权快照」
 * tooltip（v2.4 现有口径保留）。
 */
function AuthorizedAmountCell({
  amount,
  available,
  token,
}: {
  amount: string | number | null | undefined;
  available: string | number | null | undefined;
  token?: string;
}) {
  if (amount == null || amount === '') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground">-</span>
        </TooltipTrigger>
        <TooltipContent>{LBL.noPreauthSnapshot}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <span className="flex min-w-0 flex-col items-end gap-0.5">
      <span className="whitespace-nowrap tabular-nums">
        <AmountWithToken value={amount} token={token} />
      </span>
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        Avail:{' '}
        {available == null || available === ''
          ? '-'
          : `${formatTokenAmount(available)}${token ? ` ${token}` : ''}`}
      </span>
    </span>
  );
}

/**
 * Liq. Coverage 单元格（原型 PoolLevel）：水位条 + 45.6% 最低流动性刻度 +
 * % 文本 + Sufficient/Low 徽章。level 为后端预计算比率（分母 = 最低流动性，
 * 行内不下发），原型悬停回显公式 tooltip 无数据支撑——省略并在此登记；
 * level null（分母缺失）→ '-'。
 */
function CoverageCell({ level }: { level: string | null }) {
  if (level == null) return <span className="text-muted-foreground">-</span>;
  const numeric = Number(level);
  const percent = Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
  const sufficient = percent >= COVERAGE_SUFFICIENT_PERCENT;
  const fillWidth = Math.min(100, Math.round(percent * COVERAGE_BAR_SCALE));
  return (
    <span className="inline-flex items-center gap-3">
      <span
        aria-hidden="true"
        className="relative h-1.5 w-[120px] shrink-0 rounded-full bg-border"
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${
            sufficient ? 'bg-success' : 'bg-destructive'
          }`}
          style={{ width: `${fillWidth}%` }}
        />
        <span
          className="absolute -inset-y-[3px] w-0.5 bg-muted-foreground"
          style={{ left: `${MIN_LEVEL_MARK}%` }}
        />
      </span>
      <span
        className={`font-semibold tabular-nums ${
          sufficient ? 'text-foreground' : 'text-destructive'
        }`}
      >
        {percent}%
      </span>
      <ProtoStatusBadge
        label={sufficient ? 'Sufficient' : 'Low'}
        tone={sufficient ? 'success' : 'danger'}
      />
    </span>
  );
}

/**
 * Token 单元格（列表/详情同款）：symbol 徽章 + bankCode 徽章 + 当前出款池
 * Payout 徽章（activeFlag===1；多池模型同 token 至多一池置位）。
 * 类型标签不带状态点（§3.14.1）。
 */
function TokenBadges({ row }: { row: PoolRow }) {
  const symbol = row.tokenSymbol || row.tokenNo;
  if (!symbol) return <span className="text-muted-foreground">-</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
      <Badge variant="default" className="font-normal">
        {symbol}
      </Badge>
      {row.bankCode ? (
        <Badge variant="mute" className="font-normal">
          {row.bankCode}
        </Badge>
      ) : null}
      {row.activeFlag === 1 ? (
        <Badge variant="success" className="font-normal">
          Payout
        </Badge>
      ) : null}
    </span>
  );
}

/**
 * 池状态徽章：LP_POOL_STATUS_MAP 文案（20 Active / 50 Inactive）+ 语义色；
 * status===15 且 rejectReason 有值时挂 tooltip 展示驳回原因（现有口径保留）。
 */
function PoolStatusBadge({ row }: { row: PoolRow }) {
  const badge = (
    <ProtoStatusBadge
      label={LP_POOL_STATUS_MAP[row.status]?.label ?? String(row.status)}
      tone={POOL_STATUS_TONE[row.status] ?? 'muted'}
    />
  );
  if (row.status === 15 && row.rejectReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-sm break-all">
          {LBL.rejectReasonPrefix}
          {row.rejectReason}
        </TooltipContent>
      </Tooltip>
    );
  }
  return badge;
}

/* ================================================================== */
/* 列表页                                                               */
/* ================================================================== */

type PoolTableRow = PoolRow & { id: string };

export function PoolListPage() {
  const router = useRouter();
  // 主表数据源（不分页全量；详情页共用同一快照）
  const listQuery = usePoolListQuery(LP_PROJECT_ID);
  const rows = listQuery.data ?? [];

  // GAP-LP-02：本地筛选状态（原型 filters 受控输入同构；无 debounce——
  // 本地即时过滤无需请求级防抖）
  const [filters, setFilters] = React.useState({
    poolId: '',
    token: '',
    status: '',
  });
  const hasFilter =
    filters.poolId !== '' || filters.token !== '' || filters.status !== '';

  const handleReset = () => setFilters({ poolId: '', token: '', status: '' });

  // Token 筛选 options：当前快照内 token 全集（原型为 seed 全集常量，
  // 本仓不硬编码 token 清单，随数据派生）
  const tokenOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => r.tokenSymbol || r.tokenNo)
            .filter((s): s is string => !!s),
        ),
      ).sort(),
    [rows],
  );

  // GAP-LP-02：本地过滤（Pool ID 子串 / Token 精确 / Status 精确）+
  // 缺省排序 Updated on（syncTime）倒序
  const tableData = React.useMemo<PoolTableRow[]>(() => {
    const poolId = filters.poolId.trim();
    return rows
      .filter(
        (r) =>
          (!poolId || String(r.poolId).includes(poolId)) &&
          (!filters.token || (r.tokenSymbol || r.tokenNo) === filters.token) &&
          (!filters.status || String(r.status) === filters.status),
      )
      .slice()
      .sort((a, b) => b.syncTime - a.syncTime)
      .map((r) => ({ ...r, id: String(r.poolId) }));
  }, [rows, filters]);

  const columns = React.useMemo<ColumnDef<PoolTableRow>[]>(
    () => [
      // 原型列序 1：Pool Address（首列，CopyableId 中段截断 + 复制）
      {
        accessorKey: 'poolAddress',
        header: 'Pool Address',
        meta: { maxWidth: 220 },
        cell: ({ row }) => (
          <CopyableId value={row.original.poolAddress} maxWidth={200} />
        ),
      },
      // 原型列序 2：Pool ID
      {
        accessorKey: 'poolId',
        header: 'Pool ID',
        meta: { maxWidth: 90 },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {row.original.poolId}
          </span>
        ),
      },
      // 原型列序 3：Token（symbol + bankCode + Payout 徽章行）
      {
        accessorKey: 'tokenSymbol',
        header: 'Token',
        meta: { overflow: 'wrap', maxWidth: 180 },
        cell: ({ row }) => <TokenBadges row={row.original} />,
      },
      // 原型列序 4：Payout Spender（表头 ⓘ 挂授权语义 tooltip）
      {
        accessorKey: 'spenderAddress',
        header: () => (
          <span className="inline-flex items-center gap-1">
            Payout Spender
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={LBL.payoutSpenderHint}
                  className="cursor-help rounded-sm text-muted-foreground"
                >
                  <InfoIcon className="size-3.5" aria-hidden="true" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="w-60">
                {LBL.payoutSpenderHint}
              </TooltipContent>
            </Tooltip>
          </span>
        ),
        meta: { overflow: 'wrap', maxWidth: 220 },
        cell: ({ row }) => (
          <CopyableId
            value={row.original.spenderAddress ?? null}
            maxWidth={180}
          />
        ),
      },
      // 原型列序 5：Wallet Balance（右对齐）
      {
        accessorKey: 'availableBalanceCache',
        header: () => <div className="text-right">Wallet Balance</div>,
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <div className="flex justify-end tabular-nums">
            <AmountWithToken
              value={row.original.availableBalanceCache}
              token={row.original.tokenSymbol || row.original.tokenNo}
            />
          </div>
        ),
      },
      // 原型列序 6：Authorized Amount（次行 Avail: 可用授权）
      {
        accessorKey: 'preauthAuthAmount',
        header: () => <div className="text-right">Authorized Amount</div>,
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <AuthorizedAmountCell
              amount={row.original.preauthAuthAmount ?? null}
              available={row.original.preauthAvailableAmount ?? null}
              token={row.original.tokenSymbol || row.original.tokenNo}
            />
          </div>
        ),
      },
      // 原型列序 7：Liq. Coverage（水位条 + Sufficient/Low）
      {
        accessorKey: 'level',
        header: 'Liq. Coverage',
        meta: { overflow: 'none' },
        cell: ({ row }) => <CoverageCell level={row.original.level} />,
      },
      // 原型列序 8：Updated on（时间列头标 (UTC+8)，值 formatUtc8）
      {
        accessorKey: 'syncTime',
        header: 'Updated on (UTC+8)',
        meta: { maxWidth: 200 },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatUtc8(row.original.syncTime)}
          </span>
        ),
      },
      // 原型列序 9：状态（15 驳回 → tooltip 原因）
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <PoolStatusBadge row={row.original} />,
      },
      // 原型列序 10：Actions（Details → 详情页）
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="xs"
            className="h-auto px-0 py-0 text-xs"
            onClick={() =>
              router.push(`${DETAIL_PATH}?poolId=${row.original.poolId}`)
            }
          >
            Details
          </Button>
        ),
      },
    ],
    [router],
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

        {/* 原型筛选独立卡（§6.2 分区）：Pool ID / Token / Status */}
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <Label className="mb-1.5 block">Pool ID</Label>
              <Input
                value={filters.poolId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, poolId: e.target.value }))
                }
              />
            </div>
            <div className="min-w-0">
              <Label className="mb-1.5 block">Token</Label>
              <Select
                value={filters.token || 'all'}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, token: v === 'all' ? '' : v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {tokenOptions.map((symbol) => (
                    <SelectItem key={symbol} value={symbol}>
                      {symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {POOL_STATUS_OPTIONS.map((o) => (
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
              {listQuery.data != null && (
                <span className="text-sm text-muted-foreground tabular-nums">
                  {tableData.length} {LBL.countUnit}
                </span>
              )}
              {listQuery.dataUpdatedAt ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Updated {formatUtc8(listQuery.dataUpdatedAt)}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* 源 @refreshed="load"：依赖域拉齐后重拉当前视图 */}
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

/* ================================================================== */
/* 详情页（/pool/detail?poolId=N[&tab=basic|balance|transactions]）      */
/* ================================================================== */

/** STATIC-FILLER(GAP-LP-04): 交易行契约（原型 /fx-transactions?wallet= 行形；
 * 端点未就绪，恒为空表——列定义先落地，后端接入后填数据源）。 */
interface PoolTxRow {
  id: string;
  transactionNo: string;
  /** 币对符号（源 → 目标） */
  baseSymbol: string;
  quoteSymbol: string;
  /** 本池为起始链（from 钱包 = 池地址）时 'source'，否则 'target' */
  chainRole: 'source' | 'target';
  fromAmount: string | number | null;
  fromWallet: string | null;
  toAmount: string | number | null;
  toWallet: string | null;
  fxRate: string | number | null;
  status: number;
  completedOn: number | null;
}

/** 只读字段（label 上 / 值下，原型 Field 同形）。 */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** 列表式只读行（label 左 / 值右，行间分隔线，原型 Balance 卡同形）。 */
function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <dt className="shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

/** 交易对手方（原型 TxParty）：金额主行 + 钱包 CopyableId 次行。 */
function TxParty({
  amount,
  wallet,
}: {
  amount: string | number | null;
  wallet: string | null;
}) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <span className="whitespace-nowrap font-semibold tabular-nums">
        {formatTokenAmount(amount)}
      </span>
      <CopyableId value={wallet} className="text-xs text-muted-foreground" />
    </span>
  );
}

export function PoolDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listQuery = usePoolListQuery(LP_PROJECT_ID);

  // GAP-LP-03：详情数据 = 列表快照内检索（?poolId=）
  const poolIdParam = searchParams.get('poolId');
  const poolId =
    poolIdParam != null && poolIdParam !== '' && Number.isFinite(Number(poolIdParam))
      ? Number(poolIdParam)
      : null;
  const pool = React.useMemo(
    () =>
      poolId == null
        ? undefined
        : (listQuery.data ?? []).find((r) => r.poolId === poolId),
    [listQuery.data, poolId],
  );

  // Tab 状态写 URL（§3.4.2：basic 缺省不写 ?tab=）
  const tabParam = searchParams.get('tab');
  const activeTab =
    tabParam === 'balance' || tabParam === 'transactions'
      ? tabParam
      : 'basic';

  const handleTabChange = (next: string) => {
    const params = new URLSearchParams();
    if (poolIdParam != null && poolIdParam !== '') {
      params.set('poolId', poolIdParam);
    }
    if (next !== 'basic') params.set('tab', next);
    router.replace(`${DETAIL_PATH}?${params.toString()}`, { scroll: false });
  };

  // STATIC-FILLER(GAP-LP-04): 交易列契约（数据恒空）
  const txColumns = React.useMemo<ColumnDef<PoolTxRow>[]>(
    () => [
      {
        accessorKey: 'transactionNo',
        header: 'Transaction No.',
        meta: { maxWidth: 180 },
        cell: ({ row }) => (
          <CopyableId value={row.original.transactionNo} maxWidth={160} />
        ),
      },
      {
        id: 'tokens',
        header: 'Tokens',
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-semibold tabular-nums">
            {row.original.baseSymbol} → {row.original.quoteSymbol}
          </span>
        ),
      },
      {
        accessorKey: 'chainRole',
        header: 'Chain Role',
        cell: ({ row }) =>
          row.original.chainRole === 'source' ? (
            <Badge variant="default" className="font-normal">
              Source Chain
            </Badge>
          ) : (
            <Badge variant="success" className="font-normal">
              Target Chain
            </Badge>
          ),
      },
      {
        id: 'from',
        header: 'From',
        meta: { overflow: 'wrap' },
        cell: ({ row }) => (
          <TxParty
            amount={row.original.fromAmount}
            wallet={row.original.fromWallet}
          />
        ),
      },
      {
        id: 'to',
        header: 'To',
        meta: { overflow: 'wrap' },
        cell: ({ row }) => (
          <TxParty
            amount={row.original.toAmount}
            wallet={row.original.toWallet}
          />
        ),
      },
      {
        accessorKey: 'fxRate',
        header: () => <div className="text-right">FX Rate</div>,
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <div className="flex justify-end tabular-nums">
            {formatRate(row.original.fxRate)}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        // 交易态色由 tx 域（tx-flow 页）统一定义；空表阶段先落文案映射
        cell: ({ row }) => (
          <span className="tabular-nums">
            {LP_TX_STATUS_MAP[row.original.status]?.label ??
              String(row.original.status)}
          </span>
        ),
      },
      {
        accessorKey: 'completedOn',
        header: 'Completed on (UTC+8)',
        meta: { maxWidth: 200 },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatUtc8(row.original.completedOn)}
          </span>
        ),
      },
    ],
    [],
  );

  if (listQuery.isPending) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
        {LBL.loading}
      </div>
    );
  }

  if (!pool) {
    // 原型 404 同款空态（GAP-LP-03：无独立端点，列表内未命中即视为不存在）
    return (
      <section className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center">
        <p className="text-lg font-medium text-foreground">
          {LBL.notFoundTitle}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{LBL.notFoundDesc}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => router.push(LIST_PATH)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {LBL.backToList}
        </Button>
      </section>
    );
  }

  const symbol = pool.tokenSymbol || pool.tokenNo;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-w-0 space-y-4">
        {/* 标题 = Pool Address（地址才是唯一标识）+ 状态 + meta 行 */}
        <div className="flex flex-wrap items-start gap-3">
          <Button
            variant="outline"
            size="iconSm"
            aria-label={LBL.backToList}
            onClick={() => router.push(LIST_PATH)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="min-w-0 break-all text-xl font-semibold">
                {pool.poolAddress || 'Pool Details'}
              </h1>
              <PoolStatusBadge row={pool} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="tabular-nums">Pool ID: {pool.poolId}</span>
              <span aria-hidden="true">|</span>
              <span className="tabular-nums">
                Updated on {formatUtc8(pool.syncTime)}
              </span>
            </p>
          </div>
        </div>

        {/* §3.4/§3.15.5：Tab 条独立于 Card；状态写 URL */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="basic">{LBL.tabBasic}</TabsTrigger>
            <TabsTrigger value="balance">{LBL.tabBalance}</TabsTrigger>
            {/* STATIC-FILLER(GAP-LP-04): 计数静态 0 */}
            <TabsTrigger value="transactions">
              {LBL.tabTransactions}
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                0
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1：Basic Information */}
          <TabsContent value="basic" className="mt-4">
            <section className="rounded-lg border border-border/60 bg-card p-4">
              <div className="mb-4 text-base font-semibold leading-6 text-foreground">
                {LBL.tabBasic}
              </div>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Field label="Pool ID">
                  <span className="tabular-nums">{pool.poolId}</span>
                </Field>
                <Field label="Pool Name">
                  {pool.tokenName || <span className="text-muted-foreground">-</span>}
                </Field>
                <Field label="Token">
                  <TokenBadges row={pool} />
                </Field>
              </dl>
            </section>
          </TabsContent>

          {/* Tab 2：Balance & Authorization（GAP-LP-03：字段取列表行快照） */}
          <TabsContent value="balance" className="mt-4">
            <section className="rounded-lg border border-border/60 bg-card p-4">
              <div className="mb-1 text-base font-semibold leading-6 text-foreground">
                {LBL.tabBalance}
              </div>
              <dl className="divide-y divide-border">
                <FieldRow label="Wallet Balance">
                  <AmountWithToken
                    value={pool.availableBalanceCache}
                    token={symbol}
                  />
                </FieldRow>
                <FieldRow label="Authorized Amount">
                  <AmountWithToken
                    value={pool.preauthAuthAmount ?? null}
                    token={symbol}
                  />
                </FieldRow>
                <FieldRow label="Available Pre-Authorized">
                  <AmountWithToken
                    value={pool.preauthAvailableAmount ?? null}
                    token={symbol}
                  />
                </FieldRow>
                <FieldRow label="Liq. Coverage">
                  <CoverageCell level={pool.level} />
                </FieldRow>
                <FieldRow label="Payout Spender">
                  <CopyableId value={pool.spenderAddress ?? null} />
                </FieldRow>
                <FieldRow label="Pool Address">
                  <CopyableId value={pool.poolAddress} />
                </FieldRow>
                <FieldRow label="Updated on">
                  <span className="tabular-nums">
                    {formatUtc8(pool.syncTime)}
                  </span>
                </FieldRow>
              </dl>
            </section>
          </TabsContent>

          {/* Tab 3：Transactions（GAP-LP-04：静态空表 + 列契约） */}
          <TabsContent value="transactions" className="mt-4">
            <section className="rounded-lg border border-border/60 bg-card">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/50 px-4 py-3">
                <div className="text-base font-semibold leading-6 text-foreground">
                  {LBL.tabTransactions}
                </div>
              </div>
              <div className="p-4">
                <DataTable
                  columns={txColumns}
                  data={[]}
                  emptyMessage={LBL.txEmpty}
                />
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
