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
  Alert,
  Button,
  DataTable,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';

import { FormSelect } from '@myorg/shared/ui-forms';

import {
  useManagedWalletsQuery,
  useStablecoinOptionsQuery,
  useBlockchainOptionsQuery,
  type ManagedWallet,
  type ManagedWalletListFilters,
} from '@myorg/modules/td-admin/data-access';

import { walletStatusMap, roleNameMap } from '.';

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

/** Minimal structural type of a next-intl messages accessor (t + t.has). */
interface KeyManagementMessages {
  (key: string): string;
  has(key: string): boolean;
}

/** Timestamp column format, matching sibling list pages. */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** Table row handed to DataTable — wire item plus its client-side row id. */
type ManagedWalletRow = ManagedWallet & { id: string };

/** Semantic tone → tailwind badge classes (walletStatusMap tone values). */
const TONE_CLASS: Record<string, string> = {
  success: 'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400',
  processing: 'border-blue-600/40 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  warning: 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  error: 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-400',
  default: 'border-border bg-muted text-muted-foreground',
};

/** Local day start (00:00:00) for a yyyy-mm-dd input, mirroring upstream range semantics. */
function toDayStart(value?: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** Local day end, including the final millisecond. */
function toDayEnd(value?: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(`${value}T23:59:59.999`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** Map a select value to a number, or undefined for the "All" sentinel / empty. */
function toFilterNumber(value?: string): number | undefined {
  if (!value || value === ALL_VALUE) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Token Type label — falls back to the raw number for unknown codes. */
function formatTokenType(
  t: KeyManagementMessages,
  value: number | string | undefined | null,
): string {
  if (value === undefined || value === null || value === '') return '--';
  const numeric = Number(value);
  if (Number.isFinite(numeric) && t.has(`token_type_${numeric}`)) {
    return t(`token_type_${numeric}`);
  }
  return String(value);
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
    const startCreationDate = toDayStart(filters.startCreationDate);
    if (startCreationDate !== undefined) data.startCreationDate = startCreationDate;
    const endCreationDate = toDayEnd(filters.endCreationDate);
    if (endCreationDate !== undefined) data.endCreationDate = endCreationDate;
    const status = toFilterNumber(filters.status);
    if (status !== undefined) data.status = status;

    return {
      pageNum: page,
      pageSize,
      filters: data,
    };
  }, [filters, page, pageSize]);

  // Upstream re-queries page 1 on search; live filters reset the pager too.
  React.useEffect(() => {
    setPage(1);
  }, [
    filters.roleName,
    filters.keyId,
    filters.tokenId,
    filters.walletAddress,
    filters.blockchainId,
    filters.startCreationDate,
    filters.endCreationDate,
    filters.status,
  ]);

  const {
    data: listData,
    isLoading,
    isError,
    error,
    refetch,
  } = useManagedWalletsQuery(params);
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

  const columns = React.useMemo<ColumnDef<ManagedWalletRow>[]>(
    () => [
      {
        accessorKey: 'roleName',
        header: 'Role Name',
        cell: ({ getValue }) => {
          const raw = getValue() as number | string | undefined;
          if (raw === undefined || raw === null || raw === '') return '--';
          const key = Number(raw);
          const label = Number.isFinite(key) ? roleNameMap[key] : undefined;
          return label ?? String(raw);
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
              {record.tokenType !== undefined && record.tokenType !== null && (
                <div className="text-muted-foreground text-xs">
                  {formatTokenType(t, record.tokenType)}
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
          // Upstream renders `value || '3 months'` (default fallback).
          const value = getValue() as number | string | undefined;
          return value ? String(value) : '3 months';
        },
      },
      {
        accessorKey: 'lastRotationTime',
        header: 'Last Rotation Time',
        cell: ({ getValue }) => {
          const ts = getValue() as number | undefined;
          return ts ? formatDate(Number(ts), DATETIME_FMT) : '--';
        },
      },
      {
        accessorKey: 'nextRotationTime',
        header: 'Next Rotation Time',
        cell: ({ getValue }) => {
          const ts = getValue() as number | undefined;
          return ts ? formatDate(Number(ts), DATETIME_FMT) : '--';
        },
      },
      {
        accessorKey: 'createdOn',
        header: 'Created on',
        cell: ({ getValue }) => {
          const ts = getValue() as number | undefined;
          return ts ? formatDate(Number(ts), DATETIME_FMT) : '--';
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const raw = getValue() as number | string | undefined;
          if (raw === undefined || raw === null || raw === '') return '--';
          const status = Number(raw);
          const entry = Number.isFinite(status) ? walletStatusMap[status] : undefined;
          if (!entry) return String(raw);
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[entry.tone] ?? TONE_CLASS.default}`}
            >
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
            disabled={row.original.chainAccountId == null}
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

        {isError && (
          <Alert variant="destructive" className="mb-4">
            <div className="flex items-center justify-between gap-4">
              <span>{error instanceof Error ? error.message : t('key_management_load_failed')}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                {t('key_management_retry')}
              </Button>
            </div>
          </Alert>
        )}

        <DataTable<ManagedWalletRow>
          columns={columns}
          data={rows.map(
            (r): ManagedWalletRow => ({ ...r, id: String(r.chainAccountId ?? r.walletAddress ?? '') }),
          )}
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
