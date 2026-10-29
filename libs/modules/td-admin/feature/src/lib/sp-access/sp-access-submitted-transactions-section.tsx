'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import {
  Button,
  CopyableEllipsisText,
  DataTable,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { useSpAccessSubmittedTransactionsQuery } from '@myorg/modules/td-admin/data-access';
import type {
  SpAccessDetail,
  SpAccessSubmittedTransaction,
} from '@myorg/modules/td-admin/data-access';
import {
  EMPTY_FIELD_VALUE,
  formatAmount,
  formatTimestamp,
} from './formatters';
import { SpAccessStatusBadge } from './sp-access-status-badge';
import {
  SUBMITTED_TX_STATUS_FILTER_VALUES,
  TX_DATA_SOURCE_VALUES,
  TX_TYPE_VALUES,
} from './constants';

/**
 * 详情页「提交的交易」Tab（上游 SubmittedTransactionsSection）：
 * 筛选（交易类型/代币/提交方式/状态/交易时间区间/交易哈希）+ 列表。
 */

const ALL_VALUE = '';
const PAGE_SIZE = 10;

interface DraftFilters {
  txType: string;
  tokenCode: string;
  submissionMethod: string;
  status: string;
  txStartDate: string;
  txEndDate: string;
  txHash: string;
}

const EMPTY_DRAFT: DraftFilters = {
  txType: ALL_VALUE,
  tokenCode: ALL_VALUE,
  submissionMethod: ALL_VALUE,
  status: ALL_VALUE,
  txStartDate: '',
  txEndDate: '',
  txHash: '',
};

function dateToRangeMs(from: string, to: string): {
  txStartTime?: number;
  txEndTime?: number;
} {
  if (!from && !to) return {};
  return {
    ...(from ? { txStartTime: startOfDay(parseISO(from)).getTime() } : {}),
    ...(to ? { txEndTime: endOfDay(parseISO(to)).getTime() } : {}),
  };
}

export function SpAccessSubmittedTransactionsSection({
  detail,
  spCode,
}: {
  detail: SpAccessDetail;
  spCode?: string;
}) {
  const effectiveSpCode = spCode || detail.spCode || '';
  const t = useTranslations('modules.sp-access');
  const tCommon = useTranslations('common');

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);
  const [draft, setDraft] = React.useState<DraftFilters>(EMPTY_DRAFT);
  const [applied, setApplied] = React.useState<DraftFilters>(EMPTY_DRAFT);

  const tokenCodeOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    (detail.tdList ?? []).forEach((token) => {
      // 上游取 tokenCode>stablecoinCode>tdCode>tokenName>tdName 首个非空为 value
      const value = [
        token.tokenCode,
        token.stablecoinCode,
        token.tdCode,
        token.tokenName,
        token.tdName,
      ]
        .map((field) => String(field ?? '').trim())
        .find(Boolean);
      if (!value || seen.has(value)) return;
      seen.add(value);
      const name = String(token.tdName || token.tokenName || '').trim();
      const blockchain = String(token.blockchainName ?? '').trim();
      const label = name
        ? blockchain
          ? `${name} (${blockchain})`
          : name
        : value;
      options.push({ label, value });
    });
    return options;
  }, [detail.tdList]);

  const { data, isLoading, error } = useSpAccessSubmittedTransactionsQuery({
    spCode: effectiveSpCode,
    pageNum: page,
    pageSize,
    tokenCode: applied.tokenCode === ALL_VALUE ? '' : applied.tokenCode,
    txType: applied.txType === ALL_VALUE ? '' : applied.txType,
    dataSource:
      applied.submissionMethod === ALL_VALUE ? '' : applied.submissionMethod,
    status: applied.status === ALL_VALUE ? '' : applied.status,
    txHash: applied.txHash,
    ...dateToRangeMs(applied.txStartDate, applied.txEndDate),
  });

  React.useEffect(() => {
    if (error) toast.error(error instanceof Error ? error.message : t('sp_access_0125'));
  }, [error, t]);

  const rows = data?.rows ?? [];

  const columns = React.useMemo<ColumnDef<SpAccessSubmittedTransaction & { id: string }>[]>(
    () => [
      {
        accessorKey: 'txType',
        header: t('sp_access_0060'),
        cell: ({ getValue }) => {
          const raw = String(getValue() ?? '');
          return (TX_TYPE_VALUES as readonly string[]).includes(raw)
            ? t(`tx_type_${raw}`)
            : EMPTY_FIELD_VALUE;
        },
      },
      {
        accessorKey: 'amount',
        header: t('transaction_flow_005'),
        cell: ({ getValue }) =>
          formatAmount(getValue() as string | number | undefined),
      },
      {
        accessorKey: 'tokenName',
        header: t('transaction_flow_0018'),
        cell: ({ getValue }) => (getValue() as string) || EMPTY_FIELD_VALUE,
      },
      {
        accessorKey: 'tokenType',
        header: t('tokenized_deposit_0062'),
        cell: ({ getValue }) => {
          const raw = Number(getValue());
          return raw ? t(`token_type_${raw}`) : EMPTY_FIELD_VALUE;
        },
      },
      {
        accessorKey: 'dataSource',
        header: t('sp_access_0079'),
        cell: ({ getValue }) => {
          const raw = String(getValue() ?? '');
          return (TX_DATA_SOURCE_VALUES as readonly string[]).includes(raw)
            ? t(`submission_method_${raw}`)
            : EMPTY_FIELD_VALUE;
        },
      },
      {
        accessorKey: 'txTime',
        header: t('sp_access_0061'),
        cell: ({ getValue }) =>
          formatTimestamp(getValue() as number | undefined),
      },
      {
        accessorKey: 'txHash',
        header: t('transaction_flow_007'),
        enableSorting: false,
        cell: ({ getValue }) => (
          <CopyableEllipsisText
            value={getValue() as string}
            truncate="middle"
            maxWidth={260}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <SpAccessStatusBadge kind="txStatus" status={Number(getValue())} />
        ),
      },
      {
        id: 'actions',
        header: t('PUB_Action'),
        enableSorting: false,
        cell: () => EMPTY_FIELD_VALUE,
      },
    ],
    [t],
  );

  const setDraftField = (field: keyof DraftFilters, value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-6">
        <div className="text-base font-semibold">{t('sp_access_0073')}</div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('sp_access_0075').replace('****', detail.spName || EMPTY_FIELD_VALUE)}
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('sp_access_0060')}</span>
            <Select value={draft.txType} onValueChange={(value) => setDraftField('txType', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                {Array.from(TX_TYPE_VALUES).map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {t(`tx_type_${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('transaction_flow_0018')}</span>
            <Select
              value={draft.tokenCode}
              onValueChange={(value) => setDraftField('tokenCode', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                {tokenCodeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('sp_access_0079')}</span>
            <Select
              value={draft.submissionMethod}
              onValueChange={(value) => setDraftField('submissionMethod', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                {Array.from(TX_DATA_SOURCE_VALUES).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`submission_method_${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('PUB_Status')}</span>
            <Select value={draft.status} onValueChange={(value) => setDraftField('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                {SUBMITTED_TX_STATUS_FILTER_VALUES.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {t(`common_task_status_${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('sp_access_0061')}</span>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label={t('sp_access_0142')}
                value={draft.txStartDate}
                onChange={(event) => setDraftField('txStartDate', event.target.value)}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                aria-label={t('sp_access_0143')}
                value={draft.txEndDate}
                onChange={(event) => setDraftField('txEndDate', event.target.value)}
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('transaction_flow_007')}</span>
            <Input
              value={draft.txHash}
              placeholder={t('transaction_flow_007')}
              onChange={(event) => setDraftField('txHash', event.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setApplied(EMPTY_DRAFT);
              setPage(1);
              setPageSize(PAGE_SIZE);
            }}
          >
            {t('PUB_Reset')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setApplied(draft);
              setPage(1);
            }}
          >
            {t('PUB_Query')}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows.map((row) => ({
          ...row,
          id: `${row.txHash || 'no-hash'}-${row.createTime || 0}-${row.txTime || 0}-${row.tokenName || 'unknown'}`,
        }))}
        isLoading={isLoading}
        emptyMessage={tCommon('noData')}
        pagination={{
          page,
          pageSize: data?.pageSize ?? pageSize,
          total: data?.total ?? 0,
          onPageChange: setPage,
          onPageSizeChange: (nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          },
        }}
      />
    </div>
  );
}
