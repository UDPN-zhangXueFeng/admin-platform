/**
 * KeyPolicyConfigurationListPage — pure-mock list page.
 *
 * Architecture (pure mock, no API / no TanStack Query — see
 * .codex/plan/modules/key-policy-configuration.md §3 & §8.B):
 * - Source data   → static `policyList` from data-access (22 inline rows)
 * - Client filters→ react-hook-form + zod, applied via useMemo on the client
 * - Table         → shared DataTable with client-side pagination
 *
 * Runtime gotchas (plan §8.F):
 * - "All" option value is the non-empty sentinel 'all' (source uses '', must
 *   be 'all' to avoid SelectItem value="" crashes).
 * - i18n keys omit the namespace prefix (namespace is already
 *   modules.key-management).
 * - Rotation Methods: mock `rotationMethods` holds Title Case
 *   ("System-initiated" / "Manual approval"), so the filter Select MUST use
 *   Title Case values too — NOT util.rotationMethodOptions (kebab values,
 *   used by new/edit Radio). Using kebab here would break filtering.
 *   See plan §8.D.
 * - Disable/Enable submits are mock: console.log only, no navigation
 *   (faithful to source index.tsx handleDisableSubmit/handleEnableSubmit).
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';

import {
  policyList,
  type PolicyListItem,
} from '@myorg/modules/key-management/data-access';
import { keyPolicyStatusMap, roleNameOptions } from '@myorg/modules/key-management/util';

/** Non-empty sentinel for the "All" option — see plan §8.F. */
const ALL_VALUE = 'all';

const BASE_PATH = '/key-management/key-policy-configuration';

/**
 * Rotation Methods filter options (Title Case values).
 * Must match the mock `rotationMethods` field — see file header note.
 */
const rotationMethodFilterOptions: { label: string; value: string }[] = [
  { label: 'System-initiated', value: 'System-initiated' },
  { label: 'Manual approval', value: 'Manual approval' },
];

const filterSchema = z.object({
  roleName: z.string().optional(),
  rotationMethods: z.string().optional(),
  status: z.string().optional(),
  startCreationDate: z.string().optional(),
  endCreationDate: z.string().optional(),
});

type FilterFormValues = z.infer<typeof filterSchema>;

/** Dialog form (Disable / Enable) — Comments required, max 200 chars. */
const dialogSchema = z.object({
  comments: z
    .string()
    .min(1, 'Please enter comments')
    .max(200, 'Comments must be at most 200 characters'),
});
type DialogFormValues = z.infer<typeof dialogSchema>;

/** Tone class lookup for the status badge. */
const toneClassMap: Record<string, string> = {
  processing: 'border-blue-300 bg-blue-50 text-blue-700',
  error: 'border-red-300 bg-red-50 text-red-700',
  success: 'border-green-300 bg-green-50 text-green-700',
  default: 'border-gray-300 bg-gray-50 text-gray-700',
  warning: 'border-amber-300 bg-amber-50 text-amber-700',
};

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

export function KeyPolicyConfigurationListPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  // ----- Filter form -----
  const { register, watch, reset, control } = useForm<FilterFormValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      roleName: ALL_VALUE,
      rotationMethods: ALL_VALUE,
      status: ALL_VALUE,
      startCreationDate: '',
      endCreationDate: '',
    },
  });

  const filters = watch();

  // ----- Client-side filtering (no server request) -----
  const filteredRows = React.useMemo<PolicyListItem[]>(() => {
    return policyList.filter((item) => {
      if (
        filters.roleName &&
        filters.roleName !== ALL_VALUE &&
        item.businessName !== filters.roleName
      ) {
        return false;
      }
      if (
        filters.rotationMethods &&
        filters.rotationMethods !== ALL_VALUE &&
        item.rotationMethods !== filters.rotationMethods
      ) {
        return false;
      }
      if (
        filters.status &&
        filters.status !== ALL_VALUE &&
        item.status !== filters.status
      ) {
        return false;
      }
      const start = dateToTimestamp(filters.startCreationDate);
      const end = dateToTimestamp(filters.endCreationDate);
      if (start !== undefined && (item.createdOn ?? 0) < start) return false;
      if (end !== undefined && (item.createdOn ?? 0) > end) return false;
      return true;
    });
  }, [filters]);

  const total = filteredRows.length;

  const handleReset = () => {
    reset();
    setPage(1);
  };

  // ----- Row action handlers -----
  const goEdit = (id: number) => {
    router.push(`${BASE_PATH}/edit?id=${id}`);
  };
  const goDetail = (id: number) => {
    router.push(`${BASE_PATH}/detail?id=${id}`);
  };
  const goNew = () => {
    router.push(`${BASE_PATH}/new`);
  };

  // ----- Disable / Enable dialog (shared single dialog, mode-driven) -----
  type DialogMode = 'disable' | 'enable';
  const [dialogMode, setDialogMode] = React.useState<DialogMode | null>(null);
  const [currentRecord, setCurrentRecord] =
    React.useState<PolicyListItem | null>(null);

  const dialogForm = useForm<DialogFormValues>({
    resolver: zodResolver(dialogSchema),
    defaultValues: { comments: '' },
  });

  const openDialog = (record: PolicyListItem, mode: DialogMode) => {
    setCurrentRecord(record);
    setDialogMode(mode);
    dialogForm.reset({ comments: '' });
  };

  const closeDialog = () => {
    setDialogMode(null);
    setCurrentRecord(null);
    dialogForm.reset({ comments: '' });
  };

  const onDialogSubmit = (values: DialogFormValues) => {
    // Mock submit — faithful to source (console.log only, no navigation).
    const action = dialogMode === 'disable' ? 'Disable' : 'Enable';
    console.log(`${action}:`, {
      record: currentRecord,
      comments: values.comments,
    });
    closeDialog();
  };

  const isDisable = dialogMode === 'disable';

  // ----- Status-driven row actions (faithful to source index.tsx getActions) -----
  const renderActions = (record: PolicyListItem) => {
    const actions: React.ReactNode[] = [];
    const push = (label: string, onClick: () => void, key: string) => {
      actions.push(
        <Button
          key={key}
          variant="link"
          className="h-auto p-0"
          onClick={onClick}
        >
          {label}
        </Button>,
      );
    };

    if (record.status === 'Processing') {
      push('Details', () => goDetail(record.id), 'details');
    } else if (record.status === 'Rejected') {
      push('Resubmit', () => goEdit(record.id), 'resubmit');
      push('Details', () => goDetail(record.id), 'details');
    } else if (record.status === 'Enabled') {
      push('Edit', () => goEdit(record.id), 'edit');
      push('Disable', () => openDialog(record, 'disable'), 'disable');
      push('Details', () => goDetail(record.id), 'details');
    } else if (record.status === 'Disabled') {
      push('Edit', () => goEdit(record.id), 'edit');
      push('Enable', () => openDialog(record, 'enable'), 'enable');
      push('Details', () => goDetail(record.id), 'details');
    }
    return <div className="flex items-center gap-3">{actions}</div>;
  };

  // ----- Columns -----
  const columns = React.useMemo<ColumnDef<PolicyListItem>[]>(
    () => [
      {
        accessorKey: 'businessName',
        header: 'Role Name',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'rotationFrequency',
        header: 'Rotation Frequency',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'rotationTime',
        header: 'Rotation Time',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'rotationMethods',
        header: 'Rotation Methods',
        cell: ({ getValue }) => (getValue() as string) || '--',
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
          const status = (getValue() as string) || '';
          const entry = keyPolicyStatusMap[status];
          if (!entry) return '--';
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                toneClassMap[entry.tone] ?? toneClassMap.default
              }`}
            >
              {entry.label}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => renderActions(row.original),
      },
    ],
    [], // renderActions reads only props/closures stable for the page lifetime
  );

  // ----- Filter option sets -----
  const roleNameFilterOptions = React.useMemo(
    () => roleNameOptions.map((o) => ({ label: o.label, value: o.value })),
    [],
  );

  const statusFilterOptions = React.useMemo(
    () =>
      Object.entries(keyPolicyStatusMap).map(([value, entry]) => ({
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
            options={roleNameFilterOptions}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="rotationMethods"
            control={control}
            label="Rotation Methods"
            options={rotationMethodFilterOptions}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="status"
            control={control}
            label="Status"
            options={statusFilterOptions}
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
          <h3 className="text-lg font-semibold">Key Rotation Policy List</h3>
          <Button onClick={goNew}>+ New</Button>
        </div>

        <DataTable
          columns={columns as any}
          data={filteredRows.map((r) => ({ ...r, id: String(r.id) })) as any}
          emptyMessage={t('PUB_NoData')}
          pagination={{
            page,
            pageSize,
            total,
            onPageChange: setPage,
          }}
        />
      </div>

      {/* Disable / Enable Dialog (mode-driven, single instance) */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {isDisable
                ? 'Disable Key Rotation Policy'
                : 'Enable Key Rotation Policy'}
            </DialogTitle>
            <DialogDescription>
              {isDisable
                ? 'Once disabled, the service will become unavailable for any operations.'
                : 'Once enabled, the rotation policy will be applied to all wallets under this business role.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Business Name</Label>
              <Input value={currentRecord?.businessName ?? ''} disabled />
            </div>

            <form
              id="policy-dialog-form"
              onSubmit={dialogForm.handleSubmit(onDialogSubmit)}
              className="space-y-1.5"
            >
              <Label htmlFor="policy-comments">
                <span className="text-red-500">*</span> Comments
              </Label>
              <Textarea
                id="policy-comments"
                rows={4}
                maxLength={200}
                placeholder=""
                {...dialogForm.register('comments')}
              />
              <div className="flex items-center justify-between">
                {dialogForm.formState.errors.comments ? (
                  <span className="text-xs text-red-500">
                    {dialogForm.formState.errors.comments.message}
                  </span>
                ) : (
                  <span />
                )}
                <span className="text-muted-foreground text-xs">
                  {(dialogForm.watch('comments') ?? '').length}/200
                </span>
              </div>
            </form>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant={isDisable ? 'destructive' : 'default'}
              type="submit"
              form="policy-dialog-form"
            >
              {isDisable ? 'Disable' : 'Enable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
