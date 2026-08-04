/**
 * 策略列表页 — 双 Tab（存款计息 + 透支计息），各自 DataTable。
 *
 * 迁移自 td-manage `src/pages/interest/policy/index.tsx`（402 行）。
 * 透支计息 Tab `disabled: true`（源码未启用）。
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
  Tabs,
  type TabItem,
} from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';
import { toast } from '@myorg/shared/ui';

import {
  type InterestRule,
  useInterestPolicyList,
  useOperateInterest,
} from '@myorg/modules/interest/data-access';
import {
  ALL_VALUE,
  INTEREST_PERMISSIONS,
  POLICY_STATUS_OPTIONS,
} from '@myorg/modules/interest/util';
import { InterestStatusBadge } from '@myorg/modules/interest/ui';

// ── 常量 ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

interface PolicyListFormValues {
  interestPolicyName: string;
  effectiveDateRange: [string, string] | [];
  createDateRange: [string, string] | [];
  status: string;
}

const EMPTY_FORM: PolicyListFormValues = {
  interestPolicyName: '',
  effectiveDateRange: [],
  createDateRange: [],
  status: ALL_VALUE,
};

// ── 表格列定义 ──────────────────────────────────────────────────────────────

function usePolicyColumns(
  t: (key: string) => string,
): ColumnDef<InterestRule>[] {
  return [
    {
      id: 'index',
      header: t('PUB_Index'),
      accessorKey: 'interestRuleId',
      size: 60,
    },
    {
      id: 'interestPolicyName',
      header: t('interest_0002'),
      accessorKey: 'interestPolicyName',
    },
    {
      id: 'accountType',
      header: t('interest_0005'),
      accessorKey: 'accountType',
      cell: ({ getValue }) => t(`interest_account_type_${getValue<number>()}`),
    },
    {
      id: 'annualInterestRate',
      header: t('interest_0006'),
      accessorKey: 'annualInterestRate',
      cell: ({ getValue }) => `${getValue<string>()}%`,
    },
    {
      id: 'effectiveTime',
      header: t('interest_0003'),
      accessorKey: 'effectiveTime',
      cell: ({ getValue }) => {
        const val = getValue<string>();
        if (!val) return '-';
        return new Date(Number(val)).toLocaleDateString();
      },
    },
    {
      id: 'createTime',
      header: t('PUB_CreateTime'),
      accessorKey: 'createTime',
      cell: ({ getValue }) => {
        const val = getValue<string>();
        if (!val) return '-';
        return new Date(Number(val)).toLocaleString();
      },
    },
    {
      id: 'status',
      header: t('PUB_Status'),
      accessorKey: 'status',
      cell: ({ getValue }) => (
        <InterestStatusBadge status={getValue<number>()} variant="policy" />
      ),
    },
  ];
}

// ── 单个计息类型 Tab 组件 ──────────────────────────────────────────────────

interface PolicyTabProps {
  interestType: number; // 1=Overdraft, 2=Deposit
  /** 新建跳转路径 */
  createPath: string;
}

function PolicyTab({ interestType, createPath }: PolicyTabProps) {
  const t = useTranslations('modules.interest');
  const tc = useTranslations('common');
  const router = useRouter();
  const { hasLimit } = useAuth();
  const columns = usePolicyColumns(t);

  const [pagination, setPagination] = React.useState<DataTablePagination>({
    pageNum: 1,
    pageSize: PAGE_SIZE,
  });

  const form = useForm<PolicyListFormValues>({
    defaultValues: { ...EMPTY_FORM },
  });

  const filters = form.watch();
  const queryFilters = React.useMemo(() => {
    const f: Record<string, unknown> = { interestType };
    if (filters.interestPolicyName) f.interestPolicyName = filters.interestPolicyName;
    if (filters.status && filters.status !== ALL_VALUE) f.status = filters.status;
    if (filters.effectiveDateRange.length === 2) {
      f.effectiveStartDate = filters.effectiveDateRange[0];
      f.effectiveEndDate = filters.effectiveDateRange[1];
    }
    if (filters.createDateRange.length === 2) {
      f.startDate = filters.createDateRange[0];
      f.endDate = filters.createDateRange[1];
    }
    return f;
  }, [filters, interestType]);

  const { data, isLoading } = useInterestPolicyList({
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize,
    filters: queryFilters as never,
  });

  const operateMutation = useOperateInterest();

  const handleReset = () => form.reset(EMPTY_FORM);

  return (
    <div>
      {/* 筛选表单 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <FormField
          name="interestPolicyName"
          label={t('interest_0002')}
          control={form.control}
          placeholder={tc('PUB_Query')}
        />
        <FormDatePicker
          name="effectiveDateRange"
          label={t('interest_0003')}
          control={form.control}
          mode="range"
        />
        <FormDatePicker
          name="createDateRange"
          label={tc('PUB_CreateTime')}
          control={form.control}
          mode="range"
        />
        <FormSelect
          name="status"
          label={tc('PUB_Status')}
          control={form.control}
          options={POLICY_STATUS_OPTIONS.map((o) => ({
            label: o.label,
            value: o.value === '' ? ALL_VALUE : o.value,
          }))}
          allValue={ALL_VALUE}
        />
      </div>

      {/* 操作按钮行 */}
      <div className="flex justify-between mb-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            {tc('PUB_Reset')}
          </Button>
        </div>
        {hasLimit(INTEREST_PERMISSIONS.CREATE_POLICY) && (
          <Button onClick={() => router.push(createPath)}>
            {tc('PUB_New')}
          </Button>
        )}
      </div>

      {/* 表格 */}
      <DataTable
        columns={columns}
        data={(data?.rows ?? []).map((row: InterestRule) => ({
          ...row,
          id: String(row.interestRuleId),
        }))}
        pagination={{
          ...pagination,
          total: data?.page?.total ?? 0,
        }}
        onPaginationChange={setPagination}
        isLoading={isLoading}
        actions={[
          {
            key: 'View',
            label: tc('Router_0010_4_3'),
            limit: INTEREST_PERMISSIONS.VIEW_POLICY,
            disabled: () => false,
          },
          {
            key: 'Edit',
            label: tc('Router_0010_4_2'),
            limit: INTEREST_PERMISSIONS.EDIT_POLICY,
            disabled: (row: InterestRule) => row.status === 1, // Processing 状态不可编辑
          },
          {
            key: 'Disable',
            label: tc('Router_0010_4_5'),
            limit: INTEREST_PERMISSIONS.DISABLE_POLICY,
            disabled: (row: InterestRule) => row.status !== 10, // 仅 Active 可停用
            confirmText: (row: InterestRule) =>
              t('interest_0008').replace('${name}', row.interestPolicyName),
          },
          {
            key: 'Enable',
            label: tc('Router_0010_4_4'),
            limit: INTEREST_PERMISSIONS.ENABLE_POLICY,
            disabled: (row: InterestRule) => row.status !== 15, // 仅 Inactive 可启用
            confirmText: (row: InterestRule) =>
              t('interest_0007').replace('${name}', row.interestPolicyName),
          },
        ]}
        onAction={async (key, row) => {
          const r = row as InterestRule;
          switch (key) {
            case 'View':
              router.push(`/interest/policy/view?id=${r.interestRuleId}`);
              break;
            case 'Edit':
              router.push(`${createPath}?id=${r.interestRuleId}`);
              break;
            case 'Disable':
            case 'Enable':
              await operateMutation.mutateAsync({
                interestRuleId: r.interestRuleId,
                state: key === 'Enable' ? 10 : 15,
              });
              toast.success(tc('PUB_Success'));
              break;
          }
        }}
      />
    </div>
  );
}

// ── 主页面 ──────────────────────────────────────────────────────────────────

export function PolicyListPage() {
  const t = useTranslations('modules.interest');

  const tabs: TabItem[] = [
    {
      key: 'deposit',
      label: t('interest_0001'), // Deposit Interest
      disabled: false,
      children: (
        <PolicyTab
          interestType={2}
          createPath="/interest/policy/create?type=deposit"
        />
      ),
    },
    {
      key: 'overdraft',
      label: t('interest_0000'), // Overdraft Interest
      disabled: true, // 源码 disabled: true，透支计息暂未启用
      children: (
        <PolicyTab
          interestType={1}
          createPath="/interest/policy/create?type=overdraft"
        />
      ),
    },
  ];

  return <Tabs items={tabs} />;
}
