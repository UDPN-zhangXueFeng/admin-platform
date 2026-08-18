'use client';

/**
 * 货币对与资金池页（源 `src/views/pair-pool/index.vue` 1:1 语义迁移，工作清单 B4）。
 *
 * 结构：主表（货币对参与清单 POST /lp/pair/list）+ 每行可展开的资金池聚合
 * 三栏（POST /lp/pair-pool/list）。纯只读、无筛选、无分页、无权限按钮（源即如此）。
 *
 * 关键迁移决策：
 * - 源 `load()` 的 `Promise.allSettled([pairApi.list(), pairApi.pairPoolList()])`
 *   映射为两条独立 useQuery（pool 域同模式）：任一侧失败保留另一侧数据由
 *   TanStack 错误时保留上次成功 data 兜底；降级条由页面从两侧 error 推导，
 *   pair 侧优先（源先判 pairRes，agg 仅在 downHit 仍为 null 时补位）。
 * - 0024 语义（源 down.value = downHit）：任一侧 error 命中 isServiceDown →
 *   渲染 ServiceDownAlert；两侧成功、或失败为非 0024 → hit 为 null 清除降级条，
 *   但旧数据保留（不清 rows）。此为源有意行为，勿「顺手修正」。
 * - 聚合按 pairId 建 Map O(1) 查（源 aggMap）；未命中由展开区
 *   「暂无资金池聚合数据」空态兜底（源 el-empty image-size 60）。
 * - levelText 仅判 null 口径（源 `level === null`）：undefined 不在判定内，
 *   会渲染 NaN%——与源逐字一致，勿改成 `== null` 或 Number() 归一。
 * - isLowLevel 同源严格 `level !== null && level < remindThreshold`（阈值与
 *   水位同口径 0〜1 比率直接比较，裁决 C-8）。
 * - 缺口码中文文案映射由前端承担（裁决 C-4，PAIR_GAP_TEXT），未知码兜底显原码；
 *   capable 由 api 侧判定（FR-P-10），前端只渲染 tag。
 * - 主表展开行：shared DataTable 无 expand 结构，本页以平台表格样式
 *   （同 DataTable 的 border/divide-y/bg-muted 表头类）手写行展开；停用参与行
 *   灰显（源 .row-stopped #8A8F98 → text-muted-foreground，Badge 自带色不受影响）。
 * - 展开块 is-low 警示色：源 CSS 变量 --ks-settle 无对应主题 token，沿用
 *   pool 页低水位 amber 映射保持跨页一致；斑马纹/内网格线省略（平台表格无此样式）。
 * - 文案中文硬编码（kissen-admin 先例），不注册 i18n key。
 */

import * as React from 'react';
import { ChevronRight } from 'lucide-react';

import { Badge, Button } from '@myorg/shared/ui';

import { ServiceDownAlert } from './service-down-alert';
import { formatMoney, formatTime } from './format';
import {
  LP_PROJECT_ID,
  PAIR_GAP_TEXT,
  PAIR_PARTICIPATION_TEXT,
  PAIR_PARTICIPATION_VARIANT,
  PAIR_STATUS_TEXT,
  PAIR_STATUS_VARIANT,
  PREAUTH_STATUS_TEXT,
  PREAUTH_STATUS_VARIANT,
  isServiceDown,
  usePairListQuery,
  usePairPoolListQuery,
  type PairPoolAgg,
  type PairPoolSourcePool,
  type PairPoolTargetPool,
  type PreauthItem,
} from '@myorg/modules/lp-portal/data-access';

const LBL = {
  eyebrow: 'MARKET',
  title: '货币对与资金池',
  empty: '暂无数据',
  aggEmpty: '暂无资金池聚合数据',
  capable: '能力判定',
  capableYes: '可解付',
  capableNo: '不可解付',
  expand: '展开',
  collapse: '收起',
} as const;

/** 展开列 + 主列（货币对/参与状态/货币对状态/滑点阈值/解付能力）。 */
const COL_COUNT = 6;

/** 主表骨架行数（无分页信息时对齐 shared DataTable 的加载占位）。 */
const SKELETON_ROWS = 5;

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 水位文本（裁决 C-7）：仅判 null——null → '-'，否则 ×100 留 1 位小数。 */
function levelText(level: number | null): string {
  return level === null ? '-' : `${(level * 100).toFixed(1)}%`;
}

/** 低水位判定（裁决 C-8）：level 非 null 且低于提醒阈值（同口径 0〜1 比率）。 */
function isLowLevel(pool: PairPoolTargetPool): boolean {
  return pool.level !== null && pool.level < pool.remindThreshold;
}

/** 最近变动：源池最近一笔补资，有则「+金额 · 时间」，无则 '-'。 */
function lastTopupText(t: PairPoolSourcePool['lastTopup']): string {
  if (!t) return '-';
  return `+${formatMoney(t.amount)} · ${formatTime(t.declareTime)}`;
}

/** 参与状态 Badge：未知码显原值，variant 兜底 secondary（源兜底 info 的中性映射）。 */
function ParticipationBadge({ status }: { status: number }) {
  const variant: BadgeVariant = PAIR_PARTICIPATION_VARIANT[status] ?? 'secondary';
  return (
    <Badge variant={variant}>
      {PAIR_PARTICIPATION_TEXT[status] ?? String(status)}
    </Badge>
  );
}

/** 货币对状态 Badge：未知码显原值，variant 兜底 secondary。 */
function PairStatusBadge({ status }: { status: number }) {
  const variant: BadgeVariant = PAIR_STATUS_VARIANT[status] ?? 'secondary';
  return (
    <Badge variant={variant}>{PAIR_STATUS_TEXT[status] ?? String(status)}</Badge>
  );
}

/** 预授权状态 Badge：未知码显原值，variant 兜底 secondary。 */
function PreauthStatusBadge({ status }: { status: number }) {
  const variant: BadgeVariant = PREAUTH_STATUS_VARIANT[status] ?? 'secondary';
  return (
    <Badge variant={variant}>
      {PREAUTH_STATUS_TEXT[status] ?? String(status)}
    </Badge>
  );
}

/** 数值文本（源 .num 类：等宽字体 + 表格数字对齐）。 */
function Num({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs tabular-nums">{children}</span>
  );
}

/** 聚合栏块（源 .agg-block：浅底 + 边框 + 小灰标题）。 */
function AggBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

/** 聚合键值行（源 .agg-item：固定宽灰 label + 可换行 value）。 */
function AggItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-14 shrink-0 text-xs leading-relaxed text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-all leading-relaxed">{children}</span>
    </div>
  );
}

/** 源币种池块：缺池（缺口 NO_POOL）显「无源币种池」。 */
function SourcePoolBlock({ pool }: { pool: PairPoolSourcePool | null }) {
  return (
    <AggBlock title="源币种池">
      {pool ? (
        <>
          <AggItem label="币种">{pool.currency ?? '-'}</AggItem>
          <AggItem label="余额缓存">
            <Num>{formatMoney(pool.availableBalanceCache ?? 0)}</Num>
          </AggItem>
          <AggItem label="最近变动">
            <Num>{lastTopupText(pool.lastTopup ?? null)}</Num>
          </AggItem>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">无源币种池</span>
      )}
    </AggBlock>
  );
}

/** 目标币种池块：缺池显「无目标币种池」；水位低时 is-low 警示色。 */
function TargetPoolBlock({ pool }: { pool: PairPoolTargetPool | null }) {
  const low = pool != null && isLowLevel(pool);
  return (
    <AggBlock title="目标币种池">
      {pool ? (
        <>
          <AggItem label="币种">{pool.currency ?? '-'}</AggItem>
          <AggItem label="余额缓存">
            <Num>{formatMoney(pool.availableBalanceCache ?? 0)}</Num>
          </AggItem>
          <AggItem label="最低限额">
            <Num>{formatMoney(pool.minLimit ?? 0)}</Num>
          </AggItem>
          <AggItem label="提醒阈值">
            <Num>{formatMoney(pool.remindThreshold ?? 0)}</Num>
          </AggItem>
          <AggItem label="水位">
            <Num>
              <span className={low ? 'font-semibold text-amber-600' : ''}>
                {levelText(pool.level ?? null)}
              </span>
            </Num>
          </AggItem>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">无目标币种池</span>
      )}
    </AggBlock>
  );
}

/** 目标币种预授权块：逐条渲染，多条以分隔线隔开；空显「无有效预授权」。 */
function PreauthBlock({ preauths }: { preauths: PreauthItem[] }) {
  return (
    <AggBlock title="目标币种预授权">
      {preauths.length > 0 ? (
        preauths.map((p, i) => (
          <div
            key={p.preauthId}
            className={`flex flex-col gap-1 ${
              i > 0 ? 'mt-1 border-t pt-2' : ''
            }`}
          >
            <AggItem label="额度">
              <Num>{formatMoney(p.authAmount)}</Num>
            </AggItem>
            <AggItem label="已用">
              <Num>{formatMoney(p.usedAmount)}</Num>
            </AggItem>
            <AggItem label="剩余">
              <Num>{formatMoney(p.remaining)}</Num>
            </AggItem>
            <AggItem label="有效期">
              <Num>{`${formatTime(p.validFrom)} 〜 ${formatTime(p.validTo)}`}</Num>
            </AggItem>
            <AggItem label="状态">
              <PreauthStatusBadge status={p.status} />
            </AggItem>
          </div>
        ))
      ) : (
        <span className="text-xs text-muted-foreground">无有效预授权</span>
      )}
    </AggBlock>
  );
}

/** 展开区：无该 pairId 聚合 → 空态；否则能力判定行 + 三栏 grid。 */
function PairExpandBody({ agg }: { agg: PairPoolAgg | undefined }) {
  if (!agg) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        {LBL.aggEmpty}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 py-1 pl-10 pr-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{LBL.capable}</span>
        {agg.capable ? (
          <Badge>{LBL.capableYes}</Badge>
        ) : (
          <Badge variant="destructive">{LBL.capableNo}</Badge>
        )}
        {agg.gaps.map((g) => (
          <Badge key={g} variant="destructive">
            {/* 缺口码中文映射（裁决 C-4）；未知码兜底显原码 */}
            {PAIR_GAP_TEXT[g] ?? g}
          </Badge>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <SourcePoolBlock pool={agg.sourcePool} />
        <TargetPoolBlock pool={agg.targetPool} />
        <PreauthBlock preauths={agg.preauths} />
      </div>
    </div>
  );
}

export function PairListPage() {
  const pairQuery = usePairListQuery(LP_PROJECT_ID);
  const aggQuery = usePairPoolListQuery(LP_PROJECT_ID);

  // 源 down 语义：pair 侧优先（源先判 pairRes），agg 侧仅在未命中时补位；
  // 非 0024 失败不命中 → 降级条清除（旧数据保留）。
  const down = React.useMemo(() => {
    for (const err of [pairQuery.error, aggQuery.error]) {
      if (err != null && isServiceDown(err)) return { traceId: err.traceId };
    }
    return null;
  }, [pairQuery.error, aggQuery.error]);

  // 聚合按 pairId 建 Map O(1) 查（源 aggMap）；一侧降级时另一侧数据仍在
  const aggMap = React.useMemo(
    () =>
      new Map(
        (aggQuery.data ?? []).map((a) => [a.pairId, a] as readonly [number, PairPoolAgg]),
      ),
    [aggQuery.data],
  );

  const rows = React.useMemo(() => pairQuery.data ?? [], [pairQuery.data]);

  // 展开态（el-table expand 语义：多行可同时展开）
  const [expanded, setExpanded] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const toggleExpand = React.useCallback((pairId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pairId)) next.delete(pairId);
      else next.add(pairId);
      return next;
    });
  }, []);

  const isLoading = pairQuery.isPending;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {LBL.eyebrow}
        </div>
        <h1 className="text-xl font-semibold">{LBL.title}</h1>
      </div>

      {down && <ServiceDownAlert traceId={down.traceId} />}

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <table className="w-full caption-bottom text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th
                scope="col"
                className="h-10 w-12 px-2 text-left align-middle font-medium text-muted-foreground"
                aria-label={LBL.expand}
              />
              <th
                scope="col"
                className="h-10 px-4 text-left align-middle font-medium text-muted-foreground"
              >
                货币对
              </th>
              <th
                scope="col"
                className="h-10 w-28 px-4 text-left align-middle font-medium text-muted-foreground"
              >
                参与状态
              </th>
              <th
                scope="col"
                className="h-10 w-28 px-4 text-left align-middle font-medium text-muted-foreground"
              >
                货币对状态
              </th>
              <th
                scope="col"
                className="h-10 w-28 px-4 text-left align-middle font-medium text-muted-foreground"
              >
                滑点阈值
              </th>
              <th
                scope="col"
                className="h-10 w-28 px-4 text-left align-middle font-medium text-muted-foreground"
              >
                解付能力
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {Array.from({ length: COL_COUNT }).map((__, ci) => (
                    <td key={ci} className="px-4 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COL_COUNT}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {LBL.empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const open = expanded.has(row.pairId);
                return (
                  <React.Fragment key={row.pairId}>
                    <tr
                      className={`
                        transition-colors hover:bg-muted/50
                        ${row.participationStatus === 50 ? 'text-muted-foreground' : ''}
                      `.trim()}
                    >
                      <td className="px-2 py-3 align-middle">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-expanded={open}
                          aria-label={open ? LBL.collapse : LBL.expand}
                          onClick={() => toggleExpand(row.pairId)}
                        >
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${
                              open ? 'rotate-90' : ''
                            }`}
                          />
                        </Button>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {row.sourceCurrency}→{row.targetCurrency}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <ParticipationBadge status={row.participationStatus} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <PairStatusBadge status={row.pairStatus} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Num>{row.slippageThreshold ?? '-'}</Num>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {row.capable ? (
                          <Badge>{LBL.capableYes}</Badge>
                        ) : (
                          <Badge variant="destructive">{LBL.capableNo}</Badge>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={COL_COUNT} className="px-4 py-2 align-top">
                          <PairExpandBody agg={aggMap.get(row.pairId)} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
