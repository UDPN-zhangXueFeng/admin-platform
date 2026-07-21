/**
 * ManagedWalletsDetailPage — read-only detail view with two tabs.
 *
 * Tab 1 (Basic Information): two info cards — Current Wallet Details (10 fields)
 * and Key Rotation Details (5 fields) — with a Back button.
 * Tab 2 (Rotation History): an independent query form (5 filters) + a paginated
 * DataTable (10 columns) backed by `useManagedWalletRotationHistoryQuery`.
 *
 * Architecture mirrors `key-signed-transactions-detail-page.tsx`
 * (card + DetailItem) and `key-signed-transactions-list-page.tsx`
 * (react-hook-form + DataTable).
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  Button,
  CopyableEllipsisText,
  DataTable,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';

import {
  useManagedWalletDetailQuery,
  useManagedWalletRotationHistoryQuery,
  type WalletRotationHistory,
  type WalletRotationHistoryFilters,
} from '@myorg/modules/key-management/data-access';
import {
  roleNameMap,
  rotationStatusMap,
  walletStatusMap,
} from '@myorg/modules/key-management/util';

/** Format a Unix timestamp (ms) to a locale string. */
function formatTimestamp(ts?: number): string {
  if (!ts) return '--';
  return new Date(ts).toLocaleString();
}

/**
 * Resolve a role display name from a `string | number` value.
 *
 * The detail API types `roleName` as `string | number` (see managed-wallets.md
 * §8.B). The map only covers the 1/2/3 values the pages actually use; any other
 * value falls back to its raw string form so nothing renders blank.
 */
function getDisplayRoleName(roleValue?: string | number): string {
  if (roleValue === undefined || roleValue === null || roleValue === '') {
    return '--';
  }
  const numericKey = Number(roleValue);
  if (Number.isFinite(numericKey) && roleNameMap[numericKey]) {
    return roleNameMap[numericKey];
  }
  return String(roleValue);
}

/** Map a wallet status code to its display label (3-state). */
function getWalletStatusLabel(status?: number): string {
  if (typeof status !== 'number') return '--';
  return walletStatusMap[status]?.label ?? String(status);
}

/** Map a rotation status code to its display label (8-state machine). */
function getRotationStatusLabel(status?: number): string {
  if (typeof status !== 'number') return '--';
  return rotationStatusMap[status]?.label ?? String(status);
}

interface DetailItemProps {
  label: string;
  children: React.ReactNode;
}

function DetailItem({ label, children }: DetailItemProps) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

/** react-hook-form values for the Rotation History query form. */
interface HistoryFilterFormValues {
  walletAddress: string;
  keyId: string;
  creationStartDate: string;
  creationEndDate: string;
  transactionHash: string;
  status: string;
}

const HISTORY_FILTER_DEFAULTS: HistoryFilterFormValues = {
  walletAddress: '',
  keyId: '',
  creationStartDate: '',
  creationEndDate: '',
  transactionHash: '',
  status: 'all',
};

const ALL_VALUE = 'all';
const HISTORY_PAGE_SIZE = 10;

/** Select options for the rotation status filter, with an explicit "All". */
const rotationStatusOptions = [
  { label: 'All', value: ALL_VALUE },
  ...Object.entries(rotationStatusMap).map(([value, config]) => ({
    label: config.label,
    value,
  })),
];

export function ManagedWalletsDetailPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const searchParams = useSearchParams();

  const chainAccountId = React.useMemo(() => {
    const raw = searchParams.get('id');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }, [searchParams]);

  const { data: detail, isLoading } =
    useManagedWalletDetailQuery(chainAccountId);

  // ----- Rotation History: form + paginated query -----
  const [historyPage, setHistoryPage] = React.useState(1);
  const { register, watch, reset, control } =
    useForm<HistoryFilterFormValues>({
      defaultValues: HISTORY_FILTER_DEFAULTS,
    });

  const filters = watch();

  const historyParams = React.useMemo(() => {
    const data: WalletRotationHistoryFilters = {
      chainAccountId: chainAccountId ?? 0,
    };
    if (filters.walletAddress) data.walletAddress = filters.walletAddress;
    if (filters.keyId) data.keyId = filters.keyId;
    if (filters.creationStartDate) {
      data.creationStartDate = new Date(
        filters.creationStartDate,
      ).getTime();
    }
    if (filters.creationEndDate) {
      // End date is inclusive of the whole day.
      data.creationEndDate = new Date(
        `${filters.creationEndDate}T23:59:59`,
      ).getTime();
    }
    if (filters.transactionHash) data.transactionHash = filters.transactionHash;
    if (filters.status && filters.status !== ALL_VALUE) {
      data.status = Number(filters.status);
    }

    return {
      pageNum: historyPage,
      pageSize: HISTORY_PAGE_SIZE,
      filters: data,
    };
  }, [filters, historyPage, chainAccountId]);

  const {
    data: historyData,
    isLoading: historyLoading,
  } = useManagedWalletRotationHistoryQuery(historyParams);

  const historyRows = historyData?.rows ?? [];
  const historyTotal = historyData?.page?.total ?? 0;

  const handleHistoryReset = () => {
    reset(HISTORY_FILTER_DEFAULTS);
    setHistoryPage(1);
  };

  const historyColumns = React.useMemo<ColumnDef<WalletRotationHistory>[]>(
    () => [
      {
        accessorKey: 'originalWallet',
        header: 'Original Wallet',
        cell: ({ getValue }) => (
          <CopyableEllipsisText value={getValue() as string} />
        ),
      },
      {
        accessorKey: 'originalKeyId',
        header: 'Original Key ID',
        cell: ({ getValue }) => (
          <CopyableEllipsisText value={getValue() as string} />
        ),
      },
      {
        accessorKey: 'newWallet',
        header: 'New Wallet',
        cell: ({ getValue }) => (
          <CopyableEllipsisText value={getValue() as string} />
        ),
      },
      {
        accessorKey: 'newKeyId',
        header: 'New Key ID',
        cell: ({ getValue }) => (
          <CopyableEllipsisText value={getValue() as string} />
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: 'Blockchain',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'createdBy',
        header: 'Created by',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'createdOn',
        header: 'Created on',
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'transactionTime',
        header: 'Transaction Time',
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'transactionHash',
        header: 'Transaction Hash',
        cell: ({ getValue }) => (
          <CopyableEllipsisText value={getValue() as string} />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as number;
          if (typeof status !== 'number') return '--';
          return (
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
              {getRotationStatusLabel(status)}
            </span>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
          <TabsTrigger value="basic">Basic Information</TabsTrigger>
          <TabsTrigger value="history">Rotation History</TabsTrigger>
        </TabsList>

        {/* ---------- Tab 1: Basic Information ---------- */}
        <TabsContent value="basic" className="mt-4 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-64 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
            </div>
          ) : (
            <>
              {/* Card A — Current Wallet Details (10 fields) */}
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col space-y-1.5 p-6">
                  <h3 className="text-2xl font-semibold leading-none tracking-tight">
                    Current Wallet Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-6 p-6 pt-0 md:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label="Role Name">
                    {getDisplayRoleName(detail?.roleName)}
                  </DetailItem>
                  <DetailItem label="Status">
                    {typeof detail?.status === 'number' ? (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                        {getWalletStatusLabel(detail.status)}
                      </span>
                    ) : (
                      '--'
                    )}
                  </DetailItem>
                  <DetailItem label="Key ID">
                    <CopyableEllipsisText value={detail?.keyId} />
                  </DetailItem>
                  <DetailItem label="Token">{detail?.token || '--'}</DetailItem>
                  <DetailItem label="Wallet Address">
                    <CopyableEllipsisText value={detail?.walletAddress} />
                  </DetailItem>
                  <DetailItem label="Public Key">
                    <CopyableEllipsisText value={detail?.publicKey} />
                  </DetailItem>
                  <DetailItem label="Blockchain">
                    {detail?.blockchainName || '--'}
                  </DetailItem>
                  <DetailItem label="Key Service Name">
                    {detail?.keyServiceName || '--'}
                  </DetailItem>
                  <DetailItem label="Created by">
                    {detail?.createdBy || '--'}
                  </DetailItem>
                  <DetailItem label="Created on">
                    {formatTimestamp(detail?.createdOn)}
                  </DetailItem>
                </div>
              </div>

              {/* Card B — Key Rotation Details (5 fields, span 2) + Back */}
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col space-y-1.5 p-6">
                  <h3 className="text-2xl font-semibold leading-none tracking-tight">
                    Key Rotation Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-6 p-6 pt-0 md:grid-cols-2">
                  <DetailItem label="Rotation Frequency">
                    {detail?.rotationFrequency || '--'}
                  </DetailItem>
                  <DetailItem label="Rotation Time">
                    {detail?.rotationTime || '--'}
                  </DetailItem>
                  <DetailItem label="Rotation Methods">
                    {detail?.rotationMethods || '--'}
                  </DetailItem>
                  <DetailItem label="Last Rotation Time">
                    {formatTimestamp(detail?.lastRotationTime)}
                  </DetailItem>
                  <DetailItem label="Next Rotation Time">
                    {formatTimestamp(detail?.nextRotationTime)}
                  </DetailItem>
                </div>
                <div className="flex justify-end p-6 pt-0">
                  <Button onClick={() => router.back()}>Back</Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------- Tab 2: Rotation History ---------- */}
        <TabsContent value="history" className="mt-4 space-y-6">
          {/* Query Form */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-4 text-lg font-semibold">{t('PUB_Query')}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Wallet Address</label>
                <Input
                  placeholder="Enter wallet address"
                  {...register('walletAddress')}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Key ID</label>
                <Input
                  placeholder="Enter key ID"
                  {...register('keyId')}
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Creation Start Date
                </label>
                <Input type="date" {...register('creationStartDate')} />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Creation End Date
                </label>
                <Input type="date" {...register('creationEndDate')} />
              </div>
              <div>
                <label className="text-sm font-medium">Transaction Hash</label>
                <Input
                  placeholder="Enter transaction hash"
                  {...register('transactionHash')}
                />
              </div>
              <FormSelect
                name="status"
                control={control}
                label="Status"
                options={rotationStatusOptions}
                placeholder={t('PUB_All')}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={handleHistoryReset}>
                {t('PUB_Reset')}
              </Button>
            </div>
          </div>

          {/* History Table */}
          <div className="rounded-lg border bg-card p-4">
            <DataTable
              columns={historyColumns as any}
              data={historyRows.map((r, idx) => ({
                ...r,
                id: String(r.recordId ?? idx),
              })) as any}
              isLoading={historyLoading}
              emptyMessage={t('PUB_NoData')}
              pagination={{
                page: historyPage,
                pageSize: HISTORY_PAGE_SIZE,
                total: historyTotal,
                onPageChange: setHistoryPage,
              }}
            />
            <div className="mt-6 flex justify-end">
              <Button onClick={() => router.back()}>Back</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
