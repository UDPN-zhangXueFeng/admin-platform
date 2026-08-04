/**
 * 策略详情页 — 双 Tab（Basic Information + Operation Records）。
 *
 * 迁移自 td-manage `src/pages/interest/policy/view.tsx`（470 行）。
 * interestType===2 时展示分段利率（InterestTierTable），否则展示全额利率。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Button,
  Card,
  DataTable,
  type DataTablePagination,
  Tabs,
  type TabItem,
} from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';
import { useForm } from 'react-hook-form';

import type {
  InterestRuleDetail,
  PolicyOperationRecord,
} from '@myorg/modules/interest/data-access';
import {
  useInterestPolicyDetail,
  usePolicyOperationRecords,
} from '@myorg/modules/interest/data-access';
import {
  ALL_VALUE,
  OPERATION_TYPE_OPTIONS,
} from '@myorg/modules/interest/util';
import {
  InterestEmptyWalletTable,
  InterestStatusBadge,
  InterestTierTable,
} from '@myorg/modules/interest/ui';

const PAGE_SIZE = 10;

// ── 操作记录筛选 ────────────────────────────────────────────────────────────

interface OperationRecordFilters {
  recordType: string;
}

// ── 基本信息 KV 展示 ───────────────────────────────────────────────────────

function PolicyBasicInfo({ detail, t }: { detail: InterestRuleDetail; t: (k: string) => string }) {
  const isDeposit = detail.interestType === 2;

  return (
    <div>
      {/* 根据 interestType 切换标题 */}
      <h3 className="text-lg font-medium mb-4">
        {isDeposit ? t('interest_0056') : t('interest_0055')}
      </h3>

      <div className="grid grid-cols-3 gap-4">
        <InfoItem label={t('interest_0002')} value={detail.interestPolicyName} />
        <InfoItem
          label={t('interest_0005')}
          value={t(`interest_account_type_${detail.accountType}`)}
        />
        {isDeposit ? (
          <InfoItem
            label={t('interest_0032')}
            value={t(`interest_method_${detail.interestCalculationMethod}`)}
          />
        ) : null}

        {isDeposit && detail.interestCalculationMethod === 2 ? (
          <InfoItem
            label={t('interest_0006')}
            value={<InterestTierTable saveDetails={detail.saveDetails ?? []} calculateDayMonth={detail.calculateDayMonth} />}
            span={2}
          />
        ) : (
          <InfoItem
            label={t('interest_0006')}
            value={`${detail.annualInterestRate}%`}
          />
        )}

        <InfoItem
          label={t('interest_0003')}
          value={detail.effectiveTime ? new Date(Number(detail.effectiveTime)).toLocaleDateString() : '-'}
          span={isDeposit ? 3 : 2}
        />

        <InfoItem
          label={t('interest_00114')}
          value={`${t('interest_00123')} ${detail.calculateTimeDay}`}
        />

        {isDeposit ? (
          <InfoItem
            label={t('interest_00115')}
            value={`${detail.calculateDayMonth}${getOrdinalSuffix(detail.calculateDayMonth ?? 1, t)} ${t('interest_00127')} ${detail.calculateTimeMonth}`}
            span={2}
          />
        ) : (
          <InfoItem
            label={t('interest_00115')}
            value={`${t('interest_00124')} ${detail.calculateTimeMonth}`}
            span={2}
          />
        )}

        <InfoItem label={t('interest_0016')} value={detail.updateUserName ?? '-'} />
        <InfoItem
          label={t('interest_0017')}
          value={detail.updateTime ? new Date(Number(detail.updateTime)).toLocaleString() : '-'}
          span={2}
        />

        <InfoItem
          label={t('PUB_Status')}
          value={<InterestStatusBadge status={detail.status} variant="policy" />}
          span={3}
        />
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  span = 1,
}: {
  label: string;
  value: React.ReactNode;
  span?: number;
}) {
  return (
    <div className={span > 1 ? `col-span-${span}` : ''}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium mt-1">{value}</dd>
    </div>
  );
}

function getOrdinalSuffix(day: number, t: (key: string) => string): string {
  const lastDigit = day % 10;
  const lastTwo = day % 100;
  if (lastTwo === 11 || lastTwo === 12 || lastTwo === 13) return t('interest_00131');
  if (lastDigit === 1) return t('interest_00128');
  if (lastDigit === 2) return t('interest_00129');
  if (lastDigit === 3) return t('interest_00130');
  return t('interest_00131');
}

// ── 操作记录 Tab ───────────────────────────────────────────────────────────

function OperationRecordsTab({ interestRuleId, t, tc }: { interestRuleId: number; t: (k: string) => string; tc: (k: string) => string }) {
  const router = useRouter();
  const [pagination, setPagination] = React.useState<DataTablePagination>({
    pageNum: 1,
    pageSize: PAGE_SIZE,
  });
  const form = useForm<OperationRecordFilters>({
    defaultValues: { recordType: ALL_VALUE },
  });
  const recordType = form.watch('recordType');

  const filters = React.useMemo(() => {
    const f: Record<string, unknown> = { interestRuleId };
    if (recordType && recordType !== ALL_VALUE) f.recordType = recordType;
    return f;
  }, [recordType, interestRuleId]);

  const { data, isLoading } = usePolicyOperationRecords({
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize,
    filters: filters as never,
  });

  const columns: ColumnDef<PolicyOperationRecord>[] = [
    {
      id: 'recordType',
      header: t('interest_0018'),
      accessorKey: 'recordType',
      cell: ({ getValue }) => t(`interest_operation_type_${getValue<number>()}`),
    },
    {
      id: 'createUserName',
      header: tc('PUB_Creater'),
      accessorKey: 'createUserName',
    },
    {
      id: 'createTime',
      header: tc('PUB_CreateTime'),
      accessorKey: 'createTime',
      cell: ({ getValue }) => {
        const val = getValue<string>();
        return val ? new Date(Number(val)).toLocaleString() : '-';
      },
    },
    {
      id: 'status',
      header: tc('PUB_Status'),
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue<number>();
        return (
          <span className={`text-xs ${tc(`approval_task_status_color_${status}`)}`}>
            {tc(`common_task_status_${status}`)}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <div className="w-48 mb-4">
        <FormSelect
          name="recordType"
          label={t('interest_0019')}
          control={form.control}
          options={OPERATION_TYPE_OPTIONS.map((o) => ({
            label: o.label,
            value: o.value === '' ? ALL_VALUE : o.value,
          }))}
          allValue={ALL_VALUE}
        />
      </div>
      <DataTable
        columns={columns}
        data={(data?.rows ?? []).map((row: PolicyOperationRecord) => ({
          ...row,
          id: String(row.ruleRecordId),
        }))}
        pagination={{ ...pagination, total: data?.page?.total ?? 0 }}
        onPaginationChange={setPagination}
        isLoading={isLoading}
        actions={[
          {
            key: 'View',
            label: tc('Router_0010_4_3'),
            limit: 'e338a3b41c21413db1d2ac7a90a65f5f',
            disabled: () => false,
          },
        ]}
        onAction={(key, row) => {
          const r = row as PolicyOperationRecord;
          if (key === 'View') {
            router.push(`/approval-manage/view?id=${r.taskId}&busCode=${r.busCode}`);
          }
        }}
      />
    </div>
  );
}

// ── 主页面 ──────────────────────────────────────────────────────────────────

export function PolicyDetailPage() {
  const t = useTranslations('modules.interest');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(searchParams.get('id'));

  const { data: detail, isLoading } = useInterestPolicyDetail(id);

  if (isLoading) return <div className="p-8">{tc('PUB_Query')}...</div>;
  if (!detail) return <div className="p-8 text-muted-foreground">Policy not found</div>;

  const tabs: TabItem[] = [
    {
      key: 'basic',
      label: t('interest_0009'),
      children: (
        <>
          <PolicyBasicInfo detail={detail} t={t} />
          <div className="mt-6">
            <InterestEmptyWalletTable />
          </div>
        </>
      ),
    },
    {
      key: 'records',
      label: t('interest_0010'),
      children: <OperationRecordsTab interestRuleId={id} t={t} tc={tc} />,
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
