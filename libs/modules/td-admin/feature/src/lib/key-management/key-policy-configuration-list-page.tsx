/**
 * KeyPolicyConfigurationListPage — pure-mock list page (demo data).
 *
 * Architecture (pure mock, no API / no TanStack Query — see
 * .codex/plan/modules/key-policy-configuration.md §3 & §8.B):
 * - Source data   → static `policyList` from data-access (22 inline rows)
 * - Filters       → react-hook-form + zod, committed on Query (source
 *                   index.tsx handleQuery applies filters on button click;
 *                   Reset restores the full list — same two-step semantics)
 * - Table         → shared DataTable with client-side pagination
 *
 * Backend status (confirmed 2026-10-27, Main via aps /api/manage/v3/api-docs):
 * - Upstream td-manage index.tsx is fully static (`staticData`, handlers
 *   console.log only) and the live backend documents NO key rotation policy
 *   CRUD/enable/disable endpoint. Do NOT wire this page to any API.
 * - Disable/Enable therefore cannot persist anything: confirming the dialog
 *   logs the payload and shows an explicit demo notice instead of implying
 *   success. The row state never changes.
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
 *   See plan §8.D. Option LABELS are localized; matching stays on the raw
 *   data value (data values are displayed as-is per repo convention).
 * - Date range compares LOCAL midnight timestamps (source: dayjs
 *   RangePicker values compared with valueOf(); `new Date('YYYY-MM-DD')`
 *   would parse as UTC and shift the window).
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { formatDate } from '@myorg/shared/util-dates';
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
} from '@myorg/modules/td-admin/data-access';
import { keyPolicyStatusMap, roleNameOptions } from '.';

/** Non-empty sentinel for the "All" option — see plan §8.F. */
const ALL_VALUE = 'all';

const BASE_PATH = '/key-management/key-policy-configuration';
/**
 * DataTable row shape: `TData extends { id: string }` — mock `id` is a
 * number, so rows are presented with a string id.
 */
type PolicyListRow = Omit<PolicyListItem, 'id'> & { id: string };

/**
 * Rotation Methods filter options (Title Case raw data values for matching;
 * labels resolved through i18n at render time).
 */
const rotationMethodFilterValues: { labelKey: string; value: string }[] = [
  { labelKey: 'KP_SystemInitiated', value: 'System-initiated' },
  { labelKey: 'KP_ManualApproval', value: 'Manual approval' },
];

/** Status value → i18n key (reuses existing keys; KP_Disabled is new). */
const statusLabelKeyMap: Record<string, string> = {
  Processing: 'key_management_0020',
  Rejected: 'key_management_0021',
  Enabled: 'key_management_0018',
  Disabled: 'KP_Disabled',
};

type FilterFormValues = {
  roleName: string;
  rotationMethods: string;
  status: string;
  startCreationDate: string;
  endCreationDate: string;
};

/** Tone class lookup for the status badge. */
const toneClassMap: Record<string, string> = {
  processing: 'border-blue-300 bg-blue-50 text-blue-700',
  error: 'border-red-300 bg-red-50 text-red-700',
  success: 'border-green-300 bg-green-50 text-green-700',
  default: 'border-gray-300 bg-gray-50 text-gray-700',
  warning: 'border-amber-300 bg-amber-50 text-amber-700',
};

/**
 * Format a Unix timestamp (ms) with the portal-wide deterministic format (matrix D2).
 */
function formatTimestamp(ts?: number): string {
  if (!ts) return '--';
  return formatDate(Number(ts), 'YYYY-MM-DD HH:mm:ss');
}

/**
 * Convert an ISO date string (yyyy-mm-dd) to a LOCAL-midnight ms timestamp
 * (source compares dayjs day objects with valueOf() — local zone).
 */
function dateToTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d).getTime();
}

export function KeyPolicyConfigurationListPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  // ----- Filter form -----
  const { register, reset, getValues, control } =
    useForm<FilterFormValues>({
      defaultValues: {
        roleName: ALL_VALUE,
        rotationMethods: ALL_VALUE,
        status: ALL_VALUE,
        startCreationDate: '',
        endCreationDate: '',
      },
    });

  // ----- Client-side filtering, committed on Query (source handleQuery) -----
  const [committed, setCommitted] = React.useState<FilterFormValues | null>(
    null,
  );

  const filteredRows = React.useMemo<PolicyListItem[]>(() => {
    const f = committed;
    if (!f) return policyList;
    const start = dateToTimestamp(f.startCreationDate);
    const endStart = dateToTimestamp(f.endCreationDate);
    const endExclusive = endStart === undefined ? undefined : (() => {
      const nextDay = new Date(endStart);
      nextDay.setDate(nextDay.getDate() + 1);
      return nextDay.getTime();
    })();
    return policyList.filter((item) => {
      if (f.roleName && f.roleName !== ALL_VALUE) {
        if (item.businessName !== f.roleName) return false;
      }
      if (f.rotationMethods && f.rotationMethods !== ALL_VALUE) {
        if (item.rotationMethods !== f.rotationMethods) return false;
      }
      if (f.status && f.status !== ALL_VALUE) {
        if (item.status !== f.status) return false;
      }
      if (start !== undefined && (item.createdOn ?? 0) < start) return false;
      if (endExclusive !== undefined && (item.createdOn ?? 0) >= endExclusive) return false;
      return true;
    });
  }, [committed]);

  const total = filteredRows.length;

  const handleQuery = () => {
    setCommitted(getValues());
    setPage(1);
  };

  const handleReset = () => {
    reset();
    setCommitted(null);
    setPage(1);
  };

  // ----- Row action handlers -----
  const goEdit = (id: string) => {
    router.push(`${BASE_PATH}/edit?id=${id}`);
  };
  const goDetail = (id: string) => {
    router.push(`${BASE_PATH}/detail?id=${id}`);
  };
  const goNew = () => {
    router.push(`${BASE_PATH}/new`);
  };

  // ----- Disable / Enable dialog (shared single dialog, mode-driven) -----
  type DialogMode = 'disable' | 'enable';
  const [dialogMode, setDialogMode] = React.useState<DialogMode | null>(null);
  const [currentRecord, setCurrentRecord] =
    React.useState<PolicyListRow | null>(null);
  /** Set after confirm — swaps the dialog body to the explicit demo notice. */
  const [demoNotice, setDemoNotice] = React.useState(false);

  const dialogSchema = React.useMemo(
    () =>
      z.object({
        comments: z
          .string()
          .min(1, t('key_management_0016'))
          .max(200, t('KP_CommentsMaxLength')),
      }),
    [t],
  );
  type DialogFormValues = z.infer<typeof dialogSchema>;

  const dialogForm = useForm<DialogFormValues>({
    resolver: zodResolver(dialogSchema),
    defaultValues: { comments: '' },
  });

  const openDialog = (record: PolicyListRow, mode: DialogMode) => {
    setCurrentRecord(record);
    setDialogMode(mode);
    setDemoNotice(false);
    dialogForm.reset({ comments: '' });
  };

  const closeDialog = () => {
    setDialogMode(null);
    setCurrentRecord(null);
    setDemoNotice(false);
    dialogForm.reset({ comments: '' });
  };

  const onDialogSubmit = (values: DialogFormValues) => {
    // No backend endpoint exists (upstream handlers are no-ops and the live
    // schema documents none). Never imply persistence: keep the record state
    // and swap the dialog body to the demo notice. The form payload is
    // deliberately NOT logged (user input, nothing to persist).
    void values;
    setDemoNotice(true);
  };

  const isDisable = dialogMode === 'disable';

  // ----- Status-driven row actions (faithful to source index.tsx getActions) -----
  const renderActions = (record: PolicyListRow) => {
    const actions: React.ReactNode[] = [];
    const push = (
      label: string,
      onClick: () => void,
      key: string,
    ) => {
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
      push(t('key_management_0012'), () => goDetail(record.id), 'details');
    } else if (record.status === 'Rejected') {
      push(t('key_management_0028'), () => goEdit(record.id), 'resubmit');
      push(t('key_management_0012'), () => goDetail(record.id), 'details');
    } else if (record.status === 'Enabled') {
      push(t('key_management_0010'), () => goEdit(record.id), 'edit');
      push(t('KP_Disable'), () => openDialog(record, 'disable'), 'disable');
      push(t('key_management_0012'), () => goDetail(record.id), 'details');
    } else if (record.status === 'Disabled') {
      push(t('key_management_0010'), () => goEdit(record.id), 'edit');
      push(t('key_management_0026'), () => openDialog(record, 'enable'), 'enable');
      push(t('key_management_0012'), () => goDetail(record.id), 'details');
    }
    return <div className="flex items-center gap-3">{actions}</div>;
  };

  // ----- Columns -----
  const columns = React.useMemo<ColumnDef<PolicyListRow>[]>(
    () => [
      {
        accessorKey: 'businessName',
        header: t('KP_RoleName'),
        cell: ({ row }) => row.original.businessName || '--',
      },
      {
        accessorKey: 'description',
        header: t('key_management_0053'),
        cell: ({ row }) => row.original.description || '--',
      },
      {
        accessorKey: 'rotationFrequency',
        header: t('KP_RotationFrequency'),
        cell: ({ row }) => row.original.rotationFrequency || '--',
      },
      {
        accessorKey: 'rotationTime',
        header: t('KP_RotationTime'),
        cell: ({ row }) => row.original.rotationTime || '--',
      },
      {
        accessorKey: 'rotationMethods',
        header: t('KP_RotationMethods'),
        cell: ({ row }) => row.original.rotationMethods || '--',
      },
      {
        accessorKey: 'createdOn',
        header: t('key_management_0005'),
        cell: ({ row }) => formatTimestamp(row.original.createdOn),
      },
      {
        accessorKey: 'status',
        header: t('key_management_0003'),
        cell: ({ row }) => {
          const status = row.original.status || '';
          const entry = keyPolicyStatusMap[status];
          if (!entry) return '--';
          const labelKey = statusLabelKeyMap[status];
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                toneClassMap[entry.tone] ?? toneClassMap.default
              }`}
            >
              {labelKey ? t(labelKey) : entry.label}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('key_management_0062'),
        cell: ({ row }) => renderActions(row.original),
      },
      // renderActions reads only props/closures stable for the page lifetime
    ],
    [t],
  );

  // ----- Filter option sets -----
  const roleNameFilterOptions = React.useMemo(
    () => [
      { label: t('PUB_All'), value: ALL_VALUE },
      ...roleNameOptions.map((o) => ({ label: o.label, value: o.value })),
    ],
    [t],
  );

  const statusFilterOptions = React.useMemo(
    () => [
      { label: t('PUB_All'), value: ALL_VALUE },
      ...Object.keys(keyPolicyStatusMap).map((value) => ({
        label: statusLabelKeyMap[value]
          ? t(statusLabelKeyMap[value])
          : keyPolicyStatusMap[value].label,
        value,
      })),
    ],
    [t],
  );

  const rotationMethodOptions = React.useMemo(
    () => [
      { label: t('PUB_All'), value: ALL_VALUE },
      ...rotationMethodFilterValues.map((o) => ({
        label: t(o.labelKey),
        value: o.value,
      })),
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      {/* Demo / read-only banner — no policy API exists; data is sample-only. */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t('KP_DemoBanner')}
      </div>

      {/* Query Form */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-lg font-semibold">{t('PUB_Query')}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FormSelect
            name="roleName"
            control={control}
            label={t('KP_RoleName')}
            options={roleNameFilterOptions}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="rotationMethods"
            control={control}
            label={t('KP_RotationMethods')}
            options={rotationMethodOptions}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="status"
            control={control}
            label={t('key_management_0003')}
            options={statusFilterOptions}
            placeholder={t('PUB_All')}
          />
          <div>
            <label className="text-sm font-medium">
              {t('key_management_0002')}
            </label>
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
          <Button onClick={handleQuery}>{t('PUB_Query')}</Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('KP_PolicyListTitle')}</h3>
          <Button onClick={goNew}>{t('KP_NewButton')}</Button>
        </div>

        <DataTable
          columns={columns}
          data={filteredRows.map(
            (r): PolicyListRow => ({ ...r, id: String(r.id) }),
          )}
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
      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {isDisable
                ? t('KP_DisableDialogTitle')
                : t('KP_EnableDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {isDisable ? t('KP_DisableDialogDesc') : t('KP_EnableDialogDesc')}
            </DialogDescription>
          </DialogHeader>

          {demoNotice ? (
            /* Post-confirm state — explicit, cannot be mistaken for a save. */
            <div className="space-y-4">
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t('KP_DemoSubmitNotice')}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  {t('key_management_0017')}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('KP_BusinessName')}</Label>
                <Input value={currentRecord?.businessName ?? ''} disabled />
                <p className="text-xs text-amber-700">
                  {t('KP_DemoActionHint')}
                </p>
              </div>
              <form
                id="policy-dialog-form"
                onSubmit={dialogForm.handleSubmit(onDialogSubmit)}
                className="space-y-1.5"
              >
                <Label htmlFor="policy-comments">
                  <span className="text-red-500">*</span>{' '}
                  {t('key_management_0015')}
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

              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  {t('key_management_0017')}
                </Button>
                <Button
                  variant={isDisable ? 'destructive' : 'default'}
                  type="submit"
                  form="policy-dialog-form"
                >
                  {isDisable ? t('KP_DisableDemo') : t('KP_EnableDemo')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
