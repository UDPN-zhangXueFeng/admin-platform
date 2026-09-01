'use client';

/**
 * FX 汇率查询页（源 `views/fx/index.vue`：GET /fx/view 只读聚合表，
 * GW-14 UDPN 对齐一页融合 token 对 + LP 名称 + 最新汇率）。
 * 路由 /fx（registry：fx → list，FxListPage 按名解析）。
 *
 * - 39c8a2b 列序对齐 UDPN 评审：token pair / FX Rate / Liquidity
 *   Provider / Updated On——原「归属」单列取消，bankCode 并入 token
 *   pair 列（每侧 tag 下方 11px 灰字，源 pair-side 纵排）。
 * - 服务端状态 TanStack Query（useFxViewQuery，无筛选维度 → 源页无搜索条件）。
 * - 源 catch 静默（拦截器已提示），目标约束升级为 fail-loud：
 *   ErrorBlock + Retry 页面内可感知可恢复。
 * - 快照时间兜底链 rate.pushTime ?? tokenPair.pushTime（源 `??` 语义逐字一致）。
 * - P3 List 批次（§6.2 对齐）：表改 shared DataTable columnDef（pair 簇 cell
 *   与 tx 列表 tokens 列同构）；panel 头条承载实体名/结果数/刷新时间/
 *   Refresh（shadow-float 去除，P2 panel 无阴影口径）。
 */

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';

import { Badge, Button, DataTable } from '@myorg/shared/ui';
import {
  useFxViewQuery,
  type FxPairItem,
} from '@myorg/modules/kissen-gateway/data-access';

import { formatTime } from './kit';
import { PageHead } from './page-head';
import { ErrorBlock } from './state-blocks';

export function FxListPage() {
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
    ],
    [],
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
