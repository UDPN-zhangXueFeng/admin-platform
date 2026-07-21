/**
 * KeyPolicyConfigurationDetailPage — read-only detail view with two tabs.
 *
 * Tab 1 (Basic Information): a single card rendering the 10 fields of
 * `policyDetail` (Business Name / Status / Description / Rotation Frequency /
 * Rotation Time / Rotation Methods / Created by / Created on / Updated by /
 * Updated on) with a Back button.
 * Tab 2 (Operation Records): an Operation Type filter (5 options + All) +
 * Reset + Query buttons, front-end `useMemo` filtering of `operationRecords`
 * (5 items), a paginated DataTable (6 columns), and a Back button.
 *
 * Pure mock (plan §8.B):
 * - No API / no TanStack Query. Data is imported from data-access mock-data.
 * - Detail does NOT query by id (plan §8.C.3): the source `detail.tsx`
 *   ignores `?id=` and always shows the hardcoded `keyPolicyData`. We keep
 *   that mock behavior — read `id` for semantic parity but always render
 *   `policyDetail`.
 * - Operation Records Actions column renders a `Details` placeholder with
 *   no onClick (plan §8.C.4 dead link), mirroring the source.
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

import {
  policyDetail,
  operationRecords,
  type OperationRecord,
} from '@myorg/modules/key-management/data-access';
import {
  operationRecordStatusMap,
  operationTypeOptions,
} from '@myorg/modules/key-management/util';

/** Sentinel value for the "All" filter option — must not be '' (plan §8.F). */
const ALL_VALUE = 'all';
const RECORDS_PAGE_SIZE = 10;

/**
 * Map an operation-record status tone (from operationRecordStatusMap) to a
 * Tailwind color class. Mirrors the source `getStatusColor` mapping:
 * 'Pending Approval' → orange (warning), 'Approved' → green (success),
 * 'Rejected' → red (error).
 */
function toneToBadgeClass(tone: string): string {
  switch (tone) {
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

/** Operation Type options: explicit "All" + the 5 source operation types. */
const operationTypeFilterOptions = [
  { label: 'All', value: ALL_VALUE },
  ...operationTypeOptions,
];

export function KeyPolicyConfigurationDetailPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read `id` for semantic parity, but do NOT query by it (plan §8.C.3).
  // The source always renders the hardcoded keyPolicyData; we mirror that
  // by always rendering policyDetail.
  void searchParams.get('id');

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
    if (committedOperationType === ALL_VALUE) return operationRecords;
    return operationRecords.filter(
      (record) => record.operationType === committedOperationType,
    );
  }, [committedOperationType]);

  const recordsColumns = React.useMemo<ColumnDef<OperationRecord>[]>(
    () => [
      {
        accessorKey: 'operationType',
        header: 'Operation Type',
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
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'comments',
        header: 'Comments',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const config = operationRecordStatusMap[status];
          if (!config) return status || '--';
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneToBadgeClass(
                config.tone,
              )}`}
            >
              {config.label}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        // Plan §8.C.4: source renders a `Details` span with no onClick
        // (dead link). Kept as a non-interactive placeholder to mirror it.
        cell: () => (
          <span className="text-blue-600">Details</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
          <TabsTrigger value="basic">Basic Information</TabsTrigger>
          <TabsTrigger value="records">Operation Records</TabsTrigger>
        </TabsList>

        {/* ---------- Tab 1: Basic Information ---------- */}
        <TabsContent value="basic" className="mt-4 space-y-6">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6">
              <h3 className="text-2xl font-semibold leading-none tracking-tight">
                Key Rotation Policy Details
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 pt-0 md:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Business Name">
                {policyDetail.businessName || '--'}
              </DetailItem>
              <DetailItem label="Status">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneToBadgeClass(
                    'success',
                  )}`}
                >
                  {/* Plan §7 step 5: source Tab1 hardcodes green for status. */}
                  {policyDetail.status || '--'}
                </span>
              </DetailItem>
              <DetailItem label="Description">
                {policyDetail.description || '--'}
              </DetailItem>
              <DetailItem label="Rotation Frequency">
                {policyDetail.rotationFrequency || '--'}
              </DetailItem>
              <DetailItem label="Rotation Time">
                {policyDetail.rotationTime || '--'}
              </DetailItem>
              <DetailItem label="Rotation Methods">
                {policyDetail.rotationMethods || '--'}
              </DetailItem>
              <DetailItem label="Created by">
                {policyDetail.createdBy || '--'}
              </DetailItem>
              <DetailItem label="Created on">
                {/* Pre-formatted string (plan §8.C.1) — no formatTimestamp. */}
                {policyDetail.createdOn || '--'}
              </DetailItem>
              <DetailItem label="Updated by">
                {policyDetail.updatedBy || '--'}
              </DetailItem>
              <DetailItem label="Updated on">
                {policyDetail.updatedOn || '--'}
              </DetailItem>
            </div>
            <div className="flex justify-end p-6 pt-0">
              <Button onClick={() => router.back()}>Back</Button>
            </div>
          </div>
        </TabsContent>

        {/* ---------- Tab 2: Operation Records ---------- */}
        <TabsContent value="records" className="mt-4 space-y-6">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-4 text-sm text-muted-foreground">
              Displays all activity logs related to the{' '}
              <span className="font-bold">
                {'(Contract Owner Key Rotation Policy)'}
              </span>
              .
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormSelect
                name="operationType"
                control={control}
                label="Operation Type"
                options={operationTypeFilterOptions}
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
              columns={recordsColumns as any}
              data={filteredRecords.map((r) => ({
                ...r,
                id: String(r.key),
              })) as any}
              emptyMessage={t('PUB_NoData')}
              pagination={{
                page: recordsPage,
                pageSize: RECORDS_PAGE_SIZE,
                total: filteredRecords.length,
                onPageChange: setRecordsPage,
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
