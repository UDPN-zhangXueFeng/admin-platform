/**
 * ManagedWalletsListPage — paginated list with 7 search filters and 11 columns.
 *
 * Architecture (mirrors key-signed-transactions-list-page):
 * - Server-state (list data) → TanStack Query via useManagedWalletsQuery
 * - Reference data           → TanStack Query for stablecoins, blockchains
 * - Client-state (filters)   → react-hook-form + zod
 * - Table rendering          → shared DataTable
 *
 * Runtime gotchas (see managed-wallets.md §8.G):
 * - All-option value must be the non-empty sentinel 'all' (not '') to avoid
 *   SelectItem value="" crashes.
 * - i18n keys omit the namespace prefix (namespace is already
 *   modules.key-management).
 * - The list request body contains pageNum.
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';

import {
  Button,
  DataTable,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';

import {
  useManagedWalletsQuery,
  useStablecoinOptionsQuery,
  useBlockchainOptionsQuery,
  type ManagedWallet,
  type ManagedWalletListFilters,
} from '@myorg/modules/key-management/data-access';

import { walletStatusMap, roleNameMap } from '@myorg/modules/key-management/util';

/** Non-empty sentinel for the "All" option — see managed-wallets.md §8.G. */
const ALL_VALUE = 'all';

const filterSchema = z.object({
  roleName: z.string().optional(),
  keyId: z.string().optional(),
  tokenId: z.string().optional(),
  walletAddress: z.string().optional(),
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

/** Convert an ISO date string (yyyy-mm-dd) to a UTC ms timestamp. */
function dateToTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** Map a select value to a number, or undefined for the "All" sentinel / empty. */
function toFilterNumber(value?: string): number | undefined {
  if (!value || value === ALL_VALUE) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function ManagedWalletsListPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const { register, watch, reset, control } = useForm<FilterFormValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      roleName: ALL_VALUE,
      keyId: '',
      tokenId: ALL_VALUE,
      walletAddress: '',
      blockchainId: ALL_VALUE,
      startCreationDate: '',
      endCreationDate: '',
      status: ALL_VALUE,
    },
  });

  const filters = watch();

  const params = React.useMemo(() => {
    const data: ManagedWalletListFilters = {};
    const roleName = toFilterNumber(filters.roleName);
    if (roleName !== undefined) data.roleName = roleName;
    if (filters.keyId) data.keyId = filters.keyId;
    const tokenId = toFilterNumber(filters.tokenId);
    if (tokenId !== undefined) data.tokenId = tokenId;
    if (filters.walletAddress) data.walletAddress = filters.walletAddress;
    const blockchainId = toFilterNumber(filters.blockchainId);
    if (blockchainId !== undefined) data.blockchainId = blockchainId;
    const startCreationDate = dateToTimestamp(filters.startCreationDate);
    if (startCreationDate !== undefined) data.startCreationDate = startCreationDate;
    const endCreationDate = dateToTimestamp(filters.endCreationDate);
    if (endCreationDate !== undefined) data.endCreationDate = endCreationDate;
    const status = toFilterNumber(filters.status);
    if (status !== undefined) data.status = status;

    return {
      pageNum: page,
      pageSize,
      filters: data,
    };
  }, [filters, page, pageSize]);

  const { data: listData, isLoading } = useManagedWalletsQuery(params);
  const { data: stablecoins } = useStablecoinOptionsQuery();
  const { data: blockchains } = useBlockchainOptionsQuery();

  const rows = listData?.rows ?? [];
  const total = listData?.page?.total ?? 0;

  const handleReset = () => {
    reset();
    setPage(1);
  };

  const handleViewDetail = (chainAccountId?: number) => {
    if (chainAccountId === undefined) return;
    router.push(
      `/key-management/managed-wallets/detail?id=${chainAccountId}`,
    );
  };

  const columns = React.useMemo<ColumnDef<ManagedWallet>[]>(
    () => [
      {
        accessorKey: 'roleName',
        header: 'Role Name',
        cell: ({ getValue }) => {
          const value = getValue() as number | undefined;
          if (value === undefined || value === null) return '--';
          return roleNameMap[value] || '--';
        },
      },
      {
        accessorKey: 'keyId',
        header: 'Key ID',
        cell: ({ getValue }) => (getValue() as string) || '--',
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
        accessorKey: 'walletAddress',
        header: () => (
          <div className="flex items-center gap-1">
            <span>Wallet Address</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-muted-foreground">ⓘ</span>
                </TooltipTrigger>
                <TooltipContent>{t('key_management_0067')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'blockchainName',
        header: 'Blockchain',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'keyServiceName',
        header: 'Key Service Name',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'rotationFrequency',
        header: 'Rotation Frequency',
        cell: ({ getValue }) => {
          const value = getValue() as number | undefined;
          if (value === undefined || value === null) return '--';
          return String(value);
        },
      },
      {
        accessorKey: 'lastRotationTime',
        header: 'Last Rotation Time',
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'nextRotationTime',
        header: 'Next Rotation Time',
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
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
      {
        id: 'actions',
        header: 'Details',
        cell: ({ row }) => (
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => handleViewDetail(row.original.chainAccountId)}
          >
            Details
          </Button>
        ),
      },
    ],
    [t],
  );

  const roleNameOptions = React.useMemo(
    () =>
      Object.entries(roleNameMap).map(([value, label]) => ({
        label,
        value,
      })),
    [],
  );

  const tokenOptions = React.useMemo(
    () =>
      (stablecoins ?? []).map((s) => ({
        label: s.name,
        value: String(s.stablecoinId),
      })),
    [stablecoins],
  );

  const blockchainOptions = React.useMemo(
    () =>
      // 筛选场景下不可用链 (status !== 1) 不作为筛选项展示。
      (blockchains ?? [])
        .filter((b) => b.status === 1)
        .map((b) => ({
          label: b.value,
          value: String(b.key),
        })),
    [blockchains],
  );

  const statusOptions = React.useMemo(
    () =>
      Object.entries(walletStatusMap).map(([value, entry]) => ({
        label: entry.label,
        value,
      })),
    [],
  );

  return (
    <div className="space-y-6">
      {/* Query Form */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-lg font-semibold">{t('PUB_Query')}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            name="roleName"
            control={control}
            label="Role Name"
            options={roleNameOptions}
            placeholder={t('PUB_All')}
          />
          <div>
            <label className="text-sm font-medium">Key ID</label>
            <Input placeholder="Key ID" {...register('keyId')} />
          </div>
          <FormSelect
            name="tokenId"
            control={control}
            label="Token"
            options={tokenOptions}
            placeholder={t('PUB_All')}
          />
          <div>
            <label className="text-sm font-medium">Wallet Address</label>
            <Input placeholder="Wallet Address" {...register('walletAddress')} />
          </div>
          <FormSelect
            name="blockchainId"
            control={control}
            label="Blockchain"
            options={blockchainOptions}
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
          <h3 className="text-lg font-semibold">Managed Wallets</h3>
        </div>

        <DataTable
          columns={columns as any}
          data={rows.map((r) => ({ ...r, id: String(r.chainAccountId ?? '') })) as any}
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
