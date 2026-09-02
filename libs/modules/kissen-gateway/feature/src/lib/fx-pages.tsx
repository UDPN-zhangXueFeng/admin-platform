'use client';

/**
 * FX 汇率查询页（源 `views/fx/index.vue`：GET /fx/view 只读聚合表，
 * GW-14 UDPN 对齐一页融合 token 对 + LP 名称 + 最新汇率）。
 * 路由 /fx（registry：fx → list，FxListPage 按名解析）。
 *
 * - 39c8a2b 列序对齐 UDPN 评审：token pair / FX Rate / Liquidity
 *   Provider / Updated On——原「归属」单列取消，bankCode 并入 token
 *   pair 列（每侧 tag 下方 11px 灰字，源 pair-side 纵排）。
 * - eafcab0：源行点击 openDetail → 操作列 Detail 按钮（下游列表约定，
 *   shared DataTable 无行点击支持；详情路由 /fx/detail?id={pairId}）。
 * - 服务端状态 TanStack Query（useFxViewQuery，无筛选维度 → 源页无搜索条件）。
 * - 源 catch 静默（拦截器已提示），目标约束升级为 fail-loud：
 *   ErrorBlock + Retry 页面内可感知可恢复。
 * - 快照时间兜底链 rate.pushTime ?? tokenPair.pushTime（源 `??` 语义逐字一致）。
 * - P3 List 批次（§6.2 对齐）：表改 shared DataTable columnDef（pair 簇 cell
 *   与 tx 列表 tokens 列同构）；panel 头条承载实体名/结果数/刷新时间/
 *   Refresh（shadow-float 去除，P2 panel 无阴影口径）。
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';

import {
  Badge,
  Button,
  DataTable,
  Skeleton,
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

import { DescField, DescGrid } from './desc-grid';
import { fmtAmount, formatTime, orDash } from './kit';
import { PageHead } from './page-head';
import { EmptyHint, ErrorBlock, MissingIdBlock } from './state-blocks';

export function FxListPage() {
  const router = useRouter();
  const { data, isLoading, isError, error, isFetching, refetch, dataUpdatedAt } =
    useFxViewQuery();
  const rows = data?.pairs ?? [];

  /**
   * 列序对齐 UDPN 评审（39c8a2b）：token pair / FX Rate / Liquidity
   * Provider / Updated On。pair 簇 cell 与 tx 列表 tokens 列同构
   * （双侧「tag + 下方 11px 灰字 bankCode」纵排 + pairCode 等宽小字）。
   */
  const columns = React.useMemo<ColumnDef<FxPairItem & { id: string }>[]>(
    () => [
      {
        id: 'tokenPair',
        header: 'token pair',
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const pair = row.original.tokenPair;
          return (
            <div>
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
              <div className="mt-0.5 break-all font-mono text-[11px] tracking-wide text-muted-foreground">
                {pair.pairCode || '-'}
              </div>
            </div>
          );
        },
      },
      {
        // 源 align="right" + num 类：rate 为 null 显 '-'。
        id: 'fxRate',
        header: 'FX Rate',
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.rate ? row.original.rate.userRate : '-'}
          </span>
        ),
      },
      {
        // 源 LP 列：lpNames 逐个 el-tag type=info，空列表显 '-'。
        id: 'lpNames',
        header: 'Liquidity Provider',
        meta: { overflow: 'none' },
        cell: ({ row }) =>
          row.original.lpNames.length > 0 ? (
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
        // 源兜底口径：rate?.pushTime ?? tokenPair.pushTime（毫秒 → en-US 24h）。
        id: 'updatedOn',
        header: 'Updated On',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(
              row.original.rate?.pushTime ?? row.original.tokenPair.pushTime,
            )}
          </span>
        ),
      },
      {
        // eafcab0：源行点击 openDetail → 操作列 Detail 按钮（下游列表约定）。
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() =>
              router.push(`/fx/detail?id=${row.original.tokenPair.pairId}`)
            }
          >
            Detail
          </Button>
        ),
      },
    ],
    [router],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.tokenPair.pairId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <PageHead variant="banner" eyebrow="FX QUERY" title="Gateway FX Query" />

      <section className="rounded-lg border border-border/60 bg-card">
        {/* §6.2 Table Panel 头条：实体名 + 结果数 + 刷新时间 + 页面级操作右置。 */}
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Token Pairs
            </div>
            {data && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {rows.length} results
              </span>
            )}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          {/* 源 el-button :loading="loading" @click="load" → refetch，isFetching 态转圈。 */}
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
                emptyMessage="No token pairs pushed yet"
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

/* ================================================================== */
/* 详情页（eafcab0 源 `views/fx/detail.vue`）                          */
/* ================================================================== */

/** LP/token 对状态口径（源模板：status === 20 ? Enabled : Disabled）。 */
function lpStatusVariant(status: number): 'default' | 'outline' {
  return status === 20 ? 'default' : 'outline';
}

/**
 * token 对详情页（registry fx.detail；/fx/detail?id={pairId}）。
 * 源布局：头部 pair 双侧（目标侧 success 色）+ 右侧 FX Rate 块；
 * 四卡：最新汇率快照（3 列）/ token 对信息（2 列）/ LP 明细表 / 最近快照表。
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
          <span className="break-all font-mono text-xs">
            {orDash(row.original.sourcePoolAddress)}
          </span>
        ),
      },
      {
        id: 'targetPoolAddress',
        header: 'Target Pool Address',
        cell: ({ row }) => (
          <span className="break-all font-mono text-xs">
            {orDash(row.original.targetPoolAddress)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={lpStatusVariant(row.original.status)}>
            {row.original.status === 20 ? 'Enabled' : 'Disabled'}
          </Badge>
        ),
      },
      {
        id: 'pushTime',
        header: 'Push Time',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.pushTime)}
          </span>
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
          id: 'version',
          header: 'Version',
          cell: ({ row }) => (
            <span className="tabular-nums">{orDash(row.original.version)}</span>
          ),
        },
        {
          id: 'baseRate',
          header: 'Base Rate',
          cell: ({ row }) => (
            <span className="block text-right tabular-nums">
              {fmtAmount(row.original.baseRate)}
            </span>
          ),
        },
        {
          id: 'markupRate',
          header: 'Markup Rate',
          cell: ({ row }) => (
            <span className="block text-right tabular-nums">
              {fmtAmount(row.original.markupRate)}
            </span>
          ),
        },
        {
          id: 'userRate',
          header: 'User Rate',
          cell: ({ row }) => (
            <span className="block text-right font-medium tabular-nums">
              {fmtAmount(row.original.userRate)}
            </span>
          ),
        },
        {
          id: 'pushTime',
          header: 'Push Time',
          cell: ({ row }) => (
            <span className="tabular-nums">
              {formatTime(row.original.pushTime)}
            </span>
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
        backTo="/fx"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* §6.3 Hero：源页面头部——pair 双侧（目标侧 success 色）+ FX Rate 块 + Back。 */}
      <section className="rounded-lg border border-border/60 bg-card panel-pad">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                FX Pair
              </div>
              <h1 className="text-xl font-semibold leading-7 text-foreground">
                {srcLabel} → {tgtLabel}
              </h1>
            </div>
            {pair ? (
              <Badge variant={lpStatusVariant(pair.status)}>
                {pair.status === 20 ? 'Enabled' : 'Disabled'}
              </Badge>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/fx')}>
            Back
          </Button>
        </div>
        {pair ? (
          <div className="mt-4 flex flex-col gap-4 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {/* 双侧簇与列表 pair 列同构（目标侧 emerald 成功色，源 pair-side 纵排）。 */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <Badge variant="outline">{srcLabel}</Badge>
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
                  {tgtLabel}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {pair.targetBankCode || '-'}
                </span>
              </div>
            </div>
            {/* 源头部右侧 FX Rate 块：userRate + Updated 时间（兜底 tokenPair.pushTime）。 */}
            <div className="text-right">
              <div className="text-xs text-muted-foreground">FX Rate</div>
              <div className="text-lg font-semibold tabular-nums text-foreground">
                {detail?.latestRate ? (
                  fmtAmount(detail.latestRate.userRate)
                ) : (
                  '-'
                )}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {`Updated ${formatTime(
                  detail?.latestRate?.pushTime ?? pair.pushTime,
                )}`}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {detail && pair ? (
        <>
          {/* 卡 1：最新汇率快照（源 column3；无快照 → el-empty 空态）。 */}
          <section className="rounded-lg border border-border/60 bg-card panel-pad">
            <h2 className="mb-2.5 text-sm font-semibold text-foreground">
              Latest Rate Snapshot
            </h2>
            {detail.latestRate ? (
              <DescGrid cols={3}>
                <DescField label="User Rate">
                  <span className="t-data tabular-nums">
                    {fmtAmount(detail.latestRate.userRate)}
                  </span>
                </DescField>
                <DescField label="Base Rate">
                  <span className="tabular-nums">
                    {fmtAmount(detail.latestRate.baseRate)}
                  </span>
                </DescField>
                <DescField label="Markup Rate">
                  <span className="tabular-nums">
                    {fmtAmount(detail.latestRate.markupRate)}
                  </span>
                </DescField>
                <DescField label="Version">
                  <span className="tabular-nums">
                    {orDash(detail.latestRate.version)}
                  </span>
                </DescField>
                <DescField label="Push Time">
                  <span className="font-mono">
                    {formatTime(detail.latestRate.pushTime)}
                  </span>
                </DescField>
              </DescGrid>
            ) : (
              <EmptyHint text="No rate snapshot pushed for this token pair yet." />
            )}
          </section>

          {/* 卡 2：token 对信息（源 column2；双侧 symbol（code · name）+ 子行）。 */}
          <section className="rounded-lg border border-border/60 bg-card panel-pad">
            <h2 className="mb-2.5 text-sm font-semibold text-foreground">
              Token Pair Information
            </h2>
            <DescGrid cols={2}>
              <DescField label="Pair ID">
                <span className="tabular-nums">{pair.pairId}</span>
              </DescField>
              <DescField label="Pair Code">
                <span className="font-mono">{orDash(pair.pairCode)}</span>
              </DescField>
              <DescField label="Source Token">
                <div className="flex flex-col gap-0.5">
                  <span>
                    {`${pair.sourceTokenSymbol || '-'} (${pair.sourceTokenCode} · ${
                      pair.sourceTokenName || '-'
                    })`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {`No. ${orDash(pair.sourceTokenNo)} · Bank ${orDash(
                      pair.sourceBankCode,
                    )}`}
                  </span>
                </div>
              </DescField>
              <DescField label="Target Token">
                <div className="flex flex-col gap-0.5">
                  <span>
                    {`${pair.targetTokenSymbol || '-'} (${pair.targetTokenCode} · ${
                      pair.targetTokenName || '-'
                    })`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {`No. ${orDash(pair.targetTokenNo)} · Bank ${orDash(
                      pair.targetBankCode,
                    )}`}
                  </span>
                </div>
              </DescField>
              <DescField label="Status">
                <Badge variant={lpStatusVariant(pair.status)}>
                  {pair.status === 20 ? 'Enabled' : 'Disabled'}
                </Badge>
              </DescField>
              <DescField label="Version">
                <span className="tabular-nums">{orDash(pair.version)}</span>
              </DescField>
              <DescField label="Push Time">
                <span className="font-mono">{formatTime(pair.pushTime)}</span>
              </DescField>
            </DescGrid>
          </section>

          {/* 卡 3：LP 明细表（源 el-table 5 列，含停用 LP）。 */}
          <section className="rounded-lg border border-border/60 bg-card">
            <div className="border-b border-border/50 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {`LP Details (${detail.lps.length})`}
              </h2>
            </div>
            <div className="p-4">
              <DataTable
                columns={lpColumns}
                data={lpRows}
                emptyMessage="No LPs pushed for this token pair"
              />
            </div>
          </section>

          {/* 卡 4：最近快照表（version 倒序 ≤10 条，userRate 右对齐强调）。 */}
          <section className="rounded-lg border border-border/60 bg-card">
            <div className="border-b border-border/50 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {`Recent Rate Snapshots (${detail.recentRates.length})`}
              </h2>
            </div>
            <div className="p-4">
              <DataTable
                columns={snapshotColumns}
                data={snapshotRows}
                emptyMessage="No rate snapshots pushed yet"
              />
            </div>
          </section>
        </>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : isError ? null : (
        <section className="rounded-lg border border-border/60 bg-card panel-pad">
          <EmptyHint text="Token pair not found (possibly not pushed, or no permission to view)." />
        </section>
      )}
    </div>
  );
}
