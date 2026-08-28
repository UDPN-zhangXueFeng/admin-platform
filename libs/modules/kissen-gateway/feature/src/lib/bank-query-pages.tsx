'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';

import { Badge, Button, DataTable, useToast } from '@myorg/shared/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';

import { useBankQueryListQuery } from '@myorg/modules/kissen-gateway/data-access';

import { formatTime, orDash } from './kit';
import { PageHead } from './page-head';

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
function currencySystemText(row: BankQueryRow): string {
  if (row.currencySystemType == null || row.currencySystemType === 0) {
    return '-';
  }
  const type =
    CURRENCY_SYSTEM_TYPE_TEXT[row.currencySystemType] ??
    `Unknown (${row.currencySystemType})`;
  return row.currencySystemName ? `${type} · ${row.currencySystemName}` : type;
}

/** 源列头（Bank ID/银行名称/银行编码/BIC/货币系统/官网/可交易 token/推送时间）。 */
const BANK_QUERY_HEADERS = [
  'Bank ID',
  'Bank Name',
  'Bank Code',
  'BIC',
  'Currency System',
  'Official Website',
  'Tradable Tokens',
  'Push Time',
] as const;

export function BankQueryListPage() {
  const toast = useToast();
  const { data, isLoading, isFetching, isError, error, refetch } =
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
        id: 'bankId',
        header: BANK_QUERY_HEADERS[0],
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.bankId ?? '-'}</span>
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
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHead variant="banner" eyebrow="BANK QUERY" title="Bank Query">
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
      </PageHead>

      <div className="rounded-lg border-border/60 bg-card p-4 text-card-foreground shadow-float">
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
        />
        {/* 源 footnote：可见集合与 DEC-05 过滤口径说明。 */}
        <p className="mt-3 text-xs text-muted-foreground">
          Network bank list (permission-visible set pushed by Kissen); token
          summaries are filtered by this row&apos;s transaction permissions.
        </p>
      </div>
    </div>
  );
}
