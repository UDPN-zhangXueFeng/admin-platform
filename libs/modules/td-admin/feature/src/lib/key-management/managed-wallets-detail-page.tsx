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
  Alert,
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
} from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';
import {
  roleNameMap,
  walletStatusMap,
} from '.';
import { rotationStatusMap } from './constants';


/** Table row handed to DataTable — wire item plus its client-side row id. */
type HistoryRow = WalletRotationHistory & { id: string };

/** Semantic tone → tailwind badge classes (status map tone values). */
const TONE_CLASS: Record<string, string> = {
  success: 'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400',
  processing: 'border-blue-600/40 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  warning: 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  error: 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-400',
  default: 'border-border bg-muted text-muted-foreground',
};

/** Timestamp renders follow the kissen-admin convention via the shared helper. */
function formatTimestamp(ts?: number): string {
  return formatAdminTimestamp(ts);
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

/** Select option values for the rotation status filter, with an explicit "All". */
const rotationStatusOptionValues: { value: string; i18nKey?: string }[] = [
  { value: ALL_VALUE },
  ...Object.entries(rotationStatusMap).map(([value, config]) => ({
    value,
    i18nKey: config.i18nKey,
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

  const {
    data: detail,
    isLoading,
    isError: detailIsError,
    error: detailError,
    refetch: refetchDetail,
  } = useManagedWalletDetailQuery(chainAccountId);

  // ----- Rotation History: form + paginated query -----
  const [historyPage, setHistoryPage] = React.useState(1);
  const { register, reset, control, getValues } =
    useForm<HistoryFilterFormValues>({
      defaultValues: HISTORY_FILTER_DEFAULTS,
    });

  // Committed filter values — only a Query click sends them to the server.
  const [committedHistoryFilters, setCommittedHistoryFilters] =
    React.useState<HistoryFilterFormValues>(HISTORY_FILTER_DEFAULTS);

  const historyParams = React.useMemo(() => {
    const data: WalletRotationHistoryFilters = {
      chainAccountId: chainAccountId ?? 0,
    };
    if (committedHistoryFilters.walletAddress)
      data.walletAddress = committedHistoryFilters.walletAddress;
    if (committedHistoryFilters.keyId)
      data.keyId = committedHistoryFilters.keyId;
    if (committedHistoryFilters.creationStartDate) {
      data.creationStartDate = new Date(
        `${committedHistoryFilters.creationStartDate}T00:00:00`,
      ).getTime();
    }
    if (committedHistoryFilters.creationEndDate) {
      // End date is inclusive of the whole day.
      data.creationEndDate = new Date(
        `${committedHistoryFilters.creationEndDate}T23:59:59`,
      ).getTime();
    }
    if (committedHistoryFilters.transactionHash)
      data.transactionHash = committedHistoryFilters.transactionHash;
    if (
      committedHistoryFilters.status &&
      committedHistoryFilters.status !== ALL_VALUE
    ) {
      data.status = Number(committedHistoryFilters.status);
    }

    return {
      pageNum: historyPage,
      pageSize: HISTORY_PAGE_SIZE,
      filters: data,
    };
  }, [committedHistoryFilters, historyPage, chainAccountId]);

  const {
    data: historyData,
    isLoading: historyLoading,
    isError: historyIsError,
    error: historyError,
    refetch: refetchHistory,
  } = useManagedWalletRotationHistoryQuery(
    historyParams,
    chainAccountId !== undefined,
  );


  const rotationStatusOptions = React.useMemo(
    () =>
      rotationStatusOptionValues.map((option) => ({
        label: option.i18nKey ? t(option.i18nKey) : t('PUB_All'),
        value: option.value,
      })),
    [t],
  );
  const historyRows = historyData?.rows ?? [];
  const historyTotal = historyData?.page?.total ?? 0;

  const handleHistoryQuery = () => {
    setCommittedHistoryFilters(getValues());
    setHistoryPage(1);
  };

  const handleHistoryReset = () => {
    reset(HISTORY_FILTER_DEFAULTS);
    setCommittedHistoryFilters(HISTORY_FILTER_DEFAULTS);
    setHistoryPage(1);
  };

  const historyColumns = React.useMemo<ColumnDef<HistoryRow>[]>(
    () => [
      {
        accessorKey: 'originalWallet',
        header: t('key_management_0080'),
        cell: ({ getValue }) => (
          <CopyableEllipsisText value={getValue() as string} />
        ),
      },
      {
        accessorKey: 'originalKeyId',
        header: t('key_management_0081'),
        cell: ({ getValue }) => (
          <CopyableEllipsisText value={getValue() as string} />
        ),
      },
      {
        accessorKey: 'newWallet',
        header: t('key_management_0082'),
        cell: ({ getValue }) => (
          <CopyableEllipsisText value={getValue() as string} />
        ),
      },
      {
        accessorKey: 'newKeyId',
        header: t('key_management_0083'),
        cell: ({ getValue }) => (
          <CopyableEllipsisText value={getValue() as string} />
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('key_management_0063'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'createdBy',
        header: t('key_management_0049'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'createdOn',
        header: t('key_management_0050'),
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'transactionTime',
        header: t('key_management_0079'),
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'transactionHash',
        header: t('key_management_0078'),
        cell: ({ getValue }) => (
          <CopyableEllipsisText value={getValue() as string} />
        ),
      },
      {
        accessorKey: 'status',
        header: t('key_management_0003'),
        cell: ({ getValue }) => {
          const raw = getValue() as number | string | undefined;
          if (raw === undefined || raw === null || raw === '') return '--';
          const status = Number(raw);
          const entry = Number.isFinite(status) ? rotationStatusMap[status] : undefined;
          const tone = entry?.tone ?? 'default';
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone] ?? TONE_CLASS.default}`}
            >
              {entry ? t(entry.i18nKey) : String(raw)}
            </span>
          );
        },
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
        <TabsTrigger value="basic">{t('key_management_0057')}</TabsTrigger>
        <TabsTrigger value="history">{t('key_management_0086')}</TabsTrigger>
        </TabsList>

        {/* ---------- Tab 1: Basic Information ---------- */}
        <TabsContent value="basic" className="mt-4 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-64 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
            </div>
          ) : detailIsError ? (
            <Alert variant="destructive">
              <div className="flex items-center justify-between gap-4">
                <span>
                  {detailError instanceof Error
                    ? detailError.message
                    : t('key_management_load_failed')}
                </span>
                <Button variant="outline" size="sm" onClick={() => refetchDetail()}>
                  {t('key_management_retry')}
                </Button>
              </div>
            </Alert>
          ) : (
            <>
              {/* Card A — Current Wallet Details (10 fields) */}
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col space-y-1.5 p-6">
                  <h3 className="text-2xl font-semibold leading-none tracking-tight">
                    {t('key_management_0084')}
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-6 p-6 pt-0 md:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label={t('KP_RoleName')}>
                    {getDisplayRoleName(detail?.roleName)}
                  </DetailItem>
                  <DetailItem label={t('key_management_0003')}>
                    {(() => {
                      const raw = detail?.status;
                      if (raw === undefined || raw === null || String(raw) === '') return '--';
                      const status = Number(raw);
                      const entry = Number.isFinite(status)
                        ? walletStatusMap[status]
                        : undefined;
                      const tone = entry?.tone ?? 'default';
                      return (
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone] ?? TONE_CLASS.default}`}
                        >
                          {entry ? t(entry.i18nKey) : String(raw)}
                        </span>
                      );
                    })()}
                  </DetailItem>
                  <DetailItem label={t('key_management_0074')}>
                    <CopyableEllipsisText value={detail?.keyId} />
                  </DetailItem>
                  <DetailItem label={t('key_management_0075')}>
                    {detail?.token || '--'}
                  </DetailItem>
                  <DetailItem label={t('key_management_0076')}>
                    <CopyableEllipsisText value={detail?.walletAddress} />
                  </DetailItem>
                  <DetailItem label={t('key_management_0077')}>
                    <CopyableEllipsisText value={detail?.publicKey} />
                  </DetailItem>
                  <DetailItem label={t('key_management_0063')}>
                    {detail?.blockchainName || '--'}
                  </DetailItem>
                  <DetailItem label={t('key_management_0001')}>
                    {detail?.keyServiceName || '--'}
                  </DetailItem>
                  <DetailItem label={t('key_management_0049')}>
                    {detail?.createdBy || '--'}
                  </DetailItem>
                  <DetailItem label={t('key_management_0050')}>
                    {formatTimestamp(detail?.createdOn)}
                  </DetailItem>
                </div>
              </div>

              {/* Card B — Key Rotation Details (5 fields, span 2) + Back */}
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col space-y-1.5 p-6">
                  <h3 className="text-2xl font-semibold leading-none tracking-tight">
                    {t('key_management_0085')}
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-6 p-6 pt-0 md:grid-cols-2">
                  <DetailItem label={t('key_management_0108')}>
                    {detail?.rotationFrequency || '--'}
                  </DetailItem>
                  <DetailItem label={t('KP_RotationTime')}>
                    {detail?.rotationTime || '--'}
                  </DetailItem>
                  <DetailItem label={t('KP_RotationMethods')}>
                    {detail?.rotationMethods || '--'}
                  </DetailItem>
                  <DetailItem label={t('key_management_0087')}>
                    {formatTimestamp(detail?.lastRotationTime)}
                  </DetailItem>
                  <DetailItem label={t('key_management_0088')}>
                    {formatTimestamp(detail?.nextRotationTime)}
                  </DetailItem>
                </div>
                <div className="flex justify-end p-6 pt-0">
                  <Button onClick={() => router.back()}>{t('key_management_0056')}</Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------- Tab 2: Rotation History ---------- */}
        <TabsContent value="history" className="mt-4 space-y-6">
          {/* Upstream shows an intro line naming the wallet's role. */}
          <p className="text-sm text-muted-foreground">
            {t('key_management_rotation_history_intro', {
              role: getDisplayRoleName(detail?.roleName),
            })}
          </p>
          {/* Query Form */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-4 text-lg font-semibold">{t('PUB_Query')}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-sm font-medium">{t('key_management_0076')}</label>
                <Input
                  placeholder={t('key_management_0089')}
                  {...register('walletAddress')}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('key_management_0074')}</label>
                <Input
                  placeholder={t('key_management_0090')}
                  {...register('keyId')}
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t('key_management_creation_date_start')}
                </label>
                <Input type="date" {...register('creationStartDate')} />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t('key_management_creation_date_end')}
                </label>
                <Input type="date" {...register('creationEndDate')} />
              </div>
              <div>
                <label className="text-sm font-medium">{t('key_management_0078')}</label>
                <Input
                  placeholder={t('key_management_0091')}
                  {...register('transactionHash')}
                />
              </div>
              <FormSelect
                name="status"
                control={control}
                label={t('key_management_0003')}
                options={rotationStatusOptions}
                placeholder={t('PUB_All')}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={handleHistoryQuery}>{t('PUB_Query')}</Button>
              <Button variant="outline" onClick={handleHistoryReset}>
                {t('PUB_Reset')}
              </Button>
            </div>
          </div>

          {/* History Table */}
          <div className="rounded-lg border bg-card p-4">
            {historyIsError && (
              <Alert variant="destructive" className="mb-4">
                <div className="flex items-center justify-between gap-4">
                  <span>
                    {historyError instanceof Error
                      ? historyError.message
                      : t('key_management_load_failed')}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => refetchHistory()}>
                    {t('key_management_retry')}
                  </Button>
                </div>
              </Alert>
            )}
            <DataTable<HistoryRow>
              columns={historyColumns}
              data={historyRows.map(
                (r, idx): HistoryRow => ({ ...r, id: String(r.recordId ?? idx) }),
              )}
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
              <Button onClick={() => router.back()}>{t('key_management_0056')}</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
