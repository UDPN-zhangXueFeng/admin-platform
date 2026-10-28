'use client';

/**
 * Bank Query 域两页（plan/12 §5 P2：BP 原型 BankQueryPage.jsx /
 * BankDetailPage.jsx 行为规格落地；源 `views/bank/query.vue` + `query-detail.vue`）。
 *
 * 列表 /bank/query：
 * - 页头 + 筛选卡（Bank Name / BIC 服务端模糊，POST /bank/query/list）+
 *   服务端分页（2026-10-13 分页清单）。协议无排序/类型参数 → Bank Type
 *   筛选移除（列保留），表头静态，行序保持服务端下发序。
 * - 列序对齐原型：Bank Name（首列）/ Bank Type / BIC（原 'Bank Code/BIC'）
 *   / Official Website（恒 '-'，协议扩展 P1 占位）/ Tradable Tokens（chips）/
 *   Synced on (UTC+8) / Actions 'Details'。
 *
 * 详情 /bank/query/detail?id={bankId}：
 * - 页头（Back + bankName + 状态徽章 + meta BIC | Synced on）→ 页面级
 *   Tabs（basic/tokens，?tab= 写 URL、basic 缺省不写）；self 标识从页头移入
 *   basic 网格作 Bank Type 字段。
 * - tokens Tab：'Chain' 列头改 'BlockChain'；tokenCode/tokenNo 改 CopyableId。
 * - 保留：列表 Refresh（有意偏差）、toast + Retry、footnote、tokensOf 兜底。
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft } from 'lucide-react';

import {
  Badge,
  Button,
  DataTable,
  Input,
  Label,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  useBankQueryDetailQuery,
  useBankQueryListQuery,
  type CsToken,
} from '@myorg/modules/kissen-gateway/data-access';

import { CopyableId, ProtoStatusBadge } from './proto-ui';
import { formatUtc8 } from './proto-format';
import { DescField, DescGrid } from './desc-grid';
import { orDash } from './kit';
import { EmptyHint, MissingIdBlock } from './state-blocks';

const BANK_QUERY_LIST_PATH = '/bank/query';
const BANK_QUERY_DETAIL_PATH = '/bank/query/detail';

/** 源 tokensOf：tokenList JSON 串 → 可交易 token 摘要数组；空/坏值 → []。 */
function tokensOf(row: BankQueryRow): BankTokenSummary[] {
  const raw = row.tokenList;
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as BankTokenSummary[]) : [];
  } catch {
    return [];
  }
}

type BankTokenSummary = {
  tokenNo?: string;
  tokenCode: string;
  tokenName?: string;
  symbol?: string;
  chainType?: string;
  anchorFiat?: string;
};

/** DataTable 行（id 由 bankBic 兜底序号派生，仅作 row key）。 */
type BankQueryRow = {
  id: string;
  bankId?: number;
  /** 是否本行（03716c8：后端按 kissen.bank-code 比对下发；未下发按外部银行）。 */
  self?: boolean;
  bankName?: string;
  /** 银行编码(BIC)（62d1c33 合并列；原型术语 BIC）。 */
  bankBic?: string;
  tokenList?: string;
  pushTime?: number;
};

type BankQueryFilters = { keyword: string };

const BANK_QUERY_FILTER_DEFAULT: BankQueryFilters = {
  keyword: '',
};

export function BankQueryListPage() {
  const router = useRouter();
  const toast = useToast();
  const [filters, setFilters] = React.useState<BankQueryFilters>(BANK_QUERY_FILTER_DEFAULT);
  const [appliedFilters, setAppliedFilters] = React.useState<BankQueryFilters>(BANK_QUERY_FILTER_DEFAULT);
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const { data, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } =
    useBankQueryListQuery(
      React.useMemo(
        () => ({
          pageNum,
          pageSize,
          filter: {
            ...(appliedFilters.keyword.trim()
              ? { keyword: appliedFilters.keyword.trim() }
              : {}),
          },
        }),
        [pageNum, pageSize, appliedFilters],
      ),
    );

  // 列表失败 toast + Retry（tx/log 页口径；表格区保持空态，页面整体不阻断）。
  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load banks', {
        description:
          error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  const rows = React.useMemo<BankQueryRow[]>(
    () =>
      (data?.data ?? []).map((row, index) => ({
        ...row,
        id: row.bankBic || row.bankName || String(row.bankId ?? index),
      })),
    [data],
  );

  const hasFilter = filters.keyword !== '' || appliedFilters.keyword !== '';

  // Search/Reset 均回到第 1 页（服务端分页）。
  const handleFilterSubmit = () => {
    setAppliedFilters(filters);
    setPageNum(1);
  };
  const handleFilterReset = () => {
    setFilters(BANK_QUERY_FILTER_DEFAULT);
    setAppliedFilters(BANK_QUERY_FILTER_DEFAULT);
    setPageNum(1);
  };
  const columns = React.useMemo<ColumnDef<BankQueryRow>[]>(
    () => [
      {
        id: 'bankName',
        header: 'Bank Name',
        meta: { overflow: 'wrap', maxWidth: 220 },
        cell: ({ row }) => (
          <span className="font-medium">{orDash(row.original.bankName)}</span>
        ),
      },
      {
        // 03716c8：self → 「Own Bank」/「External Bank」（Element tag 映射：
        // success→default、info→outline）。
        id: 'bankType',
        header: 'Bank Type',
        cell: ({ row }) => (
          <Badge variant={row.original.self ? 'default' : 'outline'}>
            {row.original.self ? 'Own Bank' : 'External Bank'}
          </Badge>
        ),
      },
      {
        // 原型术语 BIC（62d1c33 合并列 bankBic）。
        id: 'bankBic',
        header: 'BIC',
        cell: ({ row }) => (
          <span className="font-mono">{orDash(row.original.bankBic)}</span>
        ),
      },
      {
        // 协议扩展 P1 占位：Kissen 下发 website 后自动亮起（源注释语义）。
        id: 'website',
        header: 'Official Website',
        cell: () => <span>-</span>,
      },
      {
        id: 'tokenList',
        header: 'Tradable Tokens',
        meta: { overflow: 'wrap', maxWidth: 360 },
        cell: ({ row }) => {
          /* Tradable Tokens 只展示后端下发的 token symbol。 */
          const tokens = tokensOf(row.original);
          if (tokens.length === 0) return <span>-</span>;
          return (
            <span className="inline-flex flex-wrap gap-1.5">
              {tokens.map((t, i) => {
                const label = t.symbol?.trim();
                return (
                  <span key={`${t.tokenCode}-${i}`} className="font-mono">
                    {label || '-'}
                  </span>
                );
              })}
            </span>
          );
        },
      },
      {
        id: 'pushTime',
        header: 'Synced on',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatUtc8(row.original.pushTime)}</span>
        ),
      },
      {
        // eafcab0：源行点击 openDetail → 操作列按钮（术语对齐原型 'Details'；
        // bankId 未下发时源行点击不可达详情，目标等价 '-'）。
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) =>
          row.original.bankId != null ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `${BANK_QUERY_DETAIL_PATH}?id=${row.original.bankId}`,
                )
              }
            >
              Details
            </Button>
          ) : (
            <span>-</span>
          ),
      },
    ],
    [router],
  );

  return (
    <div className="space-y-4">
      {/* 页头（原型 PageHeader：标题 + 一句话口径）。 */}
      <div>
        <h1 className="text-xl font-semibold">Bank Query</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Network banks this instance may transact with, and the tokens each
          bank can use.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleFilterSubmit();
        }}
        className="rounded-lg border border-border/60 bg-card p-4"
      >
        {/* 协议无 bankType 筛选参数 → 该筛选移除（列保留，plan 2026-10-13）。 */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <Label className="mb-1.5 block">Bank Name / BIC</Label>
            <Input
              value={filters.keyword}
              onChange={(e) =>
                setFilters((f) => ({ ...f, keyword: e.target.value }))
              }
              placeholder="Fuzzy match"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">Search</Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasFilter}
              onClick={handleFilterReset}
            >
              Reset
            </Button>
          </div>
        </div>
      </form>

      <section className="rounded-lg border border-border/60 bg-card">
        {/* §6.2 Table Panel 头条：实体名 + 结果数 + 刷新时间 + Refresh。 */}
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Banks
            </div>
            {data?.pagination && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {data.pagination.total} results
              </span>
            )}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatUtc8(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          {/* 源 el-button :loading="loading" @click="load" —— 仅刷新（有意偏差保留）。 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </div>

        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage="No banks found. Try adjusting the filters."
            pagination={
              data?.pagination
                ? {
                    page: data.pagination.page,
                    pageSize: data.pagination.pageSize,
                    total: data.pagination.total,
                    onPageChange: setPageNum,
                    onPageSizeChange: (n) => {
                      setPageSize(n);
                      setPageNum(1);
                    },
                  }
                : undefined
            }
          />
          {/* 源 footnote：可见集合与 DEC-05 过滤口径说明。 */}
          <p className="mt-4 text-xs text-muted-foreground">
            Banks visible here are those your bank is permitted to transact
            with. Token lists reflect the permissions granted to your bank.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────── 详情页 ─────────────────────────── */

/**
 * 网络银行详情页（registry bank.detail；/bank/query/detail?id={bankId}）。
 * 原型 2026-09-22 版式：页头（Back + bankName + 状态徽章 + meta 行 BIC |
 * Synced on）→ Tabs basic/tokens（?tab= 写 URL）→ 各 Tab 面板卡；self 标识
 * 移入 basic 网格作 Bank Type 字段。
 */
export function BankQueryDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawId = searchParams.get('id');
  const parsedId = rawId != null && rawId !== '' ? Number(rawId) : undefined;
  const bankId =
    parsedId != null && Number.isFinite(parsedId) ? parsedId : undefined;

  const { data, isLoading, isError, error, refetch } =
    useBankQueryDetailQuery(bankId);

  const toast = useToast();
  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load bank detail', {
        description:
          error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  // Tab 状态写 URL（原型同款：basic 缺省不占 query，id 参数保留）。
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'tokens' ? tabParam : 'basic';
  const handleTabChange = (next: string) => {
    const params = new URLSearchParams();
    if (rawId != null && rawId !== '') params.set('id', rawId);
    if (next !== 'basic') params.set('tab', next);
    router.replace(
      `${BANK_QUERY_DETAIL_PATH}?${params.toString()}`,
      { scroll: false },
    );
  };

  const tokenColumns = React.useMemo<ColumnDef<CsToken & { id: string }>[]>(
    () => [
      {
        id: 'tokenCode',
        header: 'Token Code',
        cell: ({ row }) => <CopyableId value={row.original.tokenCode} />,
      },
      {
        id: 'tokenName',
        header: 'Token Name',
        cell: ({ row }) => orDash(row.original.tokenName),
      },
      {
        id: 'symbol',
        header: 'Symbol',
        cell: ({ row }) => (
          <span className="font-mono">{orDash(row.original.symbol)}</span>
        ),
      },
      {
        // 原型术语 BlockChain（全站统一，原 'Chain'）。
        id: 'chainType',
        header: 'BlockChain',
        cell: ({ row }) => orDash(row.original.chainType),
      },
      {
        id: 'anchorFiat',
        header: 'Pegged Currency',
        cell: ({ row }) => orDash(row.original.anchorFiat),
      },
      {
        id: 'tokenNo',
        header: 'Token No.',
        cell: ({ row }) => <CopyableId value={row.original.tokenNo} />,
      },
    ],
    [],
  );

  const tokenRows = React.useMemo(
    () =>
      (data?.tokens ?? []).map((t, i) => ({
        ...t,
        id: t.tokenCode || String(i),
      })),
    [data],
  );

  if (bankId == null) {
    return (
      <MissingIdBlock
        message="Missing a bank ID. Unable to view details."
        backTo={BANK_QUERY_LIST_PATH}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 页头：Back + bankName + 状态徽章 + meta 行（BIC | Synced on）。 */}
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="outline"
          size="iconSm"
          aria-label="Back to bank query"
          onClick={() => router.push(BANK_QUERY_LIST_PATH)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-all text-xl font-semibold">
              {data ? data.bankName || 'Bank Detail' : 'Bank Detail'}
            </h1>
            {data ? (
              /* 源推送缓存状态：20 启用（Enabled），其余 Disabled。 */
              <ProtoStatusBadge
                label={data.status === 20 ? 'Enabled' : 'Disabled'}
                tone={data.status === 20 ? 'success' : 'muted'}
              />
            ) : null}
          </div>
          {data ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono">BIC: {orDash(data.bankBic)}</span>
              <span aria-hidden="true">|</span>
              <span className="tabular-nums">
                Synced on {formatUtc8(data.pushTime)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {data ? (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* Tabs 条独立于 Card（原型 §3.3）；计数为 tokens 实时条数。 */}
          <TabsList>
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            <TabsTrigger value="tokens">
              Tradable Tokens
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {data.tokens.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1：basic（self 标识在此作 Bank Type 字段，页头不再重复）。 */}
          <TabsContent value="basic" className="mt-4">
            <section className="rounded-lg border border-border/60 bg-card p-4">
              <h2 className="mb-2.5 text-sm font-semibold text-foreground">
                Basic Information
              </h2>
              <DescGrid cols={2}>
                <DescField label="Bank ID">
                  <span className="font-mono tabular-nums">
                    {orDash(data.bankId)}
                  </span>
                </DescField>
                {/* 62d1c33：原 Bank Code + BIC 两项合并为 bankBic；原型术语 BIC。 */}
                <DescField label="BIC">
                  <span className="font-mono">{orDash(data.bankBic)}</span>
                </DescField>
                <DescField label="Status">
                  <ProtoStatusBadge
                    label={data.status === 20 ? 'Enabled' : 'Disabled'}
                    tone={data.status === 20 ? 'success' : 'muted'}
                  />
                </DescField>
                <DescField label="Bank Type">
                  <Badge variant={data.self ? 'default' : 'outline'}>
                    {data.self ? 'Own Bank' : 'External Bank'}
                  </Badge>
                </DescField>
                {/* 协议扩展 P1 占位：Kissen 下发 website 后自动亮起。 */}
                <DescField label="Official Website">
                  <span>-</span>
                </DescField>
                <DescField label="Synced on">
                  <span className="tabular-nums">
                    {formatUtc8(data.pushTime)}
                  </span>
                </DescField>
              </DescGrid>
            </section>
          </TabsContent>

          {/* Tab 2：可交易 token 表（服务端按权限过滤后组装）。 */}
          <TabsContent value="tokens" className="mt-4">
            <section className="rounded-lg border border-border/60 bg-card">
              <div className="border-b border-border/50 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Tradable Tokens
                  <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">
                    {data.tokens.length}
                  </span>
                </h2>
              </div>
              <div className="p-4">
                <DataTable
                  columns={tokenColumns}
                  data={tokenRows}
                  emptyMessage="No tradable tokens for this bank. No token permissions are currently granted to this bank."
                />
              </div>
            </section>
          </TabsContent>
        </Tabs>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : isError ? null : (
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <EmptyHint text="Bank not found (possibly not pushed, or no permission to view)." />
        </section>
      )}
    </div>
  );
}
