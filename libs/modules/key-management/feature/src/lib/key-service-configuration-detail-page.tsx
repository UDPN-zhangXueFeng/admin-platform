/**
 * KeyServiceConfigurationDetailPage — read-only detail view with two tabs.
 *
 * Tab 1 (Basic Information): three cards — Key Service Details (9 fields),
 * Access Parameter Details (url + Parameters table), and Supported Chains
 * Details (table) — with a Back button.
 * Tab 2 (Operation Records): an operationType filter + Reset + a paginated
 * DataTable backed by `useKeyServiceOperationRecordsQuery`.
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
import { ColumnDef } from '@tanstack/react-table';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  Button,
  DataTable,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';

import {
  useKeyServiceConfigurationDetailQuery,
  useKeyServiceOperationRecordsQuery,
  type KeyServiceOperationRecord,
} from '@myorg/modules/key-management/data-access';

/** Format a Unix timestamp (ms) to a locale string. */
function formatTimestamp(ts?: number): string {
  if (!ts) return '--';
  return new Date(ts).toLocaleString();
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

  const { data: detail, isLoading } =
    useKeyServiceConfigurationDetailQuery(keyServiceCode);

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

  const getStatusLabel = (status?: number) =>
    typeof status === 'number' ? (statusMap[status] ?? String(status)) : '--';

  const getParameterTypeLabel = (type?: number) => {
    if (type === undefined || type === null) return '--';
    return parameterTypeMap[type] ?? t('key_management_0064', { value: type });
  };

  const getOperationTypeLabel = (type?: number) =>
    typeof type === 'number'
      ? (operationTypeMap[type] ?? String(type))
      : '--';

  const getOperationStatusLabel = (status?: number) =>
    typeof status === 'number'
      ? (operationStatusMap[status] ?? String(status))
      : '--';

  // ----- Operation Records: form + paginated query -----
  const [recordsPage, setRecordsPage] = React.useState(1);
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

  const { data: recordsData, isLoading: recordsLoading } =
    useKeyServiceOperationRecordsQuery(recordsParams);

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
  const recordsTotal = recordsData?.page?.total ?? 0;

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
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
              {getOperationStatusLabel(status)}
            </span>
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
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
    ],
    [t],
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
                    {typeof detail?.status === 'number' ? (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                        {getStatusLabel(detail.status)}
                      </span>
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
              <div className="flex items-end">
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
