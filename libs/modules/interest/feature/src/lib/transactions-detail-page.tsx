/**
 * 计息交易详情页 — 双 Tab（Basic Info + Operation Records）。
 *
 * 迁移自 td-manage `src/pages/interest/transactions/view.tsx`（319 行）。
 */
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Button,
  Card,
  DataTable,
  type DataTablePagination,
  Tabs,
  type TabItem,
} from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';

import type {
  TokenBillDetail,
  TransactionOperationRecord,
  TransactionRecord,
} from '@myorg/modules/interest/data-access';
import {
  useTokenBillDetail,
  useTransactionOperationRecords,
  useTransactionRecords,
} from '@myorg/modules/interest/data-access';
import { ALL_VALUE, TRANSACTION_STATUS_OPTIONS } from '@myorg/modules/interest/util';
import { TransactionStatusBadge } from '@myorg/modules/interest/ui';

const PAGE_SIZE = 10;

function BasicInfo({ detail, t, tc }: { detail: TokenBillDetail; t: (k: string) => string; tc: (k: string) => string }) {
  return (
    <Card title={t('interest_00116')}>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0080')}</dt>
          <dd className="text-sm font-medium">{t(`interest_list_feeType_${detail.feeType}`)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0062')}</dt>
          <dd className="text-sm font-medium">{detail.tokenName}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{tc('PUB_Blockchain')}</dt>
          <dd className="text-sm font-medium">{detail.blockchainName}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0067')}</dt>
          <dd className="text-sm font-medium">{new Date(Number(detail.postTime)).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0084')}</dt>
          <dd className="text-sm font-medium">{detail.postAccruedCount} {detail.symbol}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0066')}</dt>
          <dd className="text-sm font-medium">{detail.postRealityCount} {detail.symbol}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0083')}</dt>
          <dd className="text-sm font-medium">{detail.totalWalletCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t('interest_0085')}</dt>
          <dd className="text-sm font-medium">{detail.failedWalletCount}</dd>
        </div>
      </div>
    </Card>
  );
}

// ── 交易明细 Tab ───────────────────────────────────────────────────────────

interface DetailRecordsFilters {
  walletAddress: string;
  status: string;
}

function DetailRecordsTab({ tokenBillId, t, tc }: { tokenBillId: number; t: (k: string) => string; tc: (k: string) => string }) {
  const [pagination, setPagination] = React.useState<DataTablePagination>({ pageNum: 1, pageSize: PAGE_SIZE });
  const form = useForm<DetailRecordsFilters>({ defaultValues: { walletAddress: '', status: ALL_VALUE } });
  const filters = form.watch();

  const queryFilters = React.useMemo(() => {
    const f: Record<string, unknown> = { tokenBillId };
    if (filters.walletAddress) f.walletAddress = filters.walletAddress;
    if (filters.status !== ALL_VALUE) f.status = filters.status;
    return f;
  }, [filters, tokenBillId]);

  const { data, isLoading } = useTransactionRecords({
    pageNum: pagination.pageNum, pageSize: pagination.pageSize, filters: queryFilters as never,
  });

  const columns: ColumnDef<TransactionRecord>[] = [
    { id: 'index', header: tc('PUB_Index'), accessorKey: 'interestRuleId', size: 60 },
    { id: 'walletAddress', header: t('interest_0061'), accessorKey: 'walletAddress' },
    { id: 'walletType', header: t('interest_0071'), accessorKey: 'walletType' },
    { id: 'blockchainName', header: tc('PUB_Blockchain'), accessorKey: 'blockchainName' },
    {
      id: 'feePeriod',
      header: t('interest_00117'),
      accessorKey: 'feeStartDate',
      cell: ({ getValue, row }) =>
        `${new Date(Number(getValue<string>())).toLocaleDateString()}-${new Date(Number(row.original.feeEndDate)).toLocaleDateString()}`,
    },
    {
      id: 'postAccruedCount',
      header: t('interest_0084'),
      accessorKey: 'postAccruedCount',
      cell: ({ getValue, row }) => `${getValue<number>()} ${row.original.symbol}`,
    },
    {
      id: 'postRealityCount',
      header: t('interest_0066'),
      accessorKey: 'postRealityCount',
      cell: ({ getValue, row }) => `${getValue<number>()} ${row.original.symbol}`,
    },
    {
      id: 'txTime',
      header: t('interest_0078'),
      accessorKey: 'txTime',
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(Number(v)).toLocaleString() : '-';
      },
    },
    { id: 'txHash', header: t('interest_0077'), accessorKey: 'txHash' },
    {
      id: 'status',
      header: tc('PUB_Status'),
      accessorKey: 'status',
      cell: ({ getValue }) => <TransactionStatusBadge status={getValue<number>()} />,
    },
  ];

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <FormField name="walletAddress" label={t('interest_0061')} control={form.control} />
        <FormSelect
          name="status"
          label={tc('PUB_Status')}
          control={form.control}
          options={TRANSACTION_STATUS_OPTIONS.filter(o => o.value !== '1').map(o => ({
            label: o.label, value: o.value === '' ? ALL_VALUE : o.value,
          }))}
          allValue={ALL_VALUE}
        />
      </div>
      <DataTable
        columns={columns}
        data={(data?.rows ?? []).map(row => ({ ...row, id: String(row.ruleRecordId) }))}
        pagination={{ ...pagination, total: data?.page?.total ?? 0 }}
        onPaginationChange={setPagination}
        isLoading={isLoading}
        actions={[]}
      />
    </div>
  );
}

// ── 操作记录 Tab ───────────────────────────────────────────────────────────

function OperationRecordsTab({ tokenBillId, tc }: { tokenBillId: number; tc: (k: string) => string }) {
  const router = useRouter();
  const [pagination, setPagination] = React.useState<DataTablePagination>({ pageNum: 1, pageSize: PAGE_SIZE });

  const { data, isLoading } = useTransactionOperationRecords({
    pageNum: pagination.pageNum, pageSize: pagination.pageSize, filters: { tokenBillId },
  });

  const columns: ColumnDef<TransactionOperationRecord>[] = [
    {
      id: 'recordType',
      header: 'Operation Type',
      accessorKey: 'recordType',
      cell: () => 'Post', // 源码硬编码 interest_00132 (Post)
    },
    { id: 'createUserName', header: tc('PUB_Creater'), accessorKey: 'createUserName' },
    {
      id: 'createTime',
      header: tc('PUB_CreateTime'),
      accessorKey: 'createTime',
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(Number(v)).toLocaleString() : '-';
      },
    },
    {
      id: 'status',
      header: tc('PUB_Status'),
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const s = getValue<number>();
        return (
          <span className={`text-xs ${tc(`approval_task_status_color_${s}`)}`}>
            {tc(`common_task_status_${s}`)}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={(data?.rows ?? []).map(row => ({ ...row, id: String(row.ruleRecordId) }))}
      pagination={{ ...pagination, total: data?.page?.total ?? 0 }}
      onPaginationChange={setPagination}
      isLoading={isLoading}
      actions={[{
        key: 'View',
        label: tc('Router_0010_4_3'),
        limit: 'e338a3b41c21413db1d2ac7a90a65f5f',
        disabled: () => false,
      }]}
      onAction={(key, row) => {
        const r = row as TransactionOperationRecord;
        if (key === 'View') router.push(`/approval-manage/view?id=${r.taskId}&busCode=${r.busCode}`);
      }}
    />
  );
}

// ── 主页面 ──────────────────────────────────────────────────────────────────

export function TransactionsDetailPage() {
  const t = useTranslations('modules.interest');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(searchParams.get('id'));

  const { data: detail, isLoading } = useTokenBillDetail(id);

  if (isLoading) return <div className="p-8">{tc('PUB_Query')}...</div>;
  if (!detail) return <div className="p-8 text-muted-foreground">Transaction not found</div>;

  const tabs: TabItem[] = [
    {
      key: 'basic',
      label: t('interest_0009'),
      children: (
        <>
          <BasicInfo detail={detail} t={t} tc={tc} />
          <div className="mb-8" />
          <DetailRecordsTab tokenBillId={id} t={t} tc={tc} />
        </>
      ),
    },
    {
      key: 'records',
      label: t('interest_0010'),
      children: <OperationRecordsTab tokenBillId={id} tc={tc} />,
    },
  ];

  return (
    <div>
      <Tabs items={tabs} />
      <div className="flex justify-center mt-6">
        <Button variant="outline" onClick={() => router.back()}>
          {tc('PUB_GoBack')}
        </Button>
      </div>
    </div>
  );
}
