/**
 * 计息交易列表页 — Post / Reset action + Spin loading。
 *
 * 迁移自 td-manage `src/pages/interest/transactions/index.tsx`（237 行）。
 */
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Button,
  DataTable,
  type DataTablePagination,
} from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';
import { toast } from '@myorg/shared/ui-toast';

import type { TokenBill } from '@myorg/modules/interest/data-access';
import {
  useBlockchainOptions,
  usePostTransaction,
  useRetryTransaction,
  useStablecoinOptions,
  useTokenBillList,
} from '@myorg/modules/interest/data-access';
import {
  ALL_VALUE,
  FEE_TYPE_OPTIONS,
  INTEREST_PERMISSIONS,
  TRANSACTION_STATUS_OPTIONS,
} from '@myorg/modules/interest/util';
import { TransactionStatusBadge } from '@myorg/modules/interest/ui';

const PAGE_SIZE = 10;

interface TxListFormValues {
  postTimeRange: [string, string] | [];
  tokenId: string;
  blockchainId: string;
  feeType: string;
  status: string;
}

const EMPTY_FORM: TxListFormValues = {
  postTimeRange: [],
  tokenId: ALL_VALUE,
  blockchainId: ALL_VALUE,
  feeType: ALL_VALUE,
  status: ALL_VALUE,
};

export function TransactionsListPage() {
  const t = useTranslations('modules.interest');
  const tc = useTranslations('common');
  const router = useRouter();
  const { hasLimit } = useAuth();

  const { data: tokenOptions } = useStablecoinOptions();
  const { data: blockchainOptions } = useBlockchainOptions();

  const [pagination, setPagination] = React.useState<DataTablePagination>({
    pageNum: 1,
    pageSize: PAGE_SIZE,
  });

  const form = useForm<TxListFormValues>({ defaultValues: EMPTY_FORM });
  const filters = form.watch();

  const queryFilters = React.useMemo(() => {
    const f: Record<string, unknown> = {};
    if (filters.postTimeRange.length === 2) {
      f.postStartTime = filters.postTimeRange[0];
      f.postEndTime = filters.postTimeRange[1];
    }
    if (filters.tokenId !== ALL_VALUE) f.tokenId = filters.tokenId;
    if (filters.blockchainId !== ALL_VALUE) f.blockchainId = filters.blockchainId;
    if (filters.feeType !== ALL_VALUE) f.feeType = filters.feeType;
    if (filters.status !== ALL_VALUE) f.status = filters.status;
    return f;
  }, [filters]);

  const { data, isLoading, refetch } = useTokenBillList({
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize,
    filters: queryFilters as never,
  });

  const postMutation = usePostTransaction();
  const retryMutation = useRetryTransaction();
  const [spinning, setSpinning] = React.useState(false);

  const columns: ColumnDef<TokenBill>[] = [
    { id: 'index', header: tc('PUB_Index'), accessorKey: 'interestRuleId', size: 60 },
    {
      id: 'postTime',
      header: t('interest_0067'),
      accessorKey: 'postTime',
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(Number(v)).toLocaleString() : '-';
      },
    },
    { id: 'tokenName', header: t('interest_0062'), accessorKey: 'tokenName' },
    { id: 'blockchainName', header: tc('PUB_Blockchain'), accessorKey: 'blockchainName' },
    {
      id: 'feeType',
      header: t('interest_0080'),
      accessorKey: 'feeType',
      cell: ({ getValue }) => t(`interest_list_feeType_${getValue<number>()}`),
    },
    {
      id: 'postRealityCount',
      header: t('interest_0075'),
      accessorKey: 'postRealityCount',
      cell: ({ getValue, row }) => `${getValue<number>()} ${row.original.symbol}`,
    },
    {
      id: 'postAccruedCount',
      header: t('interest_0066'),
      accessorKey: 'postAccruedCount',
      cell: ({ getValue, row }) => `${getValue<number>()} ${row.original.symbol}`,
    },
    {
      id: 'status',
      header: tc('PUB_Status'),
      accessorKey: 'status',
      cell: ({ getValue }) => <TransactionStatusBadge status={getValue<number>()} />,
    },
  ];

  const handleReset = () => form.reset(EMPTY_FORM);

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">{t('interest_0076')}</h3>

      <div className="grid grid-cols-5 gap-4 mb-4">
        <FormDatePicker
          name="postTimeRange"
          label={t('interest_00113')}
          control={form.control}
          mode="range"
        />
        <FormSelect
          name="tokenId"
          label={t('interest_0062')}
          control={form.control}
          options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(tokenOptions ?? [])]}
          allValue={ALL_VALUE}
        />
        <FormSelect
          name="blockchainId"
          label={tc('PUB_Blockchain')}
          control={form.control}
          options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(blockchainOptions ?? [])]}
          allValue={ALL_VALUE}
        />
        <FormSelect
          name="feeType"
          label={t('interest_0080')}
          control={form.control}
          options={FEE_TYPE_OPTIONS.map(o => ({ label: o.label, value: o.value === '' ? ALL_VALUE : o.value }))}
          allValue={ALL_VALUE}
        />
        <FormSelect
          name="status"
          label={tc('PUB_Status')}
          control={form.control}
          options={TRANSACTION_STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value === '' ? ALL_VALUE : o.value }))}
          allValue={ALL_VALUE}
        />
      </div>

      <div className="flex justify-between mb-4">
        <Button variant="outline" onClick={handleReset}>{tc('PUB_Reset')}</Button>
      </div>

      <DataTable
        columns={columns}
        data={(data?.rows ?? []).map(row => ({ ...row, id: String(row.interestRuleId) }))}
        pagination={{ ...pagination, total: data?.page?.total ?? 0 }}
        onPaginationChange={setPagination}
        isLoading={isLoading || spinning}
        actions={[
          {
            key: 'View',
            label: tc('Router_0015_3_1'),
            limit: INTEREST_PERMISSIONS.VIEW_TRANSACTION,
            disabled: () => false,
          },
          {
            key: 'Post',
            label: tc('Router_0015_3_4'),
            limit: INTEREST_PERMISSIONS.POST_TRANSACTION,
            disabled: (row: TokenBill) => row.status !== 1,
            confirmText: (row: TokenBill) =>
              t('interest_0093').replace('${token}', row.tokenName),
          },
          {
            key: 'Reset',
            label: tc('Router_0015_3_2'),
            limit: INTEREST_PERMISSIONS.RETRY_TRANSACTION,
            disabled: (row: TokenBill) => row.status !== 40,
          },
        ]}
        onAction={async (key, row) => {
          const r = row as TokenBill;
          switch (key) {
            case 'View':
              router.push(`/interest/transactions/view?id=${r.tokenBillId}`);
              break;
            case 'Post':
              await postMutation.mutateAsync({ tokenBillId: r.tokenBillId });
              break;
            case 'Reset': {
              setSpinning(true);
              try {
                await retryMutation.mutateAsync({ tokenBillId: r.tokenBillId });
                await refetch();
                toast.success(tc('PUB_Success').replace('****', tc('PUB_Reset')));
              } finally {
                setSpinning(false);
              }
              break;
            }
          }
        }}
      />
    </div>
  );
}
