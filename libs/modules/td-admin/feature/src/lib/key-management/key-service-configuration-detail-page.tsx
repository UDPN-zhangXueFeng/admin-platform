/**
 * KeyServiceConfigurationDetailPage — read-only detail view with two tabs.
 *
 * Tab 1 (Basic Information): three cards — Key Service Details (9 fields),
 * Access Parameter Details (url + Parameters table), and Supported Chains
 * Details (table) — with a Back button.
 * Tab 2 (Operation Records): an operationType filter + Query/Reset + a
 * paginated DataTable backed by `useKeyServiceOperationRecordsQuery`.
 *
 * Architecture mirrors `managed-wallets-detail-page.tsx`
 * (card + DetailItem, react-hook-form + DataTable).
 *
 * Source: td-manage/src/pages/key-management/key-service-configuration/detail.tsx
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  Alert,
  Button,
  DataTable,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import {
  MASKED_VALUE,
  isSensitiveParameterKey,
} from './key-service-configuration-sensitive';

import {
  useKeyServiceConfigurationDetailQuery,
  useKeyServiceOperationRecordsQuery,
  type KeyServiceOperationRecord,
} from '@myorg/modules/td-admin/data-access';
import {
  keyServiceOperationStatusToneMap,
  keyServiceStatusToneMap,
} from './constants';

/** Timestamp column format, matching sibling pages. */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** Semantic tone → tailwind badge classes (status tone map values). */
const TONE_CLASS: Record<string, string> = {
  success: 'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400',
  processing: 'border-blue-600/40 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  warning: 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  error: 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-400',
  default: 'border-border bg-muted text-muted-foreground',
};

/** Format a Unix timestamp (ms) in the shared portal column format. */
function formatTimestamp(ts?: number): string {
  if (!ts) return '--';
  return formatDate(Number(ts), DATETIME_FMT);
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

/** Status tag with semantic tone classes (shared by both tabs). */
function StatusBadge({ tone, label }: { tone: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}

const ALL_VALUE = 'all';
const RECORDS_PAGE_SIZE = 10;

/** react-hook-form values for the Operation Records filter form. */
interface RecordsFilterFormValues {
  operationType: string;
}

const RECORDS_FILTER_DEFAULTS: RecordsFilterFormValues = {
  operationType: ALL_VALUE,
};

/** DataTable requires rows to carry an `id`. */
type OperationRecordRow = KeyServiceOperationRecord & { id: string };

/** Inner Parameters-table row. */
interface ParameterRow {
  id: string;
  parameterType?: number;
  parameterKey?: string;
  parameterValue?: string;
}

/** Inner Supported-Chains-table row. */
interface ChainRow {
  id: string;
  blockchain?: string;
  serviceProviderBlockchainName?: string;
  serviceProviderBlockchainId?: string;
}

export function KeyServiceConfigurationDetailPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const searchParams = useSearchParams();

  const keyServiceCode = React.useMemo(
    () => searchParams.get('id') ?? undefined,
    [searchParams],
  );

  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = useKeyServiceConfigurationDetailQuery(keyServiceCode);

  // ----- Display maps (i18n-driven, mirror source detail.tsx) -----
  const statusMap = React.useMemo<Record<number, string>>(
    () => ({
      1: t('key_management_0018'),
      2: t('key_management_0019'),
      3: t('key_management_0020'),
      4: t('key_management_0021'),
    }),
    [t],
  );

  const parameterTypeMap = React.useMemo<Record<number, string>>(
    () => ({
      1: t('key_management_0066'),
      5: t('key_management_0023'),
      10: t('key_management_0024'),
    }),
    [t],
  );

  const operationTypeMap = React.useMemo<Record<number, string>>(
    () => ({
      1: t('key_management_0025'),
      2: t('key_management_0010'),
      3: t('key_management_0026'),
      4: t('key_management_0011'),
      5: t('key_management_0027'),
      6: t('key_management_0028'),
    }),
    [t],
  );

  const operationStatusMap = React.useMemo<Record<number, string>>(
    () => ({
      1: t('key_management_0029'),
      3: t('key_management_0030'),
      5: t('key_management_0031'),
      10: t('key_management_0032'),
      15: t('key_management_0021'),
      20: t('key_management_0033'),
      30: t('key_management_0034'),
      35: t('key_management_0035'),
      40: t('key_management_0036'),
      45: t('key_management_0037'),
    }),
    [t],
  );

  // Upstream detail.tsx renders '--' for any falsy value (0/undefined) in
  // status/type columns; truthy unknown codes fall back to the raw number.
  const getStatusLabel = (status?: number) =>
    status ? (statusMap[status] ?? String(status)) : '--';

  const getParameterTypeLabel = (type?: number) => {
    if (type === undefined || type === null) return '--';
    return parameterTypeMap[type] ?? t('key_management_0064', { value: type });
  };

  const getOperationTypeLabel = (type?: number) =>
    type ? (operationTypeMap[type] ?? String(type)) : '--';

  const getOperationStatusLabel = (status?: number) =>
    status ? (operationStatusMap[status] ?? String(status)) : '--';

  // ----- Operation Records: form + paginated query -----
  const [recordsPage, setRecordsPage] = React.useState(1);
  // Sensitive parameter values (credentials) render masked until the
  // operator explicitly reveals one; values are never logged anywhere.
  const [revealedParamIds, setRevealedParamIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const toggleParamReveal = (id: string) =>
    setRevealedParamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  const { watch, reset, control } = useForm<RecordsFilterFormValues>({
    defaultValues: RECORDS_FILTER_DEFAULTS,
  });

  const filters = watch();

  const recordsParams = React.useMemo(
    () => ({
      pageNum: recordsPage,
      pageSize: RECORDS_PAGE_SIZE,
      filters: {
        keyServiceCode: keyServiceCode ?? '',
        ...(filters.operationType && filters.operationType !== ALL_VALUE
          ? { operationType: Number(filters.operationType) }
          : {}),
      },
    }),
    [filters.operationType, recordsPage, keyServiceCode],
  );

  const {
    data: recordsData,
    isLoading: recordsLoading,
    isError: recordsError,
    error: recordsErrorValue,
    refetch: refetchRecords,
  } = useKeyServiceOperationRecordsQuery(recordsParams);

  // Upstream handleOperationTypeChange resets to page 1 on filter change.
  React.useEffect(() => {
    setRecordsPage(1);
  }, [filters.operationType]);

  const recordsRows: OperationRecordRow[] = (recordsData?.rows ?? []).map(
    (r, idx) => ({
      ...r,
      id: String(
        r.platformRecordId ??
          r.busCode ??
          `${r.keyServiceCode ?? 'record'}-${r.createdOn ?? idx}`,
      ),
    }),
  );
  // Backend total may arrive as a string — upstream coerces Number(...) || 0.
  const recordsTotal = Number(recordsData?.page?.total) || 0;

  const handleRecordsReset = () => {
    reset(RECORDS_FILTER_DEFAULTS);
    setRecordsPage(1);
  };

  const operationTypeOptions = React.useMemo(
    () => [
      { label: t('PUB_All'), value: ALL_VALUE },
      ...Object.entries(operationTypeMap).map(([value, label]) => ({
        label,
        value,
      })),
    ],
    [operationTypeMap, t],
  );

  const recordsColumns = React.useMemo<ColumnDef<OperationRecordRow>[]>(
    () => [
      {
        accessorKey: 'operationType',
        header: t('key_management_0048'),
        cell: ({ getValue }) =>
          getOperationTypeLabel(getValue() as number),
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
        accessorKey: 'comments',
        header: t('key_management_0015'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'status',
        header: t('key_management_0003'),
        cell: ({ getValue }) => {
          const status = getValue() as number;
          if (typeof status !== 'number') return '--';
          return (
            <StatusBadge
              tone={keyServiceOperationStatusToneMap[status] ?? 'default'}
              label={getOperationStatusLabel(status)}
            />
          );
        },
      },
      {
        id: 'actions',
        header: t('key_management_0062'),
        cell: () => (
          <Button variant="link" className="h-auto p-0">
            {t('key_management_0012')}
          </Button>
        ),
      },
    ],
    // Map getters depend on i18n; exhaustive-deps would flag the closures.
    [t],
  );

  const parameterColumns = React.useMemo<ColumnDef<ParameterRow>[]>(
    () => [
      {
        accessorKey: 'parameterType',
        header: t('key_management_0041'),
        cell: ({ getValue }) =>
          getParameterTypeLabel(getValue() as number | undefined),
      },
      {
        accessorKey: 'parameterKey',
        header: t('key_management_0042'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'parameterValue',
        header: t('key_management_0043'),
        cell: ({ row }) => {
          const param = row.original;
          const value = param.parameterValue;
          if (!value) return '--';
          // Security directive: credentials (private key / password / token
          // / secret / API key) are masked by default with explicit reveal.
          if (!isSensitiveParameterKey(param.parameterKey)) {
            return value;
          }
          const revealed = revealedParamIds.has(param.id);
          return (
            <span className="inline-flex items-center gap-2">
              <span className="font-mono text-xs">
                {revealed ? value : MASKED_VALUE}
              </span>
              <button
                type="button"
                aria-label={
                  revealed
                    ? t('key_management_0072')
                    : t('key_management_0071')
                }
                aria-pressed={revealed}
                onClick={() => toggleParamReveal(param.id)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {revealed ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </span>
          );
        },
      },
    ],
    [t, revealedParamIds],
  );

  const parameterRows: ParameterRow[] = (detail?.accessParameters ?? []).map(
    (item, idx) => ({
      id: `${item.parameterKey ?? idx}`,
      parameterType: item.parameterType,
      parameterKey: item.parameterKey,
      parameterValue: item.parameterValue,
    }),
  );

  const chainColumns = React.useMemo<ColumnDef<ChainRow>[]>(
    () => [
      {
        accessorKey: 'blockchain',
        header: t('key_management_0063'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'serviceProviderBlockchainName',
        header: t('key_management_0045'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'serviceProviderBlockchainId',
        header: t('key_management_0046'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
    ],
    [t],
  );

  const chainRows: ChainRow[] = (detail?.supportedChains ?? []).map(
    (item, idx) => ({
      id: `${item.blockchain ?? idx}`,
      blockchain: item.blockchain,
      serviceProviderBlockchainName: item.serviceProviderBlockchainName,
      serviceProviderBlockchainId: item.serviceProviderBlockchainId,
    }),
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
          <TabsTrigger value="basic">
            {t('key_management_0057')}
          </TabsTrigger>
          <TabsTrigger value="records">
            {t('key_management_0058')}
          </TabsTrigger>
        </TabsList>

        {/* ---------- Tab 1: Basic Information ---------- */}
        <TabsContent value="basic" className="mt-4 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-64 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
            </div>
          ) : isError ? (
            // Backend/business failures must not masquerade as empty data;
            // offer an explicit retry (matrix D8, KM-007).
            <div className="mb-4">
              <Alert variant="destructive">
                <div className="flex items-center justify-between gap-4">
                  <span>{error?.message || t('key_management_0070')}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                    {t('key_management_retry')}
                  </Button>
                </div>
              </Alert>
            </div>
          ) : (
            <>
              {/* Card A — Key Service Details (9 fields) */}
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col space-y-1.5 p-6">
                  <h3 className="text-2xl font-semibold leading-none tracking-tight">
                    {t('key_management_0038')}
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-6 p-6 pt-0 md:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label={t('key_management_0001')}>
                    {detail?.keyServiceName || '--'}
                  </DetailItem>
                  <DetailItem label={t('key_management_0003')}>
                    {/* Upstream: `detail?.status ? Tag : '--'` — 0 is unknown */}
                    {detail?.status ? (
                      <StatusBadge
                        tone={
                          keyServiceStatusToneMap[detail.status] ?? 'default'
                        }
                        label={getStatusLabel(detail.status)}
                      />
                    ) : (
                      '--'
                    )}
                  </DetailItem>
                  <DetailItem label={t('key_management_0054')}>
                    {detail?.hotWalletGroupId || '--'}
                  </DetailItem>
                  <DetailItem label={t('key_management_0055')}>
                    {detail?.coldWalletGroupId || '--'}
                  </DetailItem>
                  <DetailItem label={t('key_management_0053')}>
                    {detail?.description || '--'}
                  </DetailItem>
                  <DetailItem label={t('key_management_0049')}>
                    {detail?.createdBy || '--'}
                  </DetailItem>
                  <DetailItem label={t('key_management_0050')}>
                    {formatTimestamp(detail?.createdOn)}
                  </DetailItem>
                  <DetailItem label={t('key_management_0051')}>
                    {detail?.updatedBy || '--'}
                  </DetailItem>
                  <DetailItem label={t('key_management_0052')}>
                    {formatTimestamp(detail?.updatedOn)}
                  </DetailItem>
                </div>
              </div>

              {/* Card B — Access Parameter Details (url + Parameters table) */}
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col space-y-1.5 p-6">
                  <h3 className="text-2xl font-semibold leading-none tracking-tight">
                    {t('key_management_0039')}
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-6 p-6 pt-0">
                  <DetailItem label={t('key_management_0007')}>
                    {detail?.url || '--'}
                  </DetailItem>
                </div>
                <div className="p-6 pt-0">
                  <h4 className="mb-3 text-sm font-bold">
                    {t('key_management_0040')}
                  </h4>
                  <DataTable
                    columns={parameterColumns}
                    data={parameterRows}
                    emptyMessage={t('PUB_NoData')}
                  />
                </div>
              </div>

              {/* Card C — Supported Chains Details (table) + Back */}
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col space-y-1.5 p-6">
                  <h3 className="text-2xl font-semibold leading-none tracking-tight">
                    {t('key_management_0044')}
                  </h3>
                </div>
                <div className="p-6 pt-0">
                  <DataTable
                    columns={chainColumns}
                    data={chainRows}
                    emptyMessage={t('PUB_NoData')}
                  />
                </div>
                <div className="flex justify-end p-6 pt-0">
                  <Button onClick={() => router.back()}>
                    {t('key_management_0056')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------- Tab 2: Operation Records ---------- */}
        <TabsContent value="records" className="mt-4 space-y-6">
          {/* Query Form */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-4 text-lg font-semibold">{t('PUB_Query')}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormSelect
                name="operationType"
                control={control}
                label={t('key_management_0048')}
                options={operationTypeOptions}
                placeholder={t('PUB_All')}
              />
              <div className="flex items-end gap-2">
                <Button onClick={() => refetchRecords()}>
                  {t('PUB_Query')}
                </Button>
                <Button variant="outline" onClick={handleRecordsReset}>
                  {t('PUB_Reset')}
                </Button>
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-4 text-sm text-muted-foreground">
              {t('key_management_0047', {
                name: detail?.keyServiceName
                  ? `(${detail.keyServiceName})`
                  : '--',
              })}
            </p>
            {recordsError ? (
              <Alert variant="destructive" className="mb-3">
                <div className="flex items-center justify-between gap-4">
                  <span>{recordsErrorValue?.message || t('key_management_0061')}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchRecords()}>
                    {t('key_management_retry')}
                  </Button>
                </div>
              </Alert>
            ) : null}
            <DataTable
              columns={recordsColumns}
              data={recordsRows}
              isLoading={recordsLoading}
              emptyMessage={t('PUB_NoData')}
              pagination={{
                page: recordsPage,
                pageSize: RECORDS_PAGE_SIZE,
                total: recordsTotal,
                onPageChange: setRecordsPage,
              }}
            />
            <div className="mt-6 flex justify-end">
              <Button onClick={() => router.back()}>
                {t('key_management_0056')}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
