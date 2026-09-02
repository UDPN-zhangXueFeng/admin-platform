'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  DataTable,
  Skeleton,
  useToast,
} from '@myorg/shared/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  useBankQueryDetailQuery,
  useBankQueryListQuery,
  type CsToken,
} from '@myorg/modules/kissen-gateway/data-access';

import { DescField, DescGrid } from './desc-grid';
import { formatTime, orDash } from './kit';
import { PageHead } from './page-head';
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
 * - 39c8a2b 增列：BIC 列头「BIC/SWIFT」→「BIC」；新增 Currency System 列
 *   （GW-16 货币系统重构值域，源 csText）。
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

/** 源 tag 文案：`symbol || tokenCode · tokenCode`（symbol 缺失时避免重复显示；'·' 为符号非文案）。 */
function tokenTagText(t: BankTokenSummary): string {
  return `${t.symbol || t.tokenCode} · ${t.tokenCode}`;
}

/** 源 tooltip 三段：tokenNo（'待分配' 英化为 'Pending'）/chainType/anchorFiat。 */
function tokenTooltipText(t: BankTokenSummary): string {
  return `tokenNo:${t.tokenNo || 'Pending'} · chain:${t.chainType || '-'} · anchor:${t.anchorFiat || '-'}`;
}

type BankTokenSummary = {
  tokenNo?: string;
  tokenCode: string;
  symbol?: string;
  chainType?: string;
  anchorFiat?: string;
};

/** DataTable 行（id 由 bankCode 兜底序号派生，仅作 row key）。 */
type BankQueryRow = {
  id: string;
  bankId?: number;
  /** 是否本行（03716c8：后端按 kissen.bank-code 比对下发；未下发按外部银行）。 */
  self?: boolean;
  bankName?: string;
  bankCode?: string;
  bic?: string;
  /** 货币系统类型（GW-16 值域）：0 未填 / 1 区块链 / 2 传统 / 3 其他。 */
  currencySystemType?: number;
  /** 货币系统名称（类型已知但名称未下发时仅显类型）。 */
  currencySystemName?: string;
  tokenList?: string;
  pushTime?: number;
};

/** 货币系统类型文案（GW-16 值域）：1=Blockchain / 2=Traditional / 3=Other。 */
const CURRENCY_SYSTEM_TYPE_TEXT: Record<number, string> = {
  1: 'Blockchain',
  2: 'Traditional',
  3: 'Other',
};

/** 源 csText：type 0/null 未填 → '-'；有名称「Type · Name」；未知码 `Unknown (n)`；无名称只显类型。 */
function currencySystemText(
  row: Pick<BankQueryRow, 'currencySystemType' | 'currencySystemName'>,
): string {
  if (row.currencySystemType == null || row.currencySystemType === 0) {
    return '-';
  }
  const type =
    CURRENCY_SYSTEM_TYPE_TEXT[row.currencySystemType] ??
    `Unknown (${row.currencySystemType})`;
  return row.currencySystemName ? `${type} · ${row.currencySystemName}` : type;
}

/** 源列头（03716c8 起 Bank Type/银行名称/银行编码/BIC/货币系统/官网/可交易 token/推送时间）。 */
const BANK_QUERY_HEADERS = [
  'Bank Type',
  'Bank Name',
  'Bank Code',
  'BIC',
  'Currency System',
  'Official Website',
  'Tradable Tokens',
  'Push Time',
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
        id: row.bankCode || row.bankName || String(row.bankId ?? index),
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
        id: 'bankCode',
        header: BANK_QUERY_HEADERS[2],
        cell: ({ row }) => (
          <span className="font-mono">{orDash(row.original.bankCode)}</span>
        ),
      },
      {
        id: 'bic',
        header: BANK_QUERY_HEADERS[3],
        cell: ({ row }) => (
          <span className="font-mono">{orDash(row.original.bic)}</span>
        ),
      },
      {
        // 39c8a2b 新增（GW-16）：货币系统「Type · Name」，未填/未知值域见 currencySystemText。
        id: 'currencySystem',
        header: BANK_QUERY_HEADERS[4],
        cell: ({ row }) => currencySystemText(row.original),
      },
      {
        // 协议扩展 P1 占位：Kissen 下发 website 后自动亮起（源注释语义）。
        id: 'website',
        header: BANK_QUERY_HEADERS[5],
        cell: () => <span>-</span>,
      },
      {
        id: 'tokenList',
        header: BANK_QUERY_HEADERS[6],
        meta: { overflow: 'wrap', maxWidth: 360 },
        cell: ({ row }) => {
          const tokens = tokensOf(row.original);
          if (tokens.length === 0) return <span>-</span>;
          return (
            <TooltipProvider delayDuration={200}>
              <span className="inline-flex flex-wrap gap-1.5">
                {tokens.map((t, i) => (
                  <Tooltip key={`${t.tokenCode}-${i}`}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className="cursor-default font-mono"
                      >
                        {tokenTagText(t)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="font-mono text-xs">
                      {tokenTooltipText(t)}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </span>
            </TooltipProvider>
          );
        },
      },
      {
        id: 'pushTime',
        header: BANK_QUERY_HEADERS[7],
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
              Detail
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
      <PageHead variant="banner" eyebrow="BANK QUERY" title="Bank Query" />

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
            Network bank list (permission-visible set pushed by Kissen); token
            summaries are filtered by this row&apos;s transaction permissions.
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
        header: 'tokenCode',
        cell: ({ row }) => (
          <span className="font-mono">{orDash(row.original.tokenCode)}</span>
        ),
      },
      {
        id: 'csTokenCode',
        header: 'csTokenCode (currency system)',
        cell: ({ row }) => (
          <span className="font-mono">{orDash(row.original.csTokenCode)}</span>
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
        header: 'Anchored Fiat',
        cell: ({ row }) => orDash(row.original.anchorFiat),
      },
      {
        id: 'tokenNo',
        header: 'Token No.',
        cell: ({ row }) => (
          <span className="font-mono">{orDash(row.original.tokenNo)}</span>
        ),
      },
    ],
    [],
  );

  const tokenRows = React.useMemo(
    () =>
      (data?.tokens ?? []).map((t, i) => ({
        ...t,
        id: t.tokenCode || t.csTokenCode || String(i),
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
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bank Query
              </div>
              <h1 className="text-xl font-semibold leading-7 text-foreground">
                {data ? data.bankName || 'Bank Detail' : 'Bank Detail'}
              </h1>
            </div>
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
          {/* 卡 1：基本信息（源 column2；货币系统口径与列表 csText 一致）。 */}
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
              <DescField label="Bank Code">
                <span className="font-mono">{orDash(data.bankCode)}</span>
              </DescField>
              <DescField label="BIC">
                <span className="font-mono">{orDash(data.bic)}</span>
              </DescField>
              <DescField label="Currency System">
                {currencySystemText(data)}
              </DescField>
              <DescField label="Status">
                {/* 源推送缓存状态：20 启用（Enabled），其余 Disabled。 */}
                <Badge variant={data.status === 20 ? 'default' : 'outline'}>
                  {data.status === 20 ? 'Enabled' : 'Disabled'}
                </Badge>
              </DescField>
              <DescField label="Version">
                <span className="tabular-nums">{orDash(data.version)}</span>
              </DescField>
              <DescField label="Push Time">
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
