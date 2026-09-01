'use client';

/**
 * Token 总览页（源 `src/views/token/index.vue` 1:1 语义迁移，01 §D3）。
 *
 * Menu key: lp:token  Path: /token  Page keys: list (双 tab 单页，只读)
 *
 * 视图一「Token List」7 列：Token（圆角 tag + symbol 副行、第二行 tokenName）、
 * tokenNo（截断 tooltip，'-' 兜底）、所属银行 bankName(bankCode)、区块链/锚定
 * 「chainType / anchorFiat」、最低流动性 formatMoney 右对齐、我的状态
 * （pooled → Pool Opened / 未开通 Not Enabled）、数据时间 formatTime。
 * 视图二「By Bank」Accordion 按 bankId 分组，标题 bankName(bankCode) +
 * 「N tokens」，默认展开第一个银行；子表 4 列。
 *
 * 源 load() 为 Promise.allSettled 两接口——映射为两条独立 useQuery：
 * 任一侧失败保留另一侧数据；0024 降级条优先取列表侧（源数组序）。
 * 刷新走 SyncRefreshButton(domain='token')：成功 toast 后按域重拉两视图。
 */

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  DataTable,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';

import {
  LP_PROJECT_ID,
  isServiceDown,
  tokenKeys,
  useTokenBankGroupQuery,
  useTokenListQuery,
  type BankGroupRow,
  type TokenRow,
} from '@myorg/modules/lp-portal/data-access';

import { formatMoney, formatTime } from './format';
import { ServiceDownAlert } from './service-down-alert';
import { SyncRefreshButton } from './sync-refresh-button';

/** BankGroupRow.tokens 内嵌行（子表数据源）。 */
type GroupTokenRow = BankGroupRow['tokens'][number];

const LBL = {
  eyebrow: 'DIRECTORY',
  title: 'Bank Token Directory',
  entity: 'Tokens',
  tabList: 'Token List',
  tabGroup: 'By Bank',
  emptyList:
    'No tokens in the directory yet — refresh to pull the latest bank tokens',
  emptyGroup: 'No bank groups yet',
  poolOpened: 'Pool Opened',
  notEnabled: 'Not Enabled',
  tokensCount: 'tokens',
  banksCount: 'banks',
} as const;

/** 数值文本（源 .num 类：等宽 + 表格数字对齐）。 */
function Num({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs tabular-nums">{children}</span>
  );
}

/**
 * Token 单元第一行：plain round tag tokenCode + 可选 symbol 副文本
 * （effect=plain 圆角等价 outline 变体 + rounded-full）。
 */
function TokenTag({ code, symbol }: { code: string; symbol?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Badge variant="outline" className="rounded-full font-mono">
        {code}
      </Badge>
      {symbol ? (
        <span className="text-xs text-muted-foreground">{symbol}</span>
      ) : null}
    </span>
  );
}

/** 我的状态：pooled → success「已开池」，否则 info plain「未开通」（01 §D3）。 */
function PooledStatus({ pooled }: { pooled: boolean }) {
  return pooled ? (
    <Badge>{LBL.poolOpened}</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      {LBL.notEnabled}
    </Badge>
  );
}

/** 视图一 7 列（列序/min-width 照源；金额列右对齐）。 */
const LIST_COLUMNS: ColumnDef<TokenRow & { id: string }>[] = [
  {
    accessorKey: 'tokenCode',
    header: 'Token',
    // 双行单元关掉外层 truncate 包裹，避免副行被压成单行
    meta: { overflow: 'none' },
    cell: ({ row }) => (
      <div className="min-w-0">
        <TokenTag code={row.original.tokenCode} symbol={row.original.symbol} />
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {row.original.tokenName || '-'}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'tokenNo',
    header: 'tokenNo',
    cell: ({ row }) => <Num>{row.original.tokenNo || '-'}</Num>,
  },
  {
    accessorKey: 'bankName',
    header: 'Bank',
    cell: ({ row }) => (
      <span>
        {row.original.bankName || '-'}
        {row.original.bankCode ? (
          <span className="text-muted-foreground">
            {' '}
            ({row.original.bankCode})
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: 'chain-anchor',
    header: 'Chain / Anchor Fiat',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.chainType || '-'} / {row.original.anchorFiat || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'minLiquidity',
    header: () => <div className="text-right">Min Liquidity</div>,
    cell: ({ row }) => (
      <Num>
        <span className="block text-right">
          {formatMoney(row.original.minLiquidity)}
        </span>
      </Num>
    ),
  },
  {
    accessorKey: 'pooled',
    header: 'My Status',
    cell: ({ row }) => <PooledStatus pooled={row.original.pooled} />,
  },
  {
    accessorKey: 'syncTime',
    header: 'Data Time',
    cell: ({ row }) => <Num>{formatTime(row.original.syncTime)}</Num>,
  },
];

/** 视图二银行分组子表 4 列（照源：Token / tokenNo / 区块链 / 锚定法币）。 */
const GROUP_COLUMNS: ColumnDef<GroupTokenRow & { id: string }>[] = [
  {
    accessorKey: 'tokenCode',
    header: 'Token',
    cell: ({ row }) => (
      <TokenTag code={row.original.tokenCode} symbol={row.original.symbol} />
    ),
  },
  {
    accessorKey: 'tokenNo',
    header: 'tokenNo',
    cell: ({ row }) => <Num>{row.original.tokenNo || '-'}</Num>,
  },
  {
    accessorKey: 'chainType',
    header: 'Blockchain',
    cell: ({ row }) => <span>{row.original.chainType || '-'}</span>,
  },
  {
    accessorKey: 'anchorFiat',
    header: 'Anchor Fiat',
    cell: ({ row }) => <span>{row.original.anchorFiat || '-'}</span>,
  },
];

/** 分组视图骨架占位（加载中与子表骨架同密度）。 */
const GROUP_SKELETON_ROWS = 5;

export function TokenListPage() {
  const queryClient = useQueryClient();
  const listQuery = useTokenListQuery(LP_PROJECT_ID);
  const groupQuery = useTokenBankGroupQuery(LP_PROJECT_ID);

  const groups = React.useMemo(
    () => groupQuery.data ?? [],
    [groupQuery.data],
  );

  // 源 down 语义：allSettled 数组序 [list, group]，先命中降级码者为准；
  // 非 0024 失败清除降级条（旧数据保留）。
  const down = React.useMemo(() => {
    for (const err of [listQuery.error, groupQuery.error]) {
      if (err != null && isServiceDown(err)) return { traceId: err.traceId };
    }
    return null;
  }, [listQuery.error, groupQuery.error]);

  // SyncRefreshButton 成功后重拉当前视图：invalidate 域内两条查询（含非激活侧，
  // 保证切 tab 即新数据）。分页不涉及（两视图均不分页全量）。
  const handleRefreshed = React.useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: tokenKeys.all(LP_PROJECT_ID),
    });
  }, [queryClient]);

  // 默认展开第一个银行（源 expandedBanks 仅在为空时以首个 bankId 初始化）
  const [expandedBanks, setExpandedBanks] = React.useState<string[]>([]);
  React.useEffect(() => {
    setExpandedBanks((prev) =>
      prev.length === 0 && groups.length > 0
        ? [String(groups[0].bankId)]
        : prev,
    );
  }, [groups]);

  // 面板 header 需按视图展示结果数/数据时间：Tabs 由非受控改受控（行为不变）
  const [view, setView] = React.useState<'list' | 'group'>('list');

  const tableData = React.useMemo(
    () => listQuery.data?.map((r) => ({ ...r, id: String(r.tokenId) })) ?? [],
    [listQuery.data],
  );

  // 激活视图的元信息（结果数按视图单位：list→tokens / group→banks）
  const activeQuery = view === 'list' ? listQuery : groupQuery;
  const activeCount =
    view === 'list'
      ? `${tableData.length} ${LBL.tokensCount}`
      : `${groups.length} ${LBL.banksCount}`;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {LBL.eyebrow}
        </div>
        <h1 className="text-xl font-semibold">{LBL.title}</h1>
      </div>

      {down && <ServiceDownAlert traceId={down.traceId} />}

      {/* §6.2 Table Panel：实体名 + 结果数 + 数据时间 + 页面级操作右置 */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              {LBL.entity}
            </div>
            {activeQuery.data != null && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {activeCount}
              </span>
            )}
            {activeQuery.dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatTime(activeQuery.dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <div className="shrink-0">
            <SyncRefreshButton domain="token" onRefreshed={handleRefreshed} />
          </div>
        </div>

        <Tabs
          value={view}
          onValueChange={(v) => setView(v as typeof view)}
          className="p-4"
        >
          <TabsList>
            <TabsTrigger value="list">{LBL.tabList}</TabsTrigger>
            <TabsTrigger value="group">{LBL.tabGroup}</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <DataTable
              columns={LIST_COLUMNS}
              data={tableData}
              isLoading={listQuery.isPending}
              emptyMessage={LBL.emptyList}
            />
          </TabsContent>

          <TabsContent value="group" className="mt-4">
            {groupQuery.isPending ? (
              <div className="space-y-3 py-2">
                {Array.from({ length: GROUP_SKELETON_ROWS }).map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="h-8 motion-safe:animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {LBL.emptyGroup}
              </div>
            ) : (
              <Accordion
                type="multiple"
                value={expandedBanks}
                onValueChange={setExpandedBanks}
              >
                {groups.map((g) => (
                  <AccordionItem key={g.bankId} value={String(g.bankId)}>
                    <AccordionTrigger className="px-1 py-3 hover:no-underline">
                      <span className="flex flex-wrap items-center gap-2 pr-4 text-left">
                        <span className="font-semibold">
                          {g.bankName} ({g.bankCode})
                        </span>
                        <Badge variant="secondary">
                          {g.tokens.length} {LBL.tokensCount}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <DataTable
                        columns={GROUP_COLUMNS}
                        data={g.tokens.map((t) => ({
                          ...t,
                          id: String(t.tokenId),
                        }))}
                        emptyMessage={LBL.emptyList}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
