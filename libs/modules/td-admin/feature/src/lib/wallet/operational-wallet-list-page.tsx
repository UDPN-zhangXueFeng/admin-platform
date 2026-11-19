'use client';

import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { hashKey } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { useRouter } from '@myorg/shared/util-i18n';
import { usePermission } from '@myorg/shared/util-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@myorg/shared/ui';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import {
  useBlockchainsQuery,
  useOperationalWalletListQuery,
  useStablecoinsQuery,
  type OperationalWallet,
  type OperationalWalletFilters,
} from '@myorg/modules/td-admin/data-access';
import { QueryForm } from '../query-form';
import { createRowActionsColumn } from '../row-actions';
import { WalletStatusBadge } from './wallet-status-badge';
import { ALL_VALUE, EMPTY_DISPLAY, OPERATIONAL_WALLET_VIEW_PERMISSION } from './wallet.constants';
import { formatOperationalBalance, formatOperationalWalletTime } from './wallet.helpers';
import { OperationalWalletLoadError, OperationalWalletTable, useOperationalWalletPage } from './operational-wallet-table';

const EMPTY_FORM = {
  walletAddress: '',
  accountType: ALL_VALUE,
  tokenId: ALL_VALUE,
  blockchainId: ALL_VALUE,
  startCreateTime: '',
  endCreateTime: '',
  state: ALL_VALUE,
};

export function OperationalWalletListPage() {
  const t = useTranslations('modules.wallet');
  const common = useTranslations('common');
  const router = useRouter();
  const canViewDetail = usePermission(OPERATIONAL_WALLET_VIEW_PERMISSION);
  const { register, control, handleSubmit, reset } = useForm({ defaultValues: EMPTY_FORM });
  const [filters, setFilters] = useState<OperationalWalletFilters>({});
  const paging = useOperationalWalletPage();
  const list = useOperationalWalletListQuery({ ...paging.page, filters });
  const stablecoins = useStablecoinsQuery();
  const blockchains = useBlockchainsQuery();
  const { pageNum, pageSize } = paging.page;
  const allOption = { value: ALL_VALUE, label: t('common.all') };
  const accountOptions = [allOption, ...(['1', '2'] as const).map((value) => ({
    value, label: t(`operationalWallet.accountType.${value}`),
  }))];
  const tokenOptions = [allOption, ...(stablecoins.data ?? [])
    .filter((token) => token?.stablecoinId != null)
    .map((token) => ({ value: String(token.stablecoinId), label: token.name }))];
  const chainOptions = new Map<string, { label: string; disabled: boolean }>();
  for (const chain of blockchains.data ?? []) {
    if (chain?.key == null) continue;
    const value = String(chain.key);
    if (value && value !== ALL_VALUE && !chainOptions.has(value)) {
      chainOptions.set(value, { label: chain.value ?? value, disabled: chain.status !== 1 });
    }
  }
  const stateOptions = [allOption, { value: '10', label: t('status.active') },
    { value: '15', label: t('status.inactive') }];

  const columns = useMemo<ColumnDef<OperationalWallet>[]>(() => [
    { id: 'index', header: t('operationalWallet.column.index'), cell: ({ row }) => (pageNum - 1) * pageSize + row.index + 1 },
    { accessorKey: 'walletAddress', header: t('operationalWallet.filterAddress') },
    { accessorKey: 'accountType', header: t('operationalWallet.column.accountType'), cell: ({ row }) => {
      const key = `operationalWallet.accountType.${row.original.accountType}`;
      return t.has(key) ? t(key) : EMPTY_DISPLAY;
    } },
    { accessorKey: 'feeType', header: t('operationalWallet.column.feeType'), cell: ({ row }) => {
      const key = `operationalWallet.feeType.${row.original.feeType}`;
      return t.has(key) ? t(key) : EMPTY_DISPLAY;
    } },
    { accessorKey: 'tokenName', header: t('operationalWallet.column.tokenName') },
    { accessorKey: 'walletType', header: t('operationalWallet.column.walletType') },
    { accessorKey: 'blockchainName', header: t('operationalWallet.column.blockchain') },
    { accessorKey: 'balance', header: t('operationalWallet.column.balance'), cell: ({ row }) =>
      formatOperationalBalance(row.original.balance, row.original.symbol) },
    { accessorKey: 'createTime', header: t('operationalWallet.column.createTime'), cell: ({ row }) =>
      formatOperationalWalletTime(row.original.createTime) },
    { accessorKey: 'state', header: t('common.status'), cell: ({ row }) => (
      <WalletStatusBadge family="operational-wallet" status={row.original.state} />
    ) },
    canViewDetail ? createRowActionsColumn<OperationalWallet>({
      header: common('actions'),
      detail: {
        label: t('operationalWallet.details'),
        onClick: (row) => router.push(`/wallet/operational-wallet/view?${new URLSearchParams({
          id: String(row.ruleWalletId ?? ''), walletAddress: row.walletAddress ?? '',
        })}`),
      },
    }) : { id: 'actions', header: common('actions'), cell: () => EMPTY_DISPLAY },
  ], [t, common, pageNum, pageSize, canViewDetail, router]);

  const onSubmit = handleSubmit((form) => {
    const hasRange = !!form.startCreateTime && !!form.endCreateTime;
    const next: OperationalWalletFilters = {
      walletAddress: form.walletAddress || undefined,
      accountType: form.accountType === ALL_VALUE ? undefined : form.accountType,
      tokenId: stablecoins.data?.find((token) => String(token?.stablecoinId) === form.tokenId)?.stablecoinId,
      blockchainId: blockchains.data?.find((chain) => chain?.status === 1 && String(chain.key) === form.blockchainId)?.key,
      startCreateTime: hasRange ? startOfDay(parseISO(form.startCreateTime)).getTime() : '',
      endCreateTime: hasRange ? endOfDay(parseISO(form.endCreateTime)).getTime() - 999 : '',
      state: form.state === ALL_VALUE ? undefined : form.state,
    };
    if (pageNum === 1 && hashKey([filters]) === hashKey([next])) void list.refetch();
    else {
      setFilters(next);
      paging.onPageChange(1);
    }
  });

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit}>
        <QueryForm
          queryType="submit"
          defaultExpanded
          fields={[
            <FormField key="walletAddress" name="walletAddress" label={t('operationalWallet.filterAddress')}
              register={register('walletAddress')} placeholder={t('operationalWallet.placeholder.walletAddress')} />,
            <FormDateRangePicker key="createTime" startName="startCreateTime" endName="endCreateTime"
              control={control} label={t('operationalWallet.field.createTime')} />,
            <FormSelect key="state" name="state" control={control} label={t('common.status')} options={stateOptions} />,
          ]}
          advancedFields={[
            <FormSelect key="accountType" name="accountType" control={control}
              label={t('operationalWallet.column.accountType')} options={accountOptions} />,
            <FormSelect key="tokenId" name="tokenId" control={control}
              label={t('operationalWallet.column.tokenName')} options={tokenOptions} />,
            <div key="blockchainId">
              <label htmlFor="operational-wallet-chain" className="mb-1.5 block text-sm font-medium">
                {t('operationalWallet.column.blockchain')}
              </label>
              <Controller name="blockchainId" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="operational-wallet-chain"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>{allOption.label}</SelectItem>
                    {Array.from(chainOptions, ([value, option]) => (
                      <SelectItem key={value} value={value} disabled={option.disabled}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>,
          ]}
          onReset={() => reset(EMPTY_FORM)}
          queryLabel={t('common.query')}
          resetLabel={t('common.reset')}
        />
      </form>
      {(stablecoins.isError || blockchains.isError) && <OperationalWalletLoadError retry={() => {
        if (stablecoins.isError) void stablecoins.refetch();
        if (blockchains.isError) void blockchains.refetch();
      }} />}
      <OperationalWalletTable title={t('operationalWallet.records')} columns={columns} query={list} paging={paging} />
    </div>
  );
}
