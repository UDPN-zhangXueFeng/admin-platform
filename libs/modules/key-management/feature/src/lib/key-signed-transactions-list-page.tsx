/**
 * KeySignedTransactionsListPage — paginated list with search, filters, and detail navigation.
 *
 * Architecture:
 * - Server-state (list data)    → TanStack Query via useKeySignedTransactionsQuery
 * - Reference data              → TanStack Query for key-services, stablecoins, blockchains
 * - Client-state (filters)      → react-hook-form
 * - Table rendering             → shared DataTable
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';

import { Button, DataTable, Input } from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';

import {
  useKeySignedTransactionsQuery,
  useKeyServicePlatformsQuery,
  useStablecoinOptionsQuery,
  useBlockchainOptionsQuery,
  type KeySignedTransaction,
  type KeySignedTransactionListFilters,
} from '@myorg/modules/key-management/data-access';

import {
  transactionTypeLabelMap,
  signatureTypeMap,
} from '@myorg/modules/key-management/util';

const filterSchema = z.object({
  signatureId: z.string().optional(),
  thirdPartyPlatformId: z.string().optional(),
  walletAddress: z.string().optional(),
  transactionType: z.string().optional(),
  signatureType: z.string().optional(),
  tokenId: z.string().optional(),
  blockchainId: z.string().optional(),
  transactionHash: z.string().optional(),
});

type FilterFormValues = z.infer<typeof filterSchema>;

/** Format a Unix timestamp (ms) to a locale string. */
function formatTimestamp(ts?: number): string {
  if (!ts) return '--';
  return new Date(ts).toLocaleString();
}

export function KeySignedTransactionsListPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const { register, watch, reset, control } = useForm<FilterFormValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      signatureId: '',
      thirdPartyPlatformId: '',
      walletAddress: '',
      transactionType: '',
      signatureType: '',
      tokenId: '',
      blockchainId: '',
      transactionHash: '',
    },
  });

  const filters = watch();

  const params = React.useMemo(() => {
    const data: KeySignedTransactionListFilters = {};
    if (filters.signatureId) data.signatureId = filters.signatureId;
    if (filters.thirdPartyPlatformId) data.thirdPartyPlatformId = Number(filters.thirdPartyPlatformId) || undefined;
    if (filters.walletAddress) data.walletAddress = filters.walletAddress;
    if (filters.transactionType) data.transactionType = filters.transactionType;
    if (filters.signatureType) data.signatureType = filters.signatureType;
    if (filters.tokenId) data.tokenId = Number(filters.tokenId) || undefined;
    if (filters.blockchainId) data.blockchainId = Number(filters.blockchainId) || undefined;
    if (filters.transactionHash) data.transactionHash = filters.transactionHash;

    return {
      page: { pageSize, pageNum: page },
      data,
    };
  }, [filters, page, pageSize]);

  const { data: listData, isLoading } = useKeySignedTransactionsQuery(params);
  const { data: keyServices } = useKeyServicePlatformsQuery();
  const { data: stablecoins } = useStablecoinOptionsQuery();
  const { data: blockchains } = useBlockchainOptionsQuery();

  const rows = listData?.rows ?? [];
  const total = listData?.page?.total ?? 0;

  const handleReset = () => {
    reset();
    setPage(1);
  };

  const handleViewDetail = (txRecordId?: number) => {
    if (txRecordId === undefined) return;
    router.push(
      `/key-management/key-signed-transactions/detail?id=${txRecordId}`,
    );
  };

  const columns = React.useMemo<ColumnDef<KeySignedTransaction>[]>(
    () => [
      {
        accessorKey: 'signatureId',
        header: 'Signature ID',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'keyServiceName',
        header: 'Key Service Name',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'walletAddress',
        header: 'Wallet Address',
      },
      {
        accessorKey: 'transactionType',
        header: 'Transaction Type',
        cell: ({ getValue }) => {
          const value = getValue() as string;
          return value ? transactionTypeLabelMap[value] || value : '--';
        },
      },
      {
        accessorKey: 'signatureType',
        header: 'Signature Type',
        cell: ({ getValue }) => {
          const value = String(getValue() ?? '');
          return signatureTypeMap[value] || value || '--';
        },
      },
      {
        accessorKey: 'tokenName',
        header: 'Token',
        cell: ({ row }) => {
          const record = row.original;
          return (
            <div>
              <div>{record.tokenName || '--'}</div>
              {record.tokenType !== undefined && (
                <div className="text-muted-foreground text-xs">
                  {t(`token_type_${Number(record.tokenType)}`)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'blockchainName',
        header: 'Blockchain',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'signatureTime',
        header: 'Signature Time',
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'submissionTime',
        header: 'Submission Time',
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'transactionHash',
        header: 'Transaction Hash',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as number;
          if (!status) return '--';
          return (
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
              {t(`common_task_status_${status}`)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Details',
        cell: ({ row }) => (
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => handleViewDetail(row.original.txRecordId)}
          >
            Details
          </Button>
        ),
      },
    ],
    [t]
  );

  const transactionTypeOptions = React.useMemo(
    () =>
      Object.entries(transactionTypeLabelMap).map(([value, label]) => ({
        label,
        value,
      })),
    []
  );

  const signatureTypeSelectOptions = React.useMemo(
    () =>
      Object.entries(signatureTypeMap).map(([value, label]) => ({
        label,
        value,
      })),
    []
  );

  const keyServiceOptions = React.useMemo(
    () =>
      // value 为空串的脏数据项（thirdPartyPlatformId 缺失）会被 FormSelect 自动过滤。
      (keyServices ?? []).map((s) => ({
        label: s.platformName || '--',
        value: String(s.thirdPartyPlatformId || ''),
      })),
    [keyServices]
  );

  const tokenOptions = React.useMemo(
    () =>
      (stablecoins ?? []).map((s) => ({
        label: s.name,
        value: String(s.stablecoinId),
      })),
    [stablecoins]
  );

  const blockchainOptions = React.useMemo(
    () =>
      // 筛选场景下不可用链 (status !== 1) 不作为筛选项展示：原 disabled 灰显语义改为过滤。
      (blockchains ?? [])
        .filter((b) => b.status === 1)
        .map((b) => ({
          label: b.value,
          value: String(b.key),
        })),
    [blockchains]
  );

  return (
    <div className="space-y-6">
      {/* Query Form */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-lg font-semibold">{t('PUB_Query')}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium">Signature ID</label>
            <Input placeholder="Signature ID" {...register('signatureId')} />
          </div>
          <FormSelect
            name="thirdPartyPlatformId"
            control={control}
            label="Key Service Name"
            options={keyServiceOptions}
            placeholder={t('PUB_All')}
          />
          <div>
            <label className="text-sm font-medium">Wallet Address</label>
            <Input placeholder="Wallet Address" {...register('walletAddress')} />
          </div>
          <FormSelect
            name="transactionType"
            control={control}
            label="Transaction Type"
            options={transactionTypeOptions}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="signatureType"
            control={control}
            label="Signature Type"
            options={signatureTypeSelectOptions}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="tokenId"
            control={control}
            label="Token"
            options={tokenOptions}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="blockchainId"
            control={control}
            label="Blockchain"
            options={blockchainOptions}
            placeholder={t('PUB_All')}
          />
          <div>
            <label className="text-sm font-medium">Transaction Hash</label>
            <Input placeholder="Transaction Hash" {...register('transactionHash')} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleReset}>
            {t('PUB_Reset')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Key-Signed Transactions</h3>
        </div>

        <DataTable
          columns={columns as any}
          data={rows.map((r) => ({ ...r, id: String(r.txRecordId ?? '') })) as any}
          isLoading={isLoading}
          emptyMessage={t('PUB_NoData')}
          pagination={{
            page,
            pageSize,
            total,
            onPageChange: setPage,
          }}
        />
      </div>
    </div>
  );
}
