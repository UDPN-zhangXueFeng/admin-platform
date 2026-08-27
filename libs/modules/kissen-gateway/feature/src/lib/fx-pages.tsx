'use client';

/**
 * FX 汇率查询页（源 `views/fx/index.vue`：GET /fx/view 只读聚合表，
 * GW-14 UDPN 对齐一页融合 token 对 + LP 名称 + 最新汇率）。
 * 路由 /fx（registry：fx → list，FxListPage 按名解析）。
 *
 * - 服务端状态 TanStack Query（useFxViewQuery，无筛选维度 → 源页无搜索条件）。
 * - 源 catch 静默（拦截器已提示），目标约束升级为 fail-loud：
 *   ErrorBlock + Retry 页面内可感知可恢复。
 * - 快照时间兜底链 rate.pushTime ?? tokenPair.pushTime（源 `??` 语义逐字一致）。
 */

import { Loader2 } from 'lucide-react';

import { Badge, Button } from '@myorg/shared/ui';
import {
  useFxViewQuery,
  type FxPairItem,
} from '@myorg/modules/kissen-gateway/data-access';

import { formatTime } from './kit';
import { PageHead } from './page-head';
import { EmptyHint, ErrorBlock } from './state-blocks';

/** 源列头（token 对/归属/客户汇率/流动性提供方（LP）/快照时间）。 */
const FX_HEADERS = [
  'Token Pair',
  'Bank',
  'Customer Rate',
  'Liquidity Providers (LP)',
  'Snapshot Time',
] as const;

/** 首帧骨架行数（源 v-loading 覆盖表区的 React 等价）。 */
const SKELETON_ROWS = 5;

export function FxListPage() {
  const { data, isLoading, isError, error, isFetching, refetch } =
    useFxViewQuery();
  const rows = data?.pairs ?? [];

  return (
    <div className="space-y-4">
      <PageHead variant="banner" eyebrow="FX QUERY" title="FX Rate Query">
        {/* 源 el-button :loading="loading" @click="load" → refetch，isFetching 态转圈。 */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          {isFetching && <Loader2 className="animate-spin" />}
          Refresh
        </Button>
      </PageHead>

      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        {isError ? (
          <ErrorBlock
            message={error instanceof Error ? error.message : String(error)}
            onRetry={() => refetch()}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full caption-bottom text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {FX_HEADERS.map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="h-10 px-4 text-left align-middle font-medium text-muted-foreground"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                      <tr key={`skeleton-${i}`}>
                        {FX_HEADERS.map((header) => (
                          <td key={header} className="px-4 py-3">
                            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={FX_HEADERS.length}>
                        <EmptyHint text="No token pairs pushed yet" />
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <FxPairRow key={row.tokenPair.pairId} row={row} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">
              Data comes from locally cached Kissen pushes (token pairs / LP
              names / rate snapshots); only enabled combinations are listed.
              Contact the platform to verify pushes if rates remain stale for a
              long time.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

/* ================================================================== */
/* 行渲染                                                               */
/* ================================================================== */

/** 单行：双 tag token 对 + 归属银行 → + 客户汇率 + LP tags + 兜底快照时间。 */
function FxPairRow({ row }: { row: FxPairItem }) {
  const pair = row.tokenPair;

  return (
    <tr className="transition-colors hover:bg-muted/50">
      {/* 源 pair-cell：source/target 双 el-tag（target type=success）+ 下方 pairCode 等宽小字。 */}
      <td className="min-w-[14rem] px-4 py-3 align-middle">
        <div className="flex items-center gap-1">
          <Badge variant="outline">
            {pair.sourceSymbol || pair.sourceTokenCode}
          </Badge>
          <span className="text-xs text-muted-foreground">→</span>
          <Badge
            variant="outline"
            className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
          >
            {pair.targetSymbol || pair.targetTokenCode}
          </Badge>
        </div>
        <div className="mt-0.5 break-all font-mono text-[11px] tracking-wide text-muted-foreground">
          {pair.pairCode || '-'}
        </div>
      </td>
      {/* 源归属列：sourceBankCode → targetBankCode，空值各显 '-'。 */}
      <td className="min-w-[10rem] px-4 py-3 align-middle">
        <span className="break-words">
          {pair.sourceBankCode || '-'} → {pair.targetBankCode || '-'}
        </span>
      </td>
      {/* 源 align="right" + num 类：rate 为 null 显 '-'。 */}
      <td className="px-4 py-3 text-right align-middle tabular-nums">
        {row.rate ? row.rate.userRate : '-'}
      </td>
      {/* 源 LP 列：lpNames 逐个 el-tag type=info，空列表显 '-'。 */}
      <td className="min-w-[13rem] px-4 py-3 align-middle">
        {row.lpNames.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {row.lpNames.map((name) => (
              <Badge key={name} variant="secondary">
                {name}
              </Badge>
            ))}
          </span>
        ) : (
          <span>-</span>
        )}
      </td>
      {/* 源兜底口径：rate?.pushTime ?? tokenPair.pushTime（毫秒 → en-US 24h）。 */}
      <td className="px-4 py-3 align-middle tabular-nums">
        {formatTime(row.rate?.pushTime ?? pair.pushTime)}
      </td>
    </tr>
  );
}
