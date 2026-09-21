'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  CopyableEllipsisText,
  DataTable,
  Skeleton,
  useToast,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  useBankQueryDetailQuery,
  useBankQueryListQuery,
  type CsToken,
} from '@myorg/modules/kissen-gateway/data-access';

import { DescField, DescGrid } from './desc-grid';
import { formatTime, orDash } from './kit';
import { EmptyHint, MissingIdBlock } from './state-blocks';


/**
 * 银行查询页（源 `views/bank/query.vue`：gw_bank_info 权限可见集合只读表，
 * 仅刷新按钮，无搜索/分页）。路由 /bank/query（registry：bank → list，
 * slug 'query' 经 page.tsx 推导为 'list'）。
 *
 * - 服务端状态 TanStack Query；接口失败沿用 tx/log 页口径（toast +
 *   action Retry，表格区保持空态），页面整体不阻断。
 * - tokenList 为 JSON 串：解析失败/非数组 → 该行单格回落占位（源
 *   tokensOf try-catch 语义，fail-safe 不崩溃）。
 * - 时间 en-US 24h（kit.formatTime，英文-only 契约）；官网为协议扩展
 *   P1 占位列，恒 '-'。
 * - 62d1c33：Bank Code + BIC 两列合并（bankBic），Currency System 列随货币
 *   系统字段退役删除；a9dc10e：可交易 token 改显 tokenCode（e308f0b 的
 *   tokenName 口径作废），列头 Bank Code/BIC、Synced On 全站对齐。
 */

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
  /** 银行编码(BIC)（2026-09-08 合并列，62d1c33）。 */
  bankBic?: string;
  tokenList?: string;
  pushTime?: number;
};


/** 源列头（62d1c33 合并列；a9dc10e 起列头 Bank Code/BIC、Synced On）。 */
const BANK_QUERY_HEADERS = [
  'Bank Type',
  'Bank Name',
  'Bank Code/BIC',
  'Official Website',
  'Tradable Tokens',
  'Synced On',
] as const;

export function BankQueryListPage() {
  const router = useRouter();
  const toast = useToast();
  const { data, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } =
    useBankQueryListQuery();

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

  const tableData = React.useMemo<BankQueryRow[]>(
    () =>
      (data ?? []).map((row, index) => ({
        ...row,
        id: row.bankBic || row.bankName || String(row.bankId ?? index),
      })),
    [data],
  );

  const columns = React.useMemo<ColumnDef<BankQueryRow>[]>(
    () => [
      {
        // 03716c8 替换原 Bank ID 列：self → success「本行」/ info「外部银行」
        //（Element tag 映射：success→default、info→outline，与 BANK_ONBOARD_STATUS 同口径）。
        id: 'bankType',
        header: BANK_QUERY_HEADERS[0],
        cell: ({ row }) => (
          <Badge variant={row.original.self ? 'default' : 'outline'}>
            {row.original.self ? 'Own Bank' : 'External Bank'}
          </Badge>
        ),
      },
      {
        id: 'bankName',
        header: BANK_QUERY_HEADERS[1],
        cell: ({ row }) => orDash(row.original.bankName),
      },
      {
        // 62d1c33：原 Bank Code + BIC 两列合并（bankBic 单字段）。
        id: 'bankBic',
        header: BANK_QUERY_HEADERS[2],
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.bankBic}
            emptyText="-"
            maxWidth={180}
            className="font-mono"
          />
        ),
      },
      {
        // 协议扩展 P1 占位：Kissen 下发 website 后自动亮起（源注释语义）。
        id: 'website',
        header: BANK_QUERY_HEADERS[3],
        cell: () => <span>-</span>,
      },
      {
        id: 'tokenList',
        header: BANK_QUERY_HEADERS[4],
        meta: { overflow: 'wrap', maxWidth: 360 },
        cell: ({ row }) => {
          /* a9dc10e：标签改 tokenCode + 中间省略可复制（源 CopyText；tooltip 三段随 tokenName 口径作废删除）。 */
          const tokens = tokensOf(row.original);
          if (tokens.length === 0) return <span>-</span>;
          return (
            <span className="inline-flex flex-wrap gap-1.5">
              {tokens.map((t, i) => (
                <CopyableEllipsisText
                  key={`${t.tokenCode}-${i}`}
                  value={t.tokenCode}
                  emptyText="-"
                  maxWidth={160}
                  truncate="middle"
                  className="font-mono"
                />
              ))}
            </span>
          );
        },
      },
      {
        id: 'pushTime',
        header: BANK_QUERY_HEADERS[5],
        cell: ({ row }) => (
          <span className="tabular-nums">{formatTime(row.original.pushTime)}</span>
        ),
      },
      {
        // eafcab0：源行点击 openDetail → 操作列 Detail 按钮（bankId 未下发时
        // 源行点击不可达详情，目标等价 '-'）。
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) =>
          row.original.bankId != null ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                router.push(`/bank/query/detail?id=${row.original.bankId}`)
              }
            >
              View
            </Button>
          ) : (
            <span>-</span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        {/* §6.2 Table Panel 头条：实体名 + 结果数 + 刷新时间 + 页面级操作右置。 */}
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Banks
            </div>
            {data && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {tableData.length} results
              </span>
            )}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          {/* 源 el-button :loading="loading" @click="load" —— 仅刷新，无其他动作。 */}
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
            data={tableData}
            isLoading={isLoading}
            emptyMessage="No banks pushed yet"
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

/* ================================================================== */
/* 详情页（eafcab0 源 `views/bank/query-detail.vue`）                  */
/* ================================================================== */

/**
 * 网络银行详情页（registry bank.detail；/bank/query/detail?id={bankId}）。
 * 源布局：bankName + self tag（Own Bank/External Bank）；基本信息 2 列卡 +
 * 可交易 token 表 7 列（eafcab0 起服务端结构化下发，替代 tokenList JSON 串）。
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

  const tokenColumns = React.useMemo<ColumnDef<CsToken & { id: string }>[]>(
    () => [
      {
        id: 'tokenCode',
        header: 'Token Code',
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.tokenCode}
            emptyText="-"
            className="font-mono"
          />
        ),
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
        id: 'chainType',
        header: 'Chain',
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
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.tokenNo}
            emptyText="-"
            className="font-mono"
          />
        ),
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
        backTo="/bank/query"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* §6.3 Hero：bankName + self tag（与列表 Bank Type 列同口径）+ Back。 */}
      <section className="rounded-lg border border-border/60 bg-card panel-pad">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* a9dc10e：eyebrow「Bank Query」小字移除，仅留 bankName 主标题。 */}
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              {data ? data.bankName || 'Bank Detail' : 'Bank Detail'}
            </h1>
            {data ? (
              <Badge variant={data.self ? 'default' : 'outline'}>
                {data.self ? 'Own Bank' : 'External Bank'}
              </Badge>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/bank/query')}
          >
            Back
          </Button>
        </div>
      </section>

      {data ? (
        <>
          {/* 卡 1：基本信息（源 column2）。 */}
          <section className="rounded-lg border border-border/60 bg-card panel-pad">
            <h2 className="mb-2.5 text-sm font-semibold text-foreground">
              Basic Information
            </h2>
            <DescGrid cols={2}>
              <DescField label="Bank ID">
                <span className="font-mono tabular-nums">
                  {orDash(data.bankId)}
                </span>
              </DescField>
              {/* 62d1c33：原 Bank Code + BIC 两项合并为 bankBic；Currency System 项删除。 */}
              <DescField label="Bank Code/BIC">
                <span className="font-mono">{orDash(data.bankBic)}</span>
              </DescField>
              <DescField label="Status">
                {/* 源推送缓存状态：20 启用（Enabled），其余 Disabled。 */}
                <Badge variant={data.status === 20 ? 'default' : 'outline'}>
                  {data.status === 20 ? 'Enabled' : 'Disabled'}
                </Badge>
              </DescField>
              <DescField label="Synced On">
                <span className="font-mono">{formatTime(data.pushTime)}</span>
              </DescField>
            </DescGrid>
          </section>

          {/* 卡 2：可交易 token 表（源 el-table 7 列，服务端按权限过滤后组装）。 */}
          <section className="rounded-lg border border-border/60 bg-card">
            <div className="border-b border-border/50 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {`Tradable Tokens (${data.tokens.length})`}
              </h2>
            </div>
            <div className="p-4">
              <DataTable
                columns={tokenColumns}
                data={tokenRows}
                emptyMessage="No tradable tokens for this bank"
              />
            </div>
          </section>
        </>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : isError ? null : (
        <section className="rounded-lg border border-border/60 bg-card panel-pad">
          <EmptyHint text="Bank not found (possibly not pushed, or no permission to view)." />
        </section>
      )}
    </div>
  );
}
