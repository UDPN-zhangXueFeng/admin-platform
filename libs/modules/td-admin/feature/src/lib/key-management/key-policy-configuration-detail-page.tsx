/**
 * KeyPolicyConfigurationDetailPage — read-only detail view with two tabs.
 *
 * Tab 1 (Basic Information): a card rendering the 10 policy fields
 * (Business Name / Status / Description / Rotation Frequency / Rotation Time /
 * Rotation Methods / Created by / Created on / Updated by / Updated on) with
 * a Back button.
 * Tab 2 (Operation Records): an Operation Type filter (5 options + All) +
 * Reset + Query buttons, front-end `useMemo` filtering of `operationRecords`
 * (5 items), a paginated DataTable (6 columns), and a Back button.
 *
 * Pure mock (plan §8.B):
 * - No API / no TanStack Query. Data is imported from data-access mock-data.
 *   Confirmed 2026-10-27: upstream detail.tsx is fully static and the live
 *   backend documents no key rotation policy detail/records endpoint.
 * - Resolve the selected sample by id; unknown ids are not substituted with
 *   another policy. The standalone detail/operation examples belong only to
 *   Contract Owner and must not be presented as another sample's history.
 *
 * Architecture mirrors `managed-wallets-detail-page.tsx` (Tabs + DetailItem)
 * and `key-signed-transactions-list-page.tsx` (react-hook-form + DataTable).
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
import { formatDate } from '@myorg/shared/util-dates';

import {
  operationRecords,
  policyDetail,
  policyList,
  type OperationRecord,
  type PolicyDetail,
} from '@myorg/modules/td-admin/data-access';
import { keyPolicyStatusMap, operationRecordStatusMap } from '.';
import { operationTypeOptions } from './constants';

/** Sentinel value for the "All" filter option — must not be '' (plan §8.F). */
const ALL_VALUE = 'all';
const RECORDS_PAGE_SIZE = 10;

/** Status value → i18n key (reuses existing keys; KP_Disabled is new). */
const statusLabelKeyMap: Record<string, string> = {
  Processing: 'key_management_0020',
  Rejected: 'key_management_0021',
  Enabled: 'key_management_0018',
  Disabled: 'KP_Disabled',
};

/** Operation-record status value → i18n key (existing keys). */
const recordStatusLabelKeyMap: Record<string, string> = {
  'Pending Approval': 'key_management_0031',
  Approved: 'key_management_0033',
  Rejected: 'key_management_0021',
};

/**
 * Map an operation-record status tone (from operationRecordStatusMap) to a
 * Tailwind color class. Mirrors the source `getStatusColor` mapping:
 * 'Pending Approval' → orange (warning), 'Approved' → green (success),
 * 'Rejected' → red (error).
 */
function toneToBadgeClass(tone: string): string {
  switch (tone) {
    case 'processing':
      return 'border-blue-300 text-blue-700 bg-blue-50';
    case 'success':
      return 'border-green-500 text-green-700 bg-green-50';
    case 'warning':
      return 'border-orange-500 text-orange-700 bg-orange-50';
    case 'error':
      return 'border-red-500 text-red-700 bg-red-50';
    default:
      return 'border-gray-300 text-gray-700 bg-gray-50';
  }
}

/** DataTable row shape: mock `key` is a number → string id for the table. */
type OperationRecordRow = OperationRecord & { id: string };

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

/** react-hook-form values for the Operation Records query form. */
interface RecordsFilterFormValues {
  operationType: string;
}

const RECORDS_FILTER_DEFAULTS: RecordsFilterFormValues = {
  operationType: ALL_VALUE,
};

export function KeyPolicyConfigurationDetailPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const searchParams = useSearchParams();

  const record: PolicyDetail | null = React.useMemo(() => {
    const raw = searchParams.get('id');
    const id = raw !== null && raw !== '' ? Number(raw) : NaN;
    const match = Number.isFinite(id)
      ? policyList.find((item) => item.id === id)
      : undefined;
    if (!match) return null;
    const detailExample = match.businessName === policyDetail.businessName;
    return {
      businessName: match.businessName,
      status: match.status,
      description: match.description,
      rotationFrequency: match.rotationFrequency,
      rotationTime: match.rotationTime,
      rotationMethods: match.rotationMethods,
      createdBy: detailExample ? policyDetail.createdBy : undefined,
      createdOn: match.createdOn ? formatDate(Number(match.createdOn), 'YYYY-MM-DD HH:mm:ss') : undefined,
      updatedBy: detailExample ? policyDetail.updatedBy : undefined,
      updatedOn: detailExample ? policyDetail.updatedOn : undefined,
    };
  }, [searchParams]);

  // ----- Operation Records: form + front-end filter + pagination -----
  const [recordsPage, setRecordsPage] = React.useState(1);
  const { control, reset, getValues } = useForm<RecordsFilterFormValues>({
    defaultValues: RECORDS_FILTER_DEFAULTS,
  });

  // Committed filter — only updated on Query / Reset, so the table reflects
  // an explicit user action rather than every keystroke (source uses an
  // onChange Select; we align with the managed-wallets-detail Query-button
  // pattern per the task spec).
  const [committedOperationType, setCommittedOperationType] =
    React.useState<string>(ALL_VALUE);

  const filteredRecords = React.useMemo<OperationRecord[]>(() => {
    if (record?.businessName !== policyDetail.businessName) return [];
    if (committedOperationType === ALL_VALUE) return operationRecords;
    return operationRecords.filter(
      (recordItem) => recordItem.operationType === committedOperationType,
    );
  }, [committedOperationType, record?.businessName]);

  const recordsColumns = React.useMemo<ColumnDef<OperationRecordRow>[]>(
    () => [
      {
        accessorKey: 'operationType',
        header: t('key_management_0048'),
        cell: ({ row }) => row.original.operationType || '--',
      },
      {
        accessorKey: 'createdBy',
        header: t('key_management_0049'),
        cell: ({ row }) => row.original.createdBy || '--',
      },
      {
        accessorKey: 'createdOn',
        header: t('key_management_0005'),
        cell: ({ row }) => row.original.createdOn || '--',
      },
      {
        accessorKey: 'comments',
        header: t('key_management_0015'),
        cell: ({ row }) => row.original.comments || '--',
      },
      {
        accessorKey: 'status',
        header: t('key_management_0003'),
        cell: ({ row }) => {
          const status = row.original.status;
          const config = operationRecordStatusMap[status];
          if (!config) return status || '--';
          const labelKey = recordStatusLabelKeyMap[status];
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneToBadgeClass(
                config.tone,
              )}`}
            >
              {labelKey ? t(labelKey) : config.label}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('key_management_0062'),
        // Plan §8.C.4: source renders a `Details` span with no onClick
        // (dead link). Kept as a non-interactive placeholder to mirror it.
        cell: () => <span className="text-blue-600">Details</span>,
      },
    ],
    [t],
  );
  if (!record) {
    return (
      <div className="space-y-4">
        <p>{t('KP_PolicyNotFound')}</p>
        <Button onClick={() => router.back()}>{t('key_management_0056')}</Button>
      </div>
    );
  }


  // Policy status badge — tone from the same map the list page uses (the
  // source detail hardcodes green; wrong for Rejected/Disabled records).
  const statusEntry = record.status
    ? keyPolicyStatusMap[record.status]
    : undefined;
  const statusLabelKey = record.status
    ? statusLabelKeyMap[record.status]
    : undefined;

  return (
    <div className="space-y-6">
      {/* Demo / read-only banner — no detail API exists; data is sample-only. */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t('KP_DemoBanner')}
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
          <TabsTrigger value="basic">{t('key_management_0057')}</TabsTrigger>
          <TabsTrigger value="records">
            {t('key_management_0058')}
          </TabsTrigger>
        </TabsList>

        {/* ---------- Tab 1: Basic Information ---------- */}
        <TabsContent value="basic" className="mt-4 space-y-6">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6">
              <h3 className="text-2xl font-semibold leading-none tracking-tight">
                {t('KP_PolicyDetailsTitle')}
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 pt-0 md:grid-cols-2 lg:grid-cols-3">
              <DetailItem label={t('KP_BusinessName')}>
                {record.businessName || '--'}
              </DetailItem>
              <DetailItem label={t('key_management_0003')}>
                {statusEntry ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneToBadgeClass(
                      statusEntry.tone,
                    )}`}
                  >
                    {statusLabelKey ? t(statusLabelKey) : statusEntry.label}
                  </span>
                ) : (
                  '--'
                )}
              </DetailItem>
              <DetailItem label={t('key_management_0053')}>
                {record.description || '--'}
              </DetailItem>
              <DetailItem label={t('KP_RotationFrequency')}>
                {record.rotationFrequency || '--'}
              </DetailItem>
              <DetailItem label={t('KP_RotationTime')}>
                {record.rotationTime || '--'}
              </DetailItem>
              <DetailItem label={t('KP_RotationMethods')}>
                {record.rotationMethods || '--'}
              </DetailItem>
              <DetailItem label={t('key_management_0049')}>
                {record.createdBy || '--'}
              </DetailItem>
              <DetailItem label={t('key_management_0005')}>
                {/* Pre-formatted string (plan §8.C.1) — no formatTimestamp. */}
                {record.createdOn || '--'}
              </DetailItem>
              <DetailItem label={t('key_management_0051')}>
                {record.updatedBy || '--'}
              </DetailItem>
              <DetailItem label={t('key_management_0052')}>
                {record.updatedOn || '--'}
              </DetailItem>
            </div>
            <div className="flex justify-end p-6 pt-0">
              <Button onClick={() => router.back()}>
                {t('key_management_0056')}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ---------- Tab 2: Operation Records ---------- */}
        <TabsContent value="records" className="mt-4 space-y-6">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-4 text-sm text-muted-foreground">
              {t('key_management_0047', {
                name: `${record.businessName || '--'} Key Rotation Policy`,
              })}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormSelect
                name="operationType"
                control={control}
                label={t('key_management_0048')}
                options={[
                  { label: t('PUB_All'), value: ALL_VALUE },
                  ...operationTypeOptions,
                ]}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  reset(RECORDS_FILTER_DEFAULTS);
                  setCommittedOperationType(ALL_VALUE);
                  setRecordsPage(1);
                }}
              >
                {t('PUB_Reset')}
              </Button>
              <Button
                onClick={() => {
                  // Commit the current form value as the filter (Query-button
                  // semantics — source uses onChange; we align with the
                  // managed-wallets-detail Query pattern per the task spec).
                  setCommittedOperationType(
                    getValues('operationType') || ALL_VALUE,
                  );
                  setRecordsPage(1);
                }}
              >
                {t('PUB_Query')}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <DataTable
              columns={recordsColumns}
              data={filteredRecords.map(
                (r): OperationRecordRow => ({ ...r, id: String(r.key) }),
              )}
              emptyMessage={t('PUB_NoData')}
              pagination={{
                page: recordsPage,
                pageSize: RECORDS_PAGE_SIZE,
                total: filteredRecords.length,
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
