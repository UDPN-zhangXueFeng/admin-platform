/**
 * UserWalletsListPage — read-only list of user wallets.
 *
 * Architecture (mirrors managed-wallets-list-page):
 * - Server-state (list data) → TanStack Query via useUserWalletsQuery
 * - Client-state (filters)   → react-hook-form + zod
 * - Table rendering          → shared DataTable
 *
 * Faithful source behavior (user-wallets.md §8):
 * - Source is a half-finished page. The query form exists but is NOT wired to
 *   the API (source index.tsx:83 TODO). All filter dropdowns are empty
 *   placeholders (All option only). The list endpoint is GET with no params and
 *   returns the full list in one shot. We preserve this: filters are collected
 *   by react-hook-form but never sent; the request has no pageNum.
 * - Pagination is therefore fully client-side: the server returns the entire
 *   list, and we slice it by page/pageSize before handing the current page to
 *   DataTable (DataTable uses manualPagination when `pagination` is passed, so
 *   it renders whatever slice we give it and reads `total` for the pager).
 *
 * Runtime gotchas (user-wallets.md §8):
 * - All-option value must be the non-empty sentinel 'all' (not '') to avoid
 *   SelectItem value="" crashes.
 * - i18n keys omit the namespace prefix (namespace is already
 *   modules.key-management).
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';

import { Button, DataTable, Input } from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';

import { useUserWalletsQuery, type UserWalletItem } from '@myorg/modules/key-management/data-access';
import { walletStatusMap, kycConfig } from '@myorg/modules/key-management/util';

/** Non-empty sentinel for the "All" option — see user-wallets.md §8. */
const ALL_VALUE = 'all';

const filterSchema = z.object({
  walletAddress: z.string().optional(),
  serviceProviderName: z.string().optional(),
  tokenId: z.string().optional(),
  tokenType: z.string().optional(),
  keyServiceName: z.string().optional(),
  blockchainId: z.string().optional(),
  startCreationDate: z.string().optional(),
  endCreationDate: z.string().optional(),
  status: z.string().optional(),
});

type FilterFormValues = z.infer<typeof filterSchema>;

/** Format a Unix timestamp (ms) to a locale string. */
function formatTimestamp(ts?: number): string {
  if (!ts) return '--';
  return new Date(ts).toLocaleString();
}

export function UserWalletsListPage() {
  const t = useTranslations('modules.key-management');
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const { register, reset, control } = useForm<FilterFormValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      walletAddress: '',
      serviceProviderName: '',
      tokenId: ALL_VALUE,
      tokenType: ALL_VALUE,
      keyServiceName: ALL_VALUE,
      blockchainId: ALL_VALUE,
      startCreationDate: '',
      endCreationDate: '',
      status: ALL_VALUE,
    },
  });

  // Source is half-finished: the form is never wired to the request. We collect
  // filter state for UI fidelity only — intentionally NOT passing it to the
  // query (the GET endpoint is parameterless).
  const { data: listData, isLoading } = useUserWalletsQuery();

  const allRows = listData?.list ?? [];
  const total = listData?.total ?? allRows.length;

  // Client-side pagination: GET returns the full list, so we slice the current
  // page locally before handing it to DataTable (manualPagination mode).
  const rows = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return allRows.slice(start, start + pageSize);
  }, [allRows, page, pageSize]);

  const handleReset = () => {
    reset();
    setPage(1);
  };

  const statusOptions = React.useMemo(
    () =>
      Object.entries(walletStatusMap).map(([value, entry]) => ({
        label: entry.label,
        value,
      })),
    [],
  );

  const columns = React.useMemo<ColumnDef<UserWalletItem>[]>(
    () => [
      {
        accessorKey: 'walletAddress',
        header: 'Wallet Address',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'serviceProviderName',
        header: 'Service Provider Name',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'tokenName',
        header: 'Token Name',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'tokenType',
        header: 'Token Type',
        cell: ({ getValue }) => {
          const tokenType = getValue() as number | undefined;
          if (tokenType === undefined || tokenType === null) return '--';
          return t(`token_type_${Number(tokenType)}`) || '--';
        },
      },
      {
        accessorKey: 'keyServiceName',
        header: 'Key Service Name',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'blockchainName',
        header: 'Blockchain',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'kycRequired',
        header: 'KYC Required',
        cell: ({ getValue }) => {
          const value = getValue() as number | undefined;
          if (value === undefined || value === null) return '--';
          return kycConfig[value] || '--';
        },
      },
      {
        accessorKey: 'createdOn',
        header: 'Created on',
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as number | undefined;
          if (!status) return '--';
          const entry = walletStatusMap[status];
          if (!entry) return '--';
          return (
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
              {entry.label}
            </span>
          );
        },
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      {/* Query Form (source is half-finished: filters are not wired to the API) */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-lg font-semibold">{t('PUB_Query')}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium">Wallet Address</label>
            <Input placeholder="Wallet Address" {...register('walletAddress')} />
          </div>
          <div>
            <label className="text-sm font-medium">Service Provider Name</label>
            <Input placeholder="Service Provider Name" {...register('serviceProviderName')} />
          </div>
          <FormSelect
            name="tokenId"
            control={control}
            label="Token Name"
            options={[]}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="tokenType"
            control={control}
            label="Token Type"
            options={[]}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="keyServiceName"
            control={control}
            label="Key Service Name"
            options={[]}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="blockchainId"
            control={control}
            label="Blockchain"
            options={[]}
            placeholder={t('PUB_All')}
          />
          <div>
            <label className="text-sm font-medium">Creation Date</label>
            <div className="flex items-center gap-2">
              <Input type="date" {...register('startCreationDate')} />
              <span className="text-muted-foreground">-</span>
              <Input type="date" {...register('endCreationDate')} />
            </div>
          </div>
          <FormSelect
            name="status"
            control={control}
            label="Status"
            options={statusOptions}
            placeholder={t('PUB_All')}
          />
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
          <h3 className="text-lg font-semibold">User Wallets</h3>
        </div>

        <DataTable
          columns={columns as any}
          data={rows.map((r) => ({ ...r, id: String(r.id ?? '') })) as any}
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
