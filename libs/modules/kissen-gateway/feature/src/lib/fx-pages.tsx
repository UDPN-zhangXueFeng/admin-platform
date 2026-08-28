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

/** 源列头（39c8a2b UDPN 列序：token pair/FX Rate/Liquidity Provider/Updated On）。 */
const FX_HEADERS = [
  'token pair',
  'FX Rate',
  'Liquidity Provider',
  'Updated On',
] as const;

/** 首帧骨架行数（源 v-loading 覆盖表区的 React 等价）。 */
const SKELETON_ROWS = 5;

export function FxListPage() {
  const { data, isLoading, isError, error, isFetching, refetch } =
    useFxViewQuery();
  const rows = data?.pairs ?? [];

  return (
    <div className="space-y-4">
      <PageHead variant="banner" eyebrow="FX QUERY" title="Gateway FX Query">
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

/** 单行：每侧「tag + bankCode 灰字」纵排的 token 对 + 客户汇率 + LP tags + 兜底快照时间。 */
function FxPairRow({ row }: { row: FxPairItem }) {
  const pair = row.tokenPair;

  return (
    <tr className="transition-colors hover:bg-muted/50">
      {/* 源 pair-cell（39c8a2b）：pair-side 纵排——symbol tag（target success 色）
          + 下方 11px 灰字 bankCode，箭头居中衔接；pairCode 等宽小字垫底。 */}
      <td className="min-w-[16rem] px-4 py-3 align-middle">
        <div className="inline-flex items-center gap-2.5">
          <div className="inline-flex flex-col items-center gap-[3px]">
            <Badge variant="outline">
              {pair.sourceSymbol || pair.sourceTokenCode || '-'}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {pair.sourceBankCode || '-'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">→</span>
          <div className="inline-flex flex-col items-center gap-[3px]">
            <Badge
              variant="outline"
              className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
            >
              {pair.targetSymbol || pair.targetTokenCode || '-'}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {pair.targetBankCode || '-'}
            </span>
          </div>
        </div>
        <div className="mt-[3px] break-all font-mono text-[11px] tracking-wide text-muted-foreground">
          {pair.pairCode || '-'}
        </div>
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
