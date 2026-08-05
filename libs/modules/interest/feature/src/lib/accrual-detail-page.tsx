/**
 * 计息记录详情页 — 条件表格渲染（feeType===50 存款 vs 透支）。
 *
 * 迁移自 td-manage `src/pages/interest/accrual/view.tsx`（234 行）。
 */
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';

import { Button, Card, DataTable } from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';

import type {
  AccrualRecordDetail,
  AccrualHistoryItem,
} from '@myorg/modules/interest/data-access';
import {
  useAccrualHistoryList,
  useAccrualRecordDetail,
} from '@myorg/modules/interest/data-access';

const PAGE_SIZE = 10;

interface HistoryFilters {
  walletAddress: string;
}

function AccrualBasicInfo({
  detail,
  t,
  tc,
}: {
  detail: AccrualRecordDetail;
  t: (k: string) => string;
  tc: (k: string) => string;
}) {
  return (
    <Card title={t('interest_0073')}>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0080')}</dt>
          <dd className="text-sm font-medium">{t(`interest_list_feeType_${detail.feeType}`)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0062')}</dt>
          <dd className="text-sm font-medium">{detail.tokenName} ({detail.blockchainNameAbbreviation})</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0065')}</dt>
          <dd className="text-sm font-medium">{new Date(Number(detail.accrualTime)).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0081')}</dt>
          <dd className="text-sm font-medium">{new Date(Number(detail.feePeriod)).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0084')}</dt>
          <dd className="text-sm font-medium">{detail.accrualAmount} {detail.symbol}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0083')}</dt>
          <dd className="text-sm font-medium">{detail.totalWallets}</dd>
        </div>
      </div>
    </Card>
  );
}

export function AccrualDetailPage() {
  const t = useTranslations('modules.interest');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(searchParams.get('id'));
  const tokenId = Number(searchParams.get('tokenId'));
  const feePeriod = searchParams.get('feePeriod') || '';
  const feeType = Number(searchParams.get('feeType'));

  const { data: detail, isLoading } = useAccrualRecordDetail(id);

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: PAGE_SIZE,
  });
  const form = useForm<HistoryFilters>({
    defaultValues: { walletAddress: '' },
  });
  const walletAddress = form.watch('walletAddress');

  const historyFilters = React.useMemo(() => ({
    tokenId,
    feePeriod,
    feeType,
    walletAddress: walletAddress || undefined,
  }), [tokenId, feePeriod, feeType, walletAddress]);

  const { data: historyData, isLoading: historyLoading } = useAccrualHistoryList({
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize,
    filters: historyFilters,
  });

  if (isLoading) return <div className="p-8">{tc('PUB_Query')}...</div>;
  if (!detail) return <div className="p-8 text-muted-foreground">Record not found</div>;

  // 存款表：feeType===50；透支表：多 billType 列
  const isDeposit = feeType === 50;

  const depositColumns: ColumnDef<AccrualHistoryItem>[] = [
    { id: 'index', header: tc('PUB_Index'), accessorKey: 'interestRuleId', size: 60 },
    { id: 'walletAddress', header: t('interest_0061'), accessorKey: 'walletAddress' },
    { id: 'walletType', header: t('interest_0071'), accessorKey: 'walletType' },
    { id: 'blockchainName', header: tc('PUB_Blockchain'), accessorKey: 'blockchainName' },
    { id: 'interestPolicyName', header: t('interest_0091'), accessorKey: 'interestPolicyName' },
    {
      id: 'balance',
      header: t('interest_0087'),
      accessorKey: 'balance',
      cell: ({ getValue, row }) => `${getValue<number>()} ${row.original.symbol}`,
    },
    {
      id: 'accrualAmount',
      header: t('interest_0064'),
      accessorKey: 'accrualAmount',
      cell: ({ getValue, row }) => `${getValue<number>()} ${row.original.symbol}`,
    },
  ];

  const overdraftColumns: ColumnDef<AccrualHistoryItem>[] = [
    { id: 'index', header: tc('PUB_Index'), accessorKey: 'interestRuleId', size: 60 },
    { id: 'walletAddress', header: t('interest_0061'), accessorKey: 'walletAddress' },
    { id: 'walletType', header: t('interest_0071'), accessorKey: 'walletType' },
    {
      id: 'balance',
      header: t('interest_0087'),
      accessorKey: 'balance',
      cell: ({ getValue, row }) => `${getValue<number>()} ${row.original.symbol}`,
    },
    {
      id: 'accrualAmount',
      header: t('interest_0064'),
      accessorKey: 'accrualAmount',
      cell: ({ getValue, row }) => `${getValue<number>()} ${row.original.symbol}`,
    },
    {
      id: 'billType',
      header: t('interest_0080'),
      accessorKey: 'billType',
      cell: ({ getValue }) => t(`interest_detailList_feeType_${getValue<number>()}`),
    },
  ];

  return (
    <div>
      <AccrualBasicInfo detail={detail} t={t} tc={tc} />
      <div className="mb-8" />

      <div className="w-64 mb-4">
        <FormField
          name="walletAddress"
          label={t('interest_0061')}
          register={form.register('walletAddress')}
        />
      </div>

      <DataTable
        columns={isDeposit ? depositColumns : overdraftColumns}
        data={(historyData?.rows ?? []).map((row) => ({
          ...row,
          id: String(row.ruleRecordId),
        }))}
        pagination={{
          page: pagination.pageNum,
          pageSize: pagination.pageSize,
          total: historyData?.page?.total ?? 0,
          onPageChange: (page) =>
            setPagination((prev) => ({ ...prev, pageNum: page })),
        }}
        isLoading={historyLoading}
      />

      <div className="flex justify-center mt-6">
        <Button variant="outline" onClick={() => router.back()}>
          {tc('PUB_GoBack')}
        </Button>
      </div>
    </div>
  );
}
