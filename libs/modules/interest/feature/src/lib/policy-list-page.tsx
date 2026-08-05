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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
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
  effectiveTimeStart: string;
  effectiveTimeEnd: string;
  createTimeStart: string;
  createTimeEnd: string;
  status: string;
}

const EMPTY_FORM: PolicyListFormValues = {
  interestPolicyName: '',
  effectiveTimeStart: '',
  effectiveTimeEnd: '',
  createTimeStart: '',
  createTimeEnd: '',
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
  const authPermissions = useAuth().permissions ?? new Set<string>();
  const can = (p: string) => authPermissions.size === 0 || authPermissions.has(p);
  const baseColumns = usePolicyColumns(t);

  const [pagination, setPagination] = React.useState({
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
    if (filters.effectiveTimeStart) f.effectiveStartDate = filters.effectiveTimeStart;
    if (filters.effectiveTimeEnd) f.effectiveEndDate = filters.effectiveTimeEnd;
    if (filters.createTimeStart) f.startDate = filters.createTimeStart;
    if (filters.createTimeEnd) f.endDate = filters.createTimeEnd;
    return f;
  }, [filters, interestType]);

  const { data, isLoading } = useInterestPolicyList({
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize,
    filters: queryFilters as never,
  });

  const operateMutation = useOperateInterest();

  const handleReset = () => form.reset(EMPTY_FORM);

  const columns: ColumnDef<InterestRule>[] = [
    ...baseColumns,
    {
      id: 'actions',
      header: tc('PUB_Action'),
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-3">
            {can(INTEREST_PERMISSIONS.VIEW_POLICY) && (
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`/interest/policy/view?id=${r.interestRuleId}`)
                }
              >
                {tc('Router_0010_4_3')}
              </Button>
            )}
            {can(INTEREST_PERMISSIONS.EDIT_POLICY) && (
              <Button
                variant="link"
                className="h-auto p-0"
                disabled={r.status === 1}
                onClick={() =>
                  router.push(`${createPath}?id=${r.interestRuleId}`)
                }
              >
                {tc('Router_0010_4_2')}
              </Button>
            )}
            {can(INTEREST_PERMISSIONS.DISABLE_POLICY) && (
              <Button
                variant="link"
                className="h-auto p-0"
                disabled={r.status !== 10}
                onClick={async () => {
                  if (
                    !window.confirm(
                      t('interest_0008').replace('${name}', r.interestPolicyName),
                    )
                  )
                    return;
                  await operateMutation.mutateAsync({
                    interestRuleId: r.interestRuleId,
                    state: 15,
                  });
                  toast.success(tc('PUB_Success'));
                }}
              >
                {tc('Router_0010_4_5')}
              </Button>
            )}
            {can(INTEREST_PERMISSIONS.ENABLE_POLICY) && (
              <Button
                variant="link"
                className="h-auto p-0"
                disabled={r.status !== 15}
                onClick={async () => {
                  if (
                    !window.confirm(
                      t('interest_0007').replace('${name}', r.interestPolicyName),
                    )
                  )
                    return;
                  await operateMutation.mutateAsync({
                    interestRuleId: r.interestRuleId,
                    state: 10,
                  });
                  toast.success(tc('PUB_Success'));
                }}
              >
                {tc('Router_0010_4_4')}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* 筛选表单 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <FormField
          name="interestPolicyName"
          label={t('interest_0002')}
          register={form.register('interestPolicyName')}
          placeholder={tc('PUB_Query')}
        />
        <FormDatePicker
          name="effectiveTimeStart"
          label={t('interest_0003')}
          control={form.control}
        />
        <FormDatePicker
          name="effectiveTimeEnd"
          label={t('interest_0003')}
          control={form.control}
        />
        <FormDatePicker
          name="createTimeStart"
          label={tc('PUB_CreateTime')}
          control={form.control}
        />
        <FormDatePicker
          name="createTimeEnd"
          label={tc('PUB_CreateTime')}
          control={form.control}
        />
        <FormSelect
          name="status"
          label={tc('PUB_Status')}
          control={form.control}
          options={POLICY_STATUS_OPTIONS.map((o) => ({
            label: o.label,
            value: o.value === '' ? ALL_VALUE : o.value,
          }))}
          placeholder={tc('PUB_All')}
        />
      </div>

      {/* 操作按钮行 */}
      <div className="flex justify-between mb-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            {tc('PUB_Reset')}
          </Button>
        </div>
        {can(INTEREST_PERMISSIONS.CREATE_POLICY) && (
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
          page: pagination.pageNum,
          pageSize: pagination.pageSize,
          total: data?.page?.total ?? 0,
          onPageChange: (page) =>
            setPagination((prev) => ({ ...prev, pageNum: page })),
        }}
        isLoading={isLoading}
      />
    </div>
  );
}

// ── 主页面 ──────────────────────────────────────────────────────────────────

export function PolicyListPage() {
  const t = useTranslations('modules.interest');

  return (
    <Tabs defaultValue="deposit">
      <TabsList>
        <TabsTrigger value="deposit">{t('interest_0001')}</TabsTrigger>
        <TabsTrigger value="overdraft" disabled>
          {t('interest_0000')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="deposit">
        <PolicyTab
          interestType={2}
          createPath="/interest/policy/create?type=deposit"
        />
      </TabsContent>
      <TabsContent value="overdraft">
        <PolicyTab
          interestType={1}
          createPath="/interest/policy/create?type=overdraft"
        />
      </TabsContent>
    </Tabs>
  );
}
