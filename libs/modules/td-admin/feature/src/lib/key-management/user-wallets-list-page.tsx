/**
 * UserWalletsListPage — read-only list of user wallets.
 *
 * Architecture (mirrors managed-wallets-list-page):
 * - Server-state (list data) → TanStack Query via useUserWalletsQuery
 * - Client-state (filters)   → react-hook-form + zod
 * - Table rendering          → shared DataTable
 *
 * Behavior notes:
 * - The list endpoint is GET with no params and returns the full list in one
 *   shot (code=0 live capture: 723 rows, no `page` object, `list` array).
 *   The upstream page collected filter values but never used them (half
 *   finished). Here the same filter fields are applied as CLIENT-SIDE
 *   filtering over the returned dataset, applied on form submit (Query
 *   button / Enter), with page reset to 1 — the half-finished upstream
 *   behavior is completed instead of masked.
 * - Wire-key mapping (upstream page key → actual wire key): spName
 *   (serviceProviderName), tdName (tokenName), state (status), createTime
 *   (createdOn). `keyServiceName` has no wire counterpart (upstream renders
 *   `--` on every row) — the column and its filter are dropped as a
 *   documented backend gap, not faked.
 * - Pagination is fully client-side: rows are filtered then sliced by
 *   page/pageSize (DataTable uses manualPagination when `pagination` is
 *   passed).
 *
 * Runtime gotchas:
 * - All-option value must be the non-empty sentinel 'all' (SelectItem value=""
 *   crashes).
 * - i18n: dynamic keys guarded with t.has() (next-intl throws on missing
 *   messages in production); unknown enum values render the raw number.
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';

import { formatDate } from '@myorg/shared/util-dates';
import { Alert, Button, DataTable, Input } from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';

import {
  useUserWalletsQuery,
  type UserWalletItem,
} from '@myorg/modules/td-admin/data-access';
import { walletStatusMap, kycConfig } from '.';

/** Timestamp column format, matching sibling list pages. */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** Non-empty sentinel for the "All" option. */
const ALL_VALUE = 'all';

const EMPTY_FILTERS = {
  walletAddress: '',
  spName: '',
  tdName: ALL_VALUE,
  tokenType: ALL_VALUE,
  blockchainId: ALL_VALUE,
  startCreationDate: '',
  endCreationDate: '',
  status: ALL_VALUE,
} as const;

const filterSchema = z.object({
  walletAddress: z.string().optional(),
  spName: z.string().optional(),
  tdName: z.string().optional(),
  tokenType: z.string().optional(),
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

/** Table row handed to DataTable — wire item plus its client-side row id. */
type UserWalletRow = UserWalletItem & { id: string };

/** Semantic tone → tailwind badge classes (walletStatusMap tone values). */
const TONE_CLASS: Record<string, string> = {
  success: 'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400',
  processing: 'border-blue-600/40 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  warning: 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  error: 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-400',
  default: 'border-border bg-muted text-muted-foreground',
};

/** Token Type cell label — falls back to the raw number for unknown codes. */
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

export function UserWalletsListPage() {
  const t = useTranslations('modules.key-management');
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const [applied, setApplied] = React.useState<FilterFormValues>(EMPTY_FILTERS);

  const { register, reset, handleSubmit, control } = useForm<FilterFormValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: { ...EMPTY_FILTERS },
  });

  const {
    data: listData,
    isLoading,
    isError,
    error,
    refetch,
  } = useUserWalletsQuery();

  const allRows = listData?.list ?? [];

  // Filter dropdown options are derived from the actual returned data (the
  // upstream half-finished page left them permanently empty).
  const tokenNameOptions = React.useMemo(() => {
    const names = [...new Set(allRows.map((r) => r.tdName).filter(Boolean))];
    return names.sort().map((name) => ({ label: name as string, value: name as string }));
  }, [allRows]);

  const tokenTypeOptions = React.useMemo(() => {
    const types = [...new Set(allRows.map((r) => r.tokenType).filter((v) => v !== undefined && v !== null))];
    return types
      .sort((a, b) => Number(a) - Number(b))
      .map((type) => ({
        label: formatTokenType(t, type),
        value: String(type),
      }));
  }, [allRows, t]);

  const blockchainOptions = React.useMemo(() => {
    const byId = new Map<number, string>();
    allRows.forEach((r) => {
      if (r.blockchainId !== undefined && r.blockchainId !== null) {
        byId.set(Number(r.blockchainId), r.blockchainName || String(r.blockchainId));
      }
    });
    return [...byId.entries()].map(([id, name]) => ({ label: name, value: String(id) }));
  }, [allRows]);

  const statusOptions = React.useMemo(
    () =>
      Object.entries(walletStatusMap).map(([value, entry]) => ({
        label: entry.label,
        value,
      })),
    [],
  );

  // Client-side filtering over the full dataset.
  const filteredRows = React.useMemo(() => {
    const address = (applied.walletAddress || '').trim().toLowerCase();
    const spName = (applied.spName || '').trim().toLowerCase();
    const start = applied.startCreationDate
      ? new Date(`${applied.startCreationDate}T00:00:00`).getTime()
      : undefined;
    const end = applied.endCreationDate
      ? new Date(`${applied.endCreationDate}T23:59:59.999`).getTime()
      : undefined;
    return allRows.filter((r) => {
      if (address && !(r.walletAddress || '').toLowerCase().includes(address)) return false;
      if (spName && !(r.spName || '').toLowerCase().includes(spName)) return false;
      if (applied.tdName && applied.tdName !== ALL_VALUE && r.tdName !== applied.tdName) return false;
      if (applied.tokenType && applied.tokenType !== ALL_VALUE && String(r.tokenType) !== applied.tokenType) return false;
      if (applied.blockchainId && applied.blockchainId !== ALL_VALUE && String(r.blockchainId) !== applied.blockchainId) return false;
      if (applied.status && applied.status !== ALL_VALUE && String(r.state) !== applied.status) return false;
      if (start !== undefined && !(r.createTime !== undefined && r.createTime >= start)) return false;
      if (end !== undefined && !(r.createTime !== undefined && r.createTime <= end)) return false;
      return true;
    });
  }, [allRows, applied]);

  // Client-side pagination over the filtered rows.
  const rows = React.useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return filteredRows.slice(startIdx, startIdx + pageSize);
  }, [filteredRows, page, pageSize]);

  const onApply = (values: FilterFormValues) => {
    setApplied(values);
    setPage(1);
  };

  const handleReset = () => {
    reset({ ...EMPTY_FILTERS });
    setApplied({ ...EMPTY_FILTERS });
    setPage(1);
  };

  const columns = React.useMemo<ColumnDef<UserWalletRow>[]>(
    () => [
      {
        accessorKey: 'walletAddress',
        header: 'Wallet Address',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'spName',
        header: 'Service Provider Name',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'tdName',
        header: 'Token Name',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'tokenType',
        header: 'Token Type',
        cell: ({ getValue }) => formatTokenType(t, getValue() as number),
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
          const value = getValue() as number | string | undefined;
          if (value === undefined || value === null || value === '') return '--';
          return kycConfig[Number(value)] ?? String(value);
        },
      },
      {
        accessorKey: 'createTime',
        header: 'Created on',
        cell: ({ getValue }) => {
          const ts = getValue() as number | undefined;
          return ts ? formatDate(Number(ts), DATETIME_FMT) : '--';
        },
      },
      {
        accessorKey: 'state',
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
    ],
    [t],
  );

  const loadFailedMessage = t('key_management_load_failed');

  return (
    <div className="space-y-6">
      {/* Query form — filters apply client-side over the full server dataset. */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-lg font-semibold">{t('PUB_Query')}</h3>
        <form onSubmit={handleSubmit(onApply)} noValidate>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium">Wallet Address</label>
              <Input placeholder="Wallet Address" {...register('walletAddress')} />
            </div>
            <div>
              <label className="text-sm font-medium">Service Provider Name</label>
              <Input placeholder="Service Provider Name" {...register('spName')} />
            </div>
            <FormSelect
              name="tdName"
              control={control}
              label="Token Name"
              options={[{ label: t('PUB_All'), value: ALL_VALUE }, ...tokenNameOptions]}
              placeholder={t('PUB_All')}
            />
            <FormSelect
              name="tokenType"
              control={control}
              label="Token Type"
              options={[{ label: t('PUB_All'), value: ALL_VALUE }, ...tokenTypeOptions]}
              placeholder={t('PUB_All')}
            />
            <FormSelect
              name="blockchainId"
              control={control}
              label="Blockchain"
              options={[{ label: t('PUB_All'), value: ALL_VALUE }, ...blockchainOptions]}
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
              options={[{ label: t('PUB_All'), value: ALL_VALUE }, ...statusOptions]}
              placeholder={t('PUB_All')}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              {t('PUB_Reset')}
            </Button>
            <Button type="submit">{t('PUB_Query')}</Button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">User Wallets</h3>
        </div>

        {isError && (
          <Alert variant="destructive" className="mb-4">
            <div className="flex items-center justify-between gap-4">
              <span>{error instanceof Error ? error.message : loadFailedMessage}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                {t('key_management_retry')}
              </Button>
            </div>
          </Alert>
        )}

        <DataTable<UserWalletRow>
          columns={columns}
          data={rows.map((r, index): UserWalletRow => ({
            ...r,
            id: String(r.walletId ?? r.walletAddress ?? `row-${index}`),
          }))}
          isLoading={isLoading}
          emptyMessage={t('PUB_NoData')}
          pagination={{
            page,
            pageSize,
            total: filteredRows.length,
            onPageChange: setPage,
          }}
        />
      </div>
    </div>
  );
}
