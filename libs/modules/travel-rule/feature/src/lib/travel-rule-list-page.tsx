'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';

import {
  Button,
  CopyableEllipsisText,
  DataTable,
} from '@myorg/shared/ui';
import {
  FormDatePicker,
  FormField,
  FormSelect,
} from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';

import { TravelRuleStatusBadge } from '@myorg/modules/travel-rule/ui';
import {
  useTravelRulesQuery,
  type TravelRuleItem,
  type TravelRuleQueryParams,
  type TransactionType,
  type VerificationStatus,
} from '@myorg/modules/travel-rule/data-access';

/**
 * react-hook-form shape for the query form.
 *
 * Every field is an optional string; an empty string means "no filter". Date
 * ranges are captured as two `YYYY-MM-DD` strings and combined into a
 * `[fromMs, toMs]` tuple before being handed to the query.
 */
interface TravelRuleFilterForm {
  transactionHash?: string;
  senderWallet?: string;
  receivingSP?: string;
  receiverWallet?: string;
  travelRuleHash?: string;
  tokenName?: string;
  sendingSP?: string;
  transactionType?: string;
  verificationStatus?: string;
  transactionTimeFrom?: string;
  transactionTimeTo?: string;
  confirmationTimeFrom?: string;
  confirmationTimeTo?: string;
}

const EMPTY_FORM: TravelRuleFilterForm = {
  transactionHash: '',
  senderWallet: '',
  receivingSP: '',
  receiverWallet: '',
  travelRuleHash: '',
  tokenName: '',
  sendingSP: '',
  transactionType: 'all',
  verificationStatus: 'all',
  transactionTimeFrom: '',
  transactionTimeTo: '',
  confirmationTimeFrom: '',
  confirmationTimeTo: '',
};

/** `stablecoin` is the default active project (see configs/stablecoin.json). */
const PROJECT_ID = 'stablecoin';

/** Build an inclusive `[fromMs, toMs]` range from two date strings. */
function toDateRange(from?: string, to?: string): [number, number] | undefined {
  if (!from || !to) return undefined;
  return [startOfDay(parseISO(from)).getTime(), endOfDay(parseISO(to)).getTime()];
}

/** Translate the RHF filter form into the query params consumed by the query. */
function formToParams(form: TravelRuleFilterForm): TravelRuleQueryParams {
  return {
    page: 1,
    pageSize: 10,
    transactionHash: form.transactionHash || undefined,
    senderWallet: form.senderWallet || undefined,
    receivingSP: form.receivingSP || undefined,
    receiverWallet: form.receiverWallet || undefined,
    travelRuleHash: form.travelRuleHash || undefined,
    tokenName: form.tokenName || undefined,
    sendingSP: form.sendingSP || undefined,
    transactionType:
      form.transactionType && form.transactionType !== 'all'
        ? (form.transactionType as TransactionType)
        : undefined,
    verificationStatus:
      form.verificationStatus && form.verificationStatus !== 'all'
        ? (form.verificationStatus as VerificationStatus)
        : undefined,
    transactionTime: toDateRange(form.transactionTimeFrom, form.transactionTimeTo),
    confirmationTime: toDateRange(form.confirmationTimeFrom, form.confirmationTimeTo),
  };
}

/**
 * TravelRuleListPage — query form + DataTable over the (mock) travel-rule data.
 *
 * - Query form: react-hook-form. Filtering is applied on submit (Query) and
 *   cleared on Reset — matching the source page's UX.
 * - Data: `useTravelRulesQuery` returns the local mock with client-side
 *   filtering already applied (PRD §8 — swap the queryFn later, page unchanged).
 * - Columns: hash/wallet fields use CopyableEllipsisText; the status column uses
 *   TravelRuleStatusBadge; timestamps render via formatDate (null → '--').
 */
export function TravelRuleListPage() {
  const t = useTranslations('modules.travel-rule');
  const { register, control, handleSubmit, reset } =
    useForm<TravelRuleFilterForm>({ defaultValues: EMPTY_FORM });

  const [params, setParams] = React.useState<TravelRuleQueryParams>(() =>
    formToParams(EMPTY_FORM)
  );
  const { data, isLoading } = useTravelRulesQuery(PROJECT_ID, params);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSubmit = React.useCallback((form: TravelRuleFilterForm) => {
    setParams(formToParams(form));
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setParams(formToParams(EMPTY_FORM));
  }, [reset]);

  const statusLabels = React.useMemo<Record<VerificationStatus, string>>(
    () => ({
      Pending: t('status.Pending'),
      Verified: t('status.Verified'),
      Rejected: t('status.Rejected'),
    }),
    [t]
  );

  const transactionTypeOptions = React.useMemo(
    () => [
      { value: 'all', label: t('transactionType.all') },
      { value: 'Transfer', label: t('transactionType.transfer') },
      { value: 'Authorized Transfer', label: t('transactionType.authorizedTransfer') },
    ],
    [t]
  );

  const statusOptions = React.useMemo(
    () => [
      { value: 'all', label: t('statusFilter.all') },
      { value: 'Pending', label: t('statusFilter.Pending') },
      { value: 'Verified', label: t('statusFilter.Verified') },
      { value: 'Rejected', label: t('statusFilter.Rejected') },
    ],
    [t]
  );

  const columns = React.useMemo<ColumnDef<TravelRuleItem>[]>(
    () => [
      {
        accessorKey: 'transactionHash',
        header: t('field.transactionHash'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.transactionHash} copyLabel={t('copy')} />
        ),
      },
      { accessorKey: 'tokenName', header: t('field.tokenName') },
      { accessorKey: 'sendingSP', header: t('field.sendingSp') },
      {
        accessorKey: 'senderWallet',
        header: t('field.senderWallet'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.senderWallet} copyLabel={t('copy')} />
        ),
      },
      { accessorKey: 'receivingSP', header: t('field.receivingSp') },
      {
        accessorKey: 'receiverWallet',
        header: t('field.receiverWallet'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.receiverWallet} copyLabel={t('copy')} />
        ),
      },
      {
        accessorKey: 'travelRuleHash',
        header: t('field.travelRuleHash'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.travelRuleHash} copyLabel={t('copy')} />
        ),
      },
      {
        accessorKey: 'verificationStatus',
        header: t('field.verificationStatus'),
        cell: ({ row }) => (
          <TravelRuleStatusBadge
            status={row.original.verificationStatus}
            label={statusLabels[row.original.verificationStatus]}
          />
        ),
      },
      {
        accessorKey: 'confirmationTime',
        header: t('field.confirmationTime'),
        cell: ({ row }) =>
          row.original.confirmationTime == null ? (
            <span className="text-muted-foreground">--</span>
          ) : (
            <span>{formatDate(new Date(row.original.confirmationTime))}</span>
          ),
      },
      { accessorKey: 'transactionType', header: t('field.transactionType') },
      { accessorKey: 'transactionAmount', header: t('field.transactionAmount') },
      {
        accessorKey: 'transactionTime',
        header: t('field.transactionTime'),
        cell: ({ row }) => (
          <span>{formatDate(new Date(row.original.transactionTime))}</span>
        ),
      },
    ],
    [t, statusLabels]
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">{t('query')}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="transactionHash"
            label={t('field.transactionHash')}
            register={register('transactionHash')}
            placeholder={t('placeholder.transactionHash')}
          />
          <FormField
            name="senderWallet"
            label={t('field.senderWallet')}
            register={register('senderWallet')}
            placeholder={t('placeholder.senderWallet')}
          />
          <FormField
            name="receivingSP"
            label={t('field.receivingSp')}
            register={register('receivingSP')}
            placeholder={t('placeholder.receivingSp')}
          />
          <FormField
            name="receiverWallet"
            label={t('field.receiverWallet')}
            register={register('receiverWallet')}
            placeholder={t('placeholder.receiverWallet')}
          />
          <FormField
            name="travelRuleHash"
            label={t('field.travelRuleHash')}
            register={register('travelRuleHash')}
            placeholder={t('placeholder.travelRuleHash')}
          />
          <FormField
            name="tokenName"
            label={t('field.tokenName')}
            register={register('tokenName')}
            placeholder={t('placeholder.tokenName')}
          />
          <FormField
            name="sendingSP"
            label={t('field.sendingSp')}
            register={register('sendingSP')}
            placeholder={t('placeholder.sendingSp')}
          />
          <FormSelect
            name="transactionType"
            control={control}
            label={t('field.transactionType')}
            options={transactionTypeOptions}
            placeholder={t('transactionType.all')}
          />
          <FormSelect
            name="verificationStatus"
            control={control}
            label={t('field.verificationStatus')}
            options={statusOptions}
            placeholder={t('statusFilter.all')}
          />
          <FormDatePicker
            name="transactionTimeFrom"
            control={control}
            label={t('field.transactionTimeFrom')}
          />
          <FormDatePicker
            name="transactionTimeTo"
            control={control}
            label={t('field.transactionTimeTo')}
          />
          <FormDatePicker
            name="confirmationTimeFrom"
            control={control}
            label={t('field.confirmationTimeFrom')}
          />
          <FormDatePicker
            name="confirmationTimeTo"
            control={control}
            label={t('field.confirmationTimeTo')}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{t('query')}</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            {t('reset')}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">{t('records')}</div>
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage={t('empty')}
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) => setParams((prev) => ({ ...prev, page })),
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
