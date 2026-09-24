'use client';

/**
 * FX Query 域两页（plan/12 §5 P2：BP 原型 FxQueryPage.jsx / TokenPairDetailPage.jsx
 * 行为规格落地；源 `views/fx/index.vue` + `views/fx/detail.vue`）。
 *
 * 列表 /fx：
 * - 页头 + 筛选卡（Token Pair 模糊：匹配双侧 symbol/code；Liquidity
 *   Provider 精确；Status Enabled/Disabled）+ 表头排序（Rate / Synced on，
 *   默认 Synced on desc）。
 * - 2026-09-20 原型批注：pair 列简化 `src → tgt`（symbol 优先，去 BIC 双行）；
 *   'FX Rate'→'Rate'；LP 列纵排纯文本行（去 Badge chips）；新增 Status 列
 *   （ProtoStatusBadge）；'Synced On'→'Synced on (UTC+8)'；Actions 'Details'。
 * - /fx/view 无查询入参 → 筛选/排序为前端本地处理（本地过滤过渡，后端参数
 *   就绪后回写为服务端检索）。
 *
 * 详情 /fx/detail?id={pairId}：
 * - 页头（Back + `src → tgt` + 状态徽章 + meta Pair ID | Synced on）→ 页面级
 *   Tabs（basic/lps/history，?tab= 写 URL、basic 缺省不写）。
 * - basic = Token Pair Information（Pair ID + Source/Target 对照表）+ Latest
 *   Rate Snapshot（Base/Markup/Client Rate）；'User Rate' 术语改 'Client Rate'。
 * - lps = Liquidity Providers 表（池地址 CopyableId）；history = Rate History。
 * - 快照时间兜底链 rate?.pushTime ?? tokenPair.pushTime（源 `??` 语义逐字一致）。
 * - 保留：列表 Refresh（原型无、本仓 SyncRefresh 家族有意偏差）、列表
 *   ErrorBlock + Retry、详情 toast + Retry、footnote 推送口径。
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Loader2 } from 'lucide-react';

import {
  Button,
  DataTable,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  useFxPairDetailQuery,
  useFxViewQuery,
  type FxLpInfo,
  type FxPairItem,
  type FxRateSnapshot,
} from '@myorg/modules/kissen-gateway/data-access';

import { CopyableId, Dash, ProtoStatusBadge, type ProtoStatusTone } from './proto-ui';
import { formatRate, formatUtc8 } from './proto-format';
import { PROTO_PAIR_STATUS, protoStatusText } from './proto-enums';
import { SortHeader, compareProtoValues, useTableSort } from './proto-table';
import { DescField, DescGrid } from './desc-grid';
import { orDash } from './kit';
import { EmptyHint, ErrorBlock, MissingIdBlock } from './state-blocks';

const FX_LIST_PATH = '/fx';
const FX_DETAIL_PATH = '/fx/detail';

/** token 对状态徽章（Enabled 成功色 / Disabled 灰；码位 20/50）。 */
const PAIR_STATUS_TONES: Record<number, ProtoStatusTone> = {
  20: 'success',
  50: 'muted',
};

/* ─────────────────────────── 列表页 ─────────────────────────── */

type FxFilters = { pair: string; lp: string; status: string };

const FX_FILTER_DEFAULT: FxFilters = { pair: '', lp: '', status: '' };

export function FxListPage() {
  const router = useRouter();
  const { data, isLoading, isError, error, isFetching, refetch, dataUpdatedAt } =
    useFxViewQuery();
  const rows = data?.pairs ?? [];

  const [filters, setFilters] = React.useState<FxFilters>(FX_FILTER_DEFAULT);
  const { sort, toggle } = useTableSort('syncedAt', 'desc');

  // LP 筛选 options 从当前数据派生（全表 lpNames 并集去重排序）。
  const lpOptions = React.useMemo(
    () => [...new Set(rows.flatMap((r) => r.lpNames))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  // 本地过滤过渡（/fx/view 无查询入参；后端参数就绪后回写为服务端检索）。
  const filtered = React.useMemo(() => {
    const q = filters.pair.trim().toLowerCase();
    return rows.filter((r) => {
      const pair = r.tokenPair;
      const pairHit =
        !q ||
        (pair.sourceTokenSymbol ?? '').toLowerCase().includes(q) ||
        (pair.sourceTokenCode ?? '').toLowerCase().includes(q) ||
        (pair.targetTokenSymbol ?? '').toLowerCase().includes(q) ||
        (pair.targetTokenCode ?? '').toLowerCase().includes(q);
      return (
        pairHit &&
        (!filters.lp || r.lpNames.includes(filters.lp)) &&
        (!filters.status || String(pair.status) === filters.status)
      );
    });
  }, [rows, filters]);

  const sorted = React.useMemo(() => {
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (sort.key === 'rate') {
        return compareProtoValues(a.rate?.userRate, b.rate?.userRate) * dir;
      }
      // syncedAt：快照时间兜底链 rate?.pushTime ?? tokenPair.pushTime。
      return (
        compareProtoValues(
          a.rate?.pushTime ?? a.tokenPair.pushTime,
          b.rate?.pushTime ?? b.tokenPair.pushTime,
        ) * dir
      );
    });
  }, [filtered, sort]);

  const tableData = React.useMemo(
    () => sorted.map((r) => ({ ...r, id: String(r.tokenPair.pairId) })),
    [sorted],
  );

  const hasFilter =
    filters.pair !== '' || filters.lp !== '' || filters.status !== '';

  const columns = React.useMemo<ColumnDef<FxPairItem & { id: string }>[]>(
    () => [
      {
        // 2026-09-20 原型批注：`src → tgt` 单行（symbol 优先，code 兜底）。
        id: 'tokenPair',
        header: 'Token Pair',
        meta: { overflow: 'wrap', maxWidth: 200 },
        cell: ({ row }) => {
          const pair = row.original.tokenPair;
          return (
            <span className="font-medium">
              {pair.sourceTokenSymbol || pair.sourceTokenCode || '-'}
              <span className="mx-1.5 text-muted-foreground">→</span>
              {pair.targetTokenSymbol || pair.targetTokenCode || '-'}
            </span>
          );
        },
      },
      {
        id: 'rate',
        header: () => (
          <SortHeader
            label="Rate"
            direction={sort.key === 'rate' ? sort.direction : null}
            onToggle={() => toggle('rate', 'desc')}
            numeric
          />
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatRate(row.original.rate?.userRate)}
          </span>
        ),
      },
      {
        // 原型 LiquidityProviderCell：纵排纯文本行（去 Badge chips），空 → '-'。
        id: 'lpNames',
        header: 'Liquidity Provider',
        meta: { overflow: 'wrap', maxWidth: 220 },
        cell: ({ row }) =>
          row.original.lpNames.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-0.5">
              {row.original.lpNames.map((name) => (
                <span key={name} className="truncate">
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <Dash />
          ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <ProtoStatusBadge
            label={protoStatusText(
              PROTO_PAIR_STATUS,
              row.original.tokenPair.status,
            )}
            tone={PAIR_STATUS_TONES[row.original.tokenPair.status] ?? 'muted'}
          />
        ),
      },
      {
        id: 'syncedAt',
        header: () => (
          <SortHeader
            label="Synced on"
            direction={sort.key === 'syncedAt' ? sort.direction : null}
            onToggle={() => toggle('syncedAt', 'desc')}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(
              row.original.rate?.pushTime ?? row.original.tokenPair.pushTime,
            )}
          </span>
        ),
      },
      {
        // eafcab0：源行点击 openDetail → 操作列按钮（术语对齐原型 'Details'）。
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() =>
              router.push(
                `${FX_DETAIL_PATH}?id=${row.original.tokenPair.pairId}`,
              )
            }
          >
            Details
          </Button>
        ),
      },
    ],
    [router, sort, toggle],
  );

  return (
    <div className="space-y-4">
      {/* 页头（原型 PageHeader：标题 + 一句话口径）。 */}
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          FX
        </div>
        <h1 className="text-xl font-semibold">FX Query</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Token pairs available to this bank instance, with the latest rate
          cached from Kissen.
        </p>
      </div>

      {/* 筛选卡（原型 Filters embedded：即时生效，无 Query 按钮）。 */}
      <section className="rounded-lg border border-border/60 bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <Label className="mb-1.5 block">Token Pair</Label>
            <Input
              value={filters.pair}
              onChange={(e) =>
                setFilters((f) => ({ ...f, pair: e.target.value }))
              }
              placeholder="Fuzzy match on either side"
            />
          </div>
          <div className="min-w-0">
            <Label className="mb-1.5 block">Liquidity Provider</Label>
            <Select
              value={filters.lp || 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, lp: v === 'all' ? '' : v }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {lpOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
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
                {[20, 50].map((code) => (
                  <SelectItem key={code} value={String(code)}>
                    {protoStatusText(PROTO_PAIR_STATUS, code)}
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
              onClick={() => setFilters(FX_FILTER_DEFAULT)}
            >
              Reset
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card">
        {/* §6.2 Table Panel 头条：实体名 + 结果数 + 刷新时间 + Refresh。 */}
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Token Pairs
            </div>
            {data && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {tableData.length} results
              </span>
            )}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatUtc8(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          {/* 有意偏差：原型无 Refresh，本仓保留手动刷新（SyncRefresh 家族）。 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching && <Loader2 className="motion-safe:animate-spin" />}
            Refresh
          </Button>
        </div>

        <div className="p-4">
          {isError ? (
            <div role="alert">
              <ErrorBlock
                message={error instanceof Error ? error.message : String(error)}
                onRetry={() => refetch()}
              />
            </div>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={tableData}
                isLoading={isLoading}
                emptyMessage="No token pairs found. Try adjusting the filters."
              />
              <p className="mt-4 text-xs text-muted-foreground">
                Data comes from locally cached Kissen pushes (token pairs / LP
                names / rate snapshots); only enabled combinations are listed.
                Contact the platform to verify pushes if rates remain stale for a
                long time.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────── 详情页 ─────────────────────────── */

/** Source/Target 对照表行（原型 CompareRow：行头 + 双侧值）。 */
function PairCompareRow({
  label,
  source,
  target,
}: {
  label: string;
  source: React.ReactNode;
  target: React.ReactNode;
}) {
  return (
    <tr className="border-t border-border/50">
      <th
        scope="row"
        className="w-32 py-2.5 pr-3 text-left align-top text-sm font-medium text-muted-foreground"
      >
        {label}
      </th>
      <td className="py-2.5 pr-6 align-top text-sm">{source}</td>
      <td className="py-2.5 align-top text-sm">{target}</td>
    </tr>
  );
}

/** 对照单元格：symbol 主行 + code 可复制（原型 Token 行双行结构）。 */
function PairTokenCell(symbol: string | null | undefined, code: string | null | undefined) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span>{symbol || <Dash />}</span>
      <CopyableId value={code} />
    </div>
  );
}

/**
 * token 对详情页（registry fx.detail；/fx/detail?id={pairId}）。
 * 原型 2026-09-22 版式：页头（Back + `src → tgt` + 状态徽章 + meta 行 Pair ID |
 * Synced on）→ Tabs basic/lps/history（?tab= 写 URL）→ 各 Tab 面板卡。
 */
export function FxDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawId = searchParams.get('id');
  const parsedId = rawId != null && rawId !== '' ? Number(rawId) : undefined;
  const pairId =
    parsedId != null && Number.isFinite(parsedId) ? parsedId : undefined;

  const { data, isLoading, isError, error, refetch } =
    useFxPairDetailQuery(pairId);

  const toast = useToast();
  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load token pair detail', {
        description:
          error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  // Tab 状态写 URL（原型同款：basic 缺省不占 query，id 参数保留）。
  const tabParam = searchParams.get('tab');
  const activeTab =
    tabParam === 'lps' || tabParam === 'history' ? tabParam : 'basic';
  const handleTabChange = (next: string) => {
    const params = new URLSearchParams();
    if (rawId != null && rawId !== '') params.set('id', rawId);
    if (next !== 'basic') params.set('tab', next);
    router.replace(`${FX_DETAIL_PATH}?${params.toString()}`, { scroll: false });
  };

  const detail = data ?? null;
  const pair = detail?.tokenPair;
  const srcLabel = pair
    ? pair.sourceTokenSymbol || pair.sourceTokenCode || '-'
    : 'Source';
  const tgtLabel = pair
    ? pair.targetTokenSymbol || pair.targetTokenCode || '-'
    : 'Target';

  const lpColumns = React.useMemo<
    ColumnDef<Omit<FxLpInfo, 'id'> & { id: string }>[]
  >(
    () => [
      {
        id: 'lp',
        header: 'Liquidity Provider',
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <div>
            <div>{row.original.lpName}</div>
            {row.original.lpCode ? (
              <div className="break-all font-mono text-[11px] text-muted-foreground">
                {row.original.lpCode}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: 'sourcePoolAddress',
        header: 'Source Pool Address',
        cell: ({ row }) => (
          <CopyableId value={row.original.sourcePoolAddress} />
        ),
      },
      {
        id: 'targetPoolAddress',
        header: 'Target Pool Address',
        cell: ({ row }) => (
          <CopyableId value={row.original.targetPoolAddress} />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <ProtoStatusBadge
            label={protoStatusText(PROTO_PAIR_STATUS, row.original.status)}
            tone={PAIR_STATUS_TONES[row.original.status] ?? 'muted'}
          />
        ),
      },
      {
        id: 'pushTime',
        header: 'Synced on',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatUtc8(row.original.pushTime)}</span>
        ),
      },
    ],
    [],
  );

  const lpRows = React.useMemo<(Omit<FxLpInfo, 'id'> & { id: string })[]>(
    () =>
      (detail?.lps ?? []).map((lp) => ({ ...lp, id: String(lp.id) })),
    [detail],
  );

  const snapshotColumns =
    React.useMemo<ColumnDef<FxRateSnapshot & { id: string }>[]>(
      () => [
        {
          id: 'baseRate',
          header: 'Base Rate',
          cell: ({ row }) => (
            <span className="block text-right tabular-nums">
              {formatRate(row.original.baseRate)}
            </span>
          ),
        },
        {
          id: 'markupRate',
          header: 'Markup Rate',
          cell: ({ row }) => (
            <span className="block text-right tabular-nums">
              {formatRate(row.original.markupRate)}
            </span>
          ),
        },
        {
          // 术语对齐原型：'User Rate' → 'Client Rate'。
          id: 'clientRate',
          header: 'Client Rate',
          cell: ({ row }) => (
            <span className="block text-right font-medium tabular-nums">
              {formatRate(row.original.userRate)}
            </span>
          ),
        },
        {
          id: 'pushTime',
          header: 'Synced on',
          cell: ({ row }) => (
            <span className="tabular-nums">{formatUtc8(row.original.pushTime)}</span>
          ),
        },
      ],
      [],
    );

  const snapshotRows = React.useMemo<(FxRateSnapshot & { id: string })[]>(
    () =>
      (detail?.recentRates ?? []).map((r, i) => ({
        ...r,
        id: String(r.snapshotId ?? i),
      })),
    [detail],
  );

  if (pairId == null) {
    return (
      <MissingIdBlock
        message="Missing a token pair ID. Unable to view details."
        backTo={FX_LIST_PATH}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 页头：Back + `src → tgt` + 状态徽章 + meta 行（Pair ID | Synced on）。 */}
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="outline"
          size="iconSm"
          aria-label="Back to FX query"
          onClick={() => router.push(FX_LIST_PATH)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-all text-xl font-semibold">
              {srcLabel} → {tgtLabel}
            </h1>
            {pair ? (
              <ProtoStatusBadge
                label={protoStatusText(PROTO_PAIR_STATUS, pair.status)}
                tone={PAIR_STATUS_TONES[pair.status] ?? 'muted'}
              />
            ) : null}
          </div>
          {pair ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="tabular-nums">Pair ID: {pair.pairId}</span>
              <span aria-hidden="true">|</span>
              <span className="tabular-nums">
                Synced on {formatUtc8(pair.pushTime)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {detail && pair ? (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* Tabs 条独立于 Card（原型 §3.3）；计数为各表实时条数。 */}
          <TabsList>
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            <TabsTrigger value="lps">
              Liquidity Providers
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {detail.lps.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="history">
              Rate History
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {detail.recentRates.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1：basic = Token Pair Information（对照表）+ Latest Rate Snapshot。 */}
          <TabsContent value="basic" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-5">
              <section className="rounded-lg border border-border/60 bg-card p-4 lg:col-span-3">
                <h2 className="mb-2.5 text-sm font-semibold text-foreground">
                  Token Pair Information
                </h2>
                <div className="mb-2">
                  <DescField label="Pair ID">
                    <span className="tabular-nums">{pair.pairId}</span>
                  </DescField>
                </div>
                {/* Source/Target 对照表（原型 compare-table：行头 + 双侧列）。 */}
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="w-32 py-2 pr-3 font-medium" />
                      <th className="py-2 pr-6 font-medium">Source</th>
                      <th className="py-2 font-medium">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    <PairCompareRow
                      label="Token"
                      source={PairTokenCell(
                        pair.sourceTokenSymbol,
                        pair.sourceTokenCode,
                      )}
                      target={PairTokenCell(
                        pair.targetTokenSymbol,
                        pair.targetTokenCode,
                      )}
                    />
                    {/* /fx/detail 响应无 chain 维度 → '-'（G-02 口径）。 */}
                    <PairCompareRow
                      label="BlockChain"
                      source={<Dash />}
                      target={<Dash />}
                    />
                    <PairCompareRow
                      label="Bank"
                      source={
                        <span className="font-mono">
                          {orDash(pair.sourceBankCode)}
                        </span>
                      }
                      target={
                        <span className="font-mono">
                          {orDash(pair.targetBankCode)}
                        </span>
                      }
                    />
                    <PairCompareRow
                      label="Contract Address"
                      source={<CopyableId value={pair.sourceTokenNo} />}
                      target={<CopyableId value={pair.targetTokenNo} />}
                    />
                  </tbody>
                </table>
              </section>

              <section className="rounded-lg border border-border/60 bg-card p-4 lg:col-span-2">
                <h2 className="mb-2.5 text-sm font-semibold text-foreground">
                  Latest Rate Snapshot
                </h2>
                {detail.latestRate ? (
                  <DescGrid cols={2}>
                    <DescField label="Base Rate">
                      <span className="tabular-nums">
                        {formatRate(detail.latestRate.baseRate)}
                      </span>
                    </DescField>
                    <DescField label="Markup Rate">
                      <span className="tabular-nums">
                        {formatRate(detail.latestRate.markupRate)}
                      </span>
                    </DescField>
                    <DescField label="Client Rate">
                      <span className="tabular-nums">
                        {formatRate(detail.latestRate.userRate)}
                      </span>
                    </DescField>
                    <DescField label="Synced on">
                      <span className="tabular-nums">
                        {formatUtc8(detail.latestRate.pushTime)}
                      </span>
                    </DescField>
                  </DescGrid>
                ) : (
                  <EmptyHint text="No rate snapshot pushed for this token pair yet." />
                )}
              </section>
            </div>
          </TabsContent>

          {/* Tab 2：LP 明细表（含停用 LP；池地址可复制）。 */}
          <TabsContent value="lps" className="mt-4">
            <section className="rounded-lg border border-border/60 bg-card">
              <div className="border-b border-border/50 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Liquidity Providers
                  <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">
                    {detail.lps.length}
                  </span>
                </h2>
              </div>
              <div className="p-4">
                <DataTable
                  columns={lpColumns}
                  data={lpRows}
                  emptyMessage="No liquidity providers. No liquidity provider is linked to this token pair yet."
                />
              </div>
            </section>
          </TabsContent>

          {/* Tab 3：最近快照表（version 倒序 ≤10 条）。 */}
          <TabsContent value="history" className="mt-4">
            <section className="rounded-lg border border-border/60 bg-card">
              <div className="border-b border-border/50 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Rate History
                  <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">
                    {detail.recentRates.length}
                  </span>
                </h2>
              </div>
              <div className="p-4">
                <DataTable
                  columns={snapshotColumns}
                  data={snapshotRows}
                  emptyMessage="No rate history. No rate snapshots are available for this token pair yet."
                />
              </div>
            </section>
          </TabsContent>
        </Tabs>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : isError ? null : (
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <EmptyHint text="Token pair not found (possibly not pushed, or no permission to view)." />
        </section>
      )}
    </div>
  );
}
