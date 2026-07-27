/**
 * 计息记录列表页 — DataTable + 动态下拉。
 *
 * 迁移自 td-manage `src/pages/interest/accrual/index.tsx`（191 行）。
 */
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Button,
  DataTable,
  type DataTablePagination,
} from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';

import type { AccrualRecord } from '@myorg/modules/interest/data-access';
import {
  useAccrualRecordList,
  useBlockchainOptions,
  useStablecoinOptions,
} from '@myorg/modules/interest/data-access';
import {
  ALL_VALUE,
  FEE_TYPE_OPTIONS,
  INTEREST_PERMISSIONS,
} from '@myorg/modules/interest/util';

const PAGE_SIZE = 10;

interface AccrualListFormValues {
  accrualTimeRange: [string, string] | [];
  tokenId: string;
  blockchainId: string;
  feeType: string;
}

const EMPTY_FORM: AccrualListFormValues = {
  accrualTimeRange: [],
  tokenId: ALL_VALUE,
  blockchainId: ALL_VALUE,
  feeType: ALL_VALUE,
};

export function AccrualListPage() {
  const t = useTranslations('modules.interest');
  const tc = useTranslations('common');
  const router = useRouter();
  const { hasLimit } = useAuth();

  const { data: tokenOptions } = useStablecoinOptions();
  const { data: blockchainOptions } = useBlockchainOptions();

  const [pagination, setPagination] = React.useState<DataTablePagination>({
    pageNum: 1,
    pageSize: PAGE_SIZE,
  });

  const form = useForm<AccrualListFormValues>({
    defaultValues: EMPTY_FORM,
  });
  const filters = form.watch();

  const queryFilters = React.useMemo(() => {
    const f: Record<string, unknown> = {};
    if (filters.accrualTimeRange.length === 2) {
      f.accrualTimeStartDate = filters.accrualTimeRange[0];
      f.accrualTimeEndDate = filters.accrualTimeRange[1];
    }
    if (filters.tokenId !== ALL_VALUE) f.tokenId = filters.tokenId;
    if (filters.blockchainId !== ALL_VALUE) f.blockchainId = filters.blockchainId;
    if (filters.feeType !== ALL_VALUE) f.feeType = filters.feeType;
    return f;
  }, [filters]);

  const { data, isLoading } = useAccrualRecordList({
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize,
    filters: queryFilters as never,
  });

  const columns: ColumnDef<AccrualRecord>[] = [
    { id: 'index', header: tc('PUB_Index'), accessorKey: 'interestRuleId', size: 60 },
    {
      id: 'accrualTime',
      header: t('interest_0065'),
      accessorKey: 'accrualTime',
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(Number(v)).toLocaleString() : '-';
      },
    },
    { id: 'tokenName', header: t('interest_0062'), accessorKey: 'tokenName' },
    { id: 'blockchainName', header: tc('PUB_Blockchain'), accessorKey: 'blockchainName' },
    {
      id: 'feeType',
      header: t('interest_0080'),
      accessorKey: 'feeType',
      cell: ({ getValue }) => t(`interest_list_feeType_${getValue<number>()}`),
    },
    {
      id: 'feePeriod',
      header: t('interest_0081'),
      accessorKey: 'feePeriod',
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(Number(v)).toLocaleDateString() : '-';
      },
    },
    {
      id: 'accrualAmount',
      header: t('interest_0064'),
      accessorKey: 'accrualAmount',
      cell: ({ getValue, row }) => `${getValue<number>()} ${row.original.symbol}`,
    },
    {
      id: 'totalWallets',
      header: t('interest_0083'),
      accessorKey: 'totalWallets',
      cell: ({ getValue }) => `${getValue<number>()}`,
    },
  ];

  const handleReset = () => form.reset(EMPTY_FORM);

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">{t('interest_0070')}</h3>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <FormDatePicker
          name="accrualTimeRange"
          label={t('interest_0065')}
          control={form.control}
          mode="range"
        />
        <FormSelect
          name="tokenId"
          label={t('interest_0062')}
          control={form.control}
          options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(tokenOptions ?? [])]}
          allValue={ALL_VALUE}
        />
        <FormSelect
          name="blockchainId"
          label={tc('PUB_Blockchain')}
          control={form.control}
          options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(blockchainOptions ?? [])]}
          allValue={ALL_VALUE}
        />
        <FormSelect
          name="feeType"
          label={t('interest_0080')}
          control={form.control}
          options={FEE_TYPE_OPTIONS.map((o) => ({
            label: o.label,
            value: o.value === '' ? ALL_VALUE : o.value,
          }))}
          allValue={ALL_VALUE}
        />
      </div>

      <div className="flex justify-between mb-4">
        <Button variant="outline" onClick={handleReset}>{tc('PUB_Reset')}</Button>
      </div>

      <DataTable
        columns={columns}
        data={(data?.rows ?? []).map((row) => ({
          ...row,
          id: String(row.interestRuleId),
        }))}
        pagination={{ ...pagination, total: data?.page?.total ?? 0 }}
        onPaginationChange={setPagination}
        isLoading={isLoading}
        actions={[
          {
            key: 'View',
            label: tc('Router_0010_4_3'),
            limit: INTEREST_PERMISSIONS.VIEW_ACCRUAL,
            disabled: () => false,
          },
        ]}
        onAction={(key, row) => {
          const r = row as AccrualRecord;
          if (key === 'View') {
            router.push(
              `/interest/accrual/view?id=${r.accrualRecordId}&tokenId=${r.tokenId}&feePeriod=${r.feePeriod}&feeType=${r.feeType}`,
            );
          }
        }}
      />
    </div>
  );
}
