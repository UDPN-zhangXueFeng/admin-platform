/**
 * KeyServiceConfigurationListPage — landing list with filters, status-driven
 * row actions, a Deprecate dialog, and Configure entry point.
 *
 * Data: `useKeyServiceConfigurationsQuery` (POST /key/config/keyServiceList,
 * defined in the key-signed-transactions data-access module).
 * All labels are localized via `t()`; the Deprecate submit is mock-only
 * (console.log — faithful to source).
 *
 * Source: td-manage/src/pages/key-management/key-service-configuration/index.tsx
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { useRouter } from '@myorg/shared/util-i18n';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@myorg/shared/ui';
import { DatePicker } from '@myorg/shared/ui-forms';

import {
  type KeyServiceConfiguration,
  useKeyServiceConfigurationsQuery,
} from '@myorg/modules/key-management/data-access';

/** Non-empty sentinel — SelectItem forbids an empty-string value. */
const ALL_STATUS_VALUE = 'all-statuses';
const PAGE_SIZE = 10;
const BASE_PATH = '/key-management/key-service-configuration';

const dialogSchema = z.object({
  comments: z
    .string()
    .min(1, 'Please enter comments')
    .max(200, 'Maximum 200 characters'),
});
type DialogFormValues = z.infer<typeof dialogSchema>;

function formatTimestamp(value?: number): string {
  return value ? new Date(value).toLocaleString() : '--';
}

/** Split the comma-separated supported-chains string into a trimmed array. */
function parseSupportedChains(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((chain) => chain.trim())
    .filter(Boolean);
}

/** Key Service Configuration landing page migrated from td-manage. */
export function KeyServiceConfigurationListPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();

  const [page, setPage] = React.useState(1);
  const [keyServiceName, setKeyServiceName] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [startCreateDate, setStartCreateDate] = React.useState('');
  const [endCreateDate, setEndCreateDate] = React.useState('');

  const { data, isLoading, isFetching } = useKeyServiceConfigurationsQuery({
    pageNum: page,
    pageSize: PAGE_SIZE,
    filters: {
      keyServiceName: keyServiceName || undefined,
      status: status ? Number(status) : undefined,
      startCreateDate: startCreateDate
        ? startOfDay(parseISO(startCreateDate)).getTime()
        : undefined,
      endCreateDate: endCreateDate
        ? endOfDay(parseISO(endCreateDate)).getTime()
        : undefined,
    },
  });

  // ----- Status label map (i18n) -----
  const statusMap = React.useMemo<Record<number, string>>(
    () => ({
      1: t('key_management_0018'),
      2: t('key_management_0019'),
      3: t('key_management_0020'),
      4: t('key_management_0021'),
    }),
    [t],
  );

  const getStatusLabel = (value?: number) =>
    typeof value === 'number' ? (statusMap[value] ?? String(value)) : '--';

  // ----- supportedChains ">2 show +N" folding -----
  const renderSupportedChains = (chains?: string) => {
    const parsed = parseSupportedChains(chains);
    if (!parsed.length) return '--';
    if (parsed.length <= 2) return parsed.join(', ');
    return (
      <span>
        {parsed.slice(0, 2).join(', ')}
        <span className="ml-1 text-primary">
          {t('key_management_0022', { count: parsed.length - 2 })}
        </span>
      </span>
    );
  };

  // ----- Navigation -----
  const goConfigure = () => router.push(`${BASE_PATH}/configure`);
  const goEdit = (keyServiceCode?: string) => {
    if (!keyServiceCode) return;
    router.push(`${BASE_PATH}/edit?id=${keyServiceCode}`);
  };
  const goDetail = (keyServiceCode?: string) => {
    if (!keyServiceCode) return;
    router.push(`${BASE_PATH}/detail?id=${keyServiceCode}`);
  };

  // ----- Deprecate dialog -----
  const [deprecateOpen, setDeprecateOpen] = React.useState(false);
  const [currentRecord, setCurrentRecord] =
    React.useState<KeyServiceConfiguration | null>(null);

  const dialogForm = useForm<DialogFormValues>({
    resolver: zodResolver(dialogSchema),
    defaultValues: { comments: '' },
  });

  const openDeprecate = (record: KeyServiceConfiguration) => {
    setCurrentRecord(record);
    setDeprecateOpen(true);
    dialogForm.reset({ comments: '' });
  };

  const closeDeprecate = () => {
    setDeprecateOpen(false);
    setCurrentRecord(null);
    dialogForm.reset({ comments: '' });
  };

  const onDeprecateSubmit = (values: DialogFormValues) => {
    // Mock submit — faithful to source (console.log only, no navigation).
    console.log('Deprecate:', {
      record: currentRecord,
      comments: values.comments,
    });
    closeDeprecate();
  };

  // ----- Status-driven row actions (mirrors source index.tsx) -----
  const renderActions = (record: KeyServiceConfiguration) => {
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

    // 1=Enabled → Edit + Deprecate + Details
    // 4=Rejected → Resubmit + Details
    // 2=Deprecated / 3=Processing → Details only
    if (record.status === 1) {
      push(t('key_management_0010'), () => goEdit(record.keyServiceCode), 'edit');
      push(t('key_management_0011'), () => openDeprecate(record), 'deprecate');
      push(t('key_management_0012'), () => goDetail(record.keyServiceCode), 'details');
    } else if (record.status === 4) {
      push(t('key_management_0028'), () => goEdit(record.keyServiceCode), 'resubmit');
      push(t('key_management_0012'), () => goDetail(record.keyServiceCode), 'details');
    } else {
      push(t('key_management_0012'), () => goDetail(record.keyServiceCode), 'details');
    }
    return <div className="flex items-center gap-3">{actions}</div>;
  };

  // ----- Columns -----
  const columns = React.useMemo<ColumnDef<KeyServiceConfiguration>[]>(
    () => [
      {
        accessorKey: 'keyServiceName',
        header: t('key_management_0001'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'url',
        header: t('key_management_0007'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'supportedChains',
        header: t('key_management_0004'),
        cell: ({ getValue }) =>
          renderSupportedChains(getValue() as string | undefined),
      },
      {
        accessorKey: 'createdOn',
        header: t('key_management_0005'),
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'lastUpdated',
        header: t('key_management_0006'),
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'status',
        header: t('key_management_0003'),
        cell: ({ getValue }) => {
          const value = getValue() as number;
          if (typeof value !== 'number') return '--';
          return (
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
              {getStatusLabel(value)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('key_management_0062'),
        cell: ({ row }) => renderActions(row.original),
      },
    ],
    // renderActions / maps read only i18n-stable closures.
    [t],
  );

  const handleReset = () => {
    setKeyServiceName('');
    setStatus('');
    setStartCreateDate('');
    setEndCreateDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Query Form */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-lg font-semibold">{t('PUB_Query')}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="ksc-filter-name"
            >
              {t('key_management_0001')}
            </label>
            <Input
              id="ksc-filter-name"
              value={keyServiceName}
              onChange={(event) => {
                setKeyServiceName(event.target.value);
                setPage(1);
              }}
              placeholder=""
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t('key_management_0003')}
            </label>
            <Select
              value={status || ALL_STATUS_VALUE}
              onValueChange={(value) => {
                setStatus(value === ALL_STATUS_VALUE ? '' : value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label={t('key_management_0003')}>
                <SelectValue placeholder={t('PUB_All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUS_VALUE}>{t('PUB_All')}</SelectItem>
                {Object.entries(statusMap).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="ksc-filter-start"
            >
              {t('key_management_0002')}
            </label>
            <DatePicker
              id="ksc-filter-start"
              value={startCreateDate}
              onChange={(value) => {
                setStartCreateDate(value);
                setPage(1);
              }}
              ariaLabel={t('key_management_0002')}
            />
          </div>
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="ksc-filter-end"
            >
              {t('key_management_0002')}
            </label>
            <DatePicker
              id="ksc-filter-end"
              value={endCreateDate}
              onChange={(value) => {
                setEndCreateDate(value);
                setPage(1);
              }}
              ariaLabel={t('key_management_0002')}
            />
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
          <h3 className="text-lg font-semibold">
            {t('key_management_0008')}
          </h3>
          <Button onClick={goConfigure}>{t('key_management_0009')}</Button>
        </div>

        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          isLoading={isLoading || isFetching}
          emptyMessage={t('PUB_NoData')}
          pagination={{
            page,
            pageSize: data?.page?.pageSize ?? PAGE_SIZE,
            total: data?.page?.total ?? 0,
            onPageChange: setPage,
          }}
        />
      </div>

      {/* Deprecate Dialog */}
      <Dialog
        open={deprecateOpen}
        onOpenChange={(open) => !open && closeDeprecate()}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('key_management_0013')}</DialogTitle>
            <DialogDescription>{t('key_management_0014')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('key_management_0001')}</Label>
              <Input
                value={currentRecord?.keyServiceName ?? ''}
                disabled
                readOnly
              />
            </div>

            <form
              id="ksc-deprecate-form"
              onSubmit={dialogForm.handleSubmit(onDeprecateSubmit)}
              className="space-y-1.5"
            >
              <Label htmlFor="ksc-comments">
                <span className="text-destructive">*</span>{' '}
                {t('key_management_0015')}
              </Label>
              <Textarea
                id="ksc-comments"
                rows={4}
                maxLength={200}
                placeholder=""
                {...dialogForm.register('comments')}
              />
              <div className="flex items-center justify-between">
                {dialogForm.formState.errors.comments ? (
                  <span className="text-xs text-destructive">
                    {dialogForm.formState.errors.comments.message}
                  </span>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground">
                  {(dialogForm.watch('comments') ?? '').length}/200
                </span>
              </div>
            </form>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDeprecate}>
              {t('key_management_0017')}
            </Button>
            <Button
              variant="destructive"
              type="submit"
              form="ksc-deprecate-form"
            >
              {t('key_management_0011')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
