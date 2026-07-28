'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, DataTable, type DataTablePagination } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';
import type { RuleListItem } from '@myorg/modules/screening-monitoring/data-access';
import { useBusinessTypeList, useBlockchainOptions, useRuleList, useStablecoinOptions, useOperateRule } from '@myorg/modules/screening-monitoring/data-access';
import { ALL_VALUE, RULE_STATUS_OPTIONS, SCREENING_PERMISSIONS } from '@myorg/modules/screening-monitoring/util';
import { ScreeningStatusBadge } from '@myorg/modules/screening-monitoring/ui';

const PAGE_SIZE = 10;
interface Filters { ruleName: string; tokenId: string; blockchainId: string; businessType: string; dateRange: [string, string] | []; status: string; }
const EMPTY: Filters = { ruleName: '', tokenId: ALL_VALUE, blockchainId: ALL_VALUE, businessType: ALL_VALUE, dateRange: [], status: ALL_VALUE };

export function RuleListPage() {
  const t = useTranslations('modules.screening-monitoring'); const tc = useTranslations('common');
  const router = useRouter(); const { hasLimit } = useAuth();
  const { data: tokens } = useStablecoinOptions(); const { data: chains } = useBlockchainOptions(); const { data: bizTypes } = useBusinessTypeList();
  const [pg, setPg] = React.useState<DataTablePagination>({ pageNum: 1, pageSize: PAGE_SIZE });
  const form = useForm<Filters>({ defaultValues: EMPTY }); const f = form.watch();
  const qf = React.useMemo(() => {
    const r: Record<string, unknown> = {};
    if (f.ruleName) r.ruleName = f.ruleName; if (f.tokenId !== ALL_VALUE) r.tokenId = f.tokenId; if (f.blockchainId !== ALL_VALUE) r.blockchainId = f.blockchainId; if (f.businessType !== ALL_VALUE) r.businessType = f.businessType; if (f.dateRange.length === 2) { r.startDate = f.dateRange[0]; r.endDate = f.dateRange[1]; } if (f.status !== ALL_VALUE) r.status = f.status;
    return r;
  }, [f]);
  const { data, isLoading } = useRuleList({ pageNum: pg.pageNum, pageSize: pg.pageSize, filters: qf as never });
  const op = useOperateRule();

  const cols: ColumnDef<RuleListItem>[] = [
    { id: 'index', header: tc('PUB_Index'), accessorKey: 'ruleId', size: 60 },
    { id: 'ruleName', header: t('screening_monitoring_0000'), accessorKey: 'ruleName' },
    { id: 'ruleSource', header: 'Rule Source', accessorKey: 'ruleName', cell: () => <>Custom Rule</> },
    { id: 'scanTiming', header: 'Scan Timing', accessorKey: 'ruleName', cell: () => <>Post Transaction</> },
    { id: 'tokenName', header: t('screening_monitoring_0001'), accessorKey: 'tokenName' },
    { id: 'blockchainName', header: tc('PUB_Blockchain'), accessorKey: 'blockchainName' },
    { id: 'businessName', header: t('screening_monitoring_0002'), accessorKey: 'businessName' },
    { id: 'monitorFrequencyName', header: t('screening_monitoring_0003'), accessorKey: 'monitorFrequencyName' },
    { id: 'createUser', header: tc('PUB_Creater'), accessorKey: 'createUser' },
    { id: 'createDate', header: tc('PUB_CreateTime'), accessorKey: 'createDate', cell: ({ getValue }) => { const v = getValue<string>(); return v ? new Date(Number(v)).toLocaleString() : '-'; } },
    { id: 'status', header: tc('PUB_Status'), accessorKey: 'status', cell: ({ getValue }) => <ScreeningStatusBadge status={getValue<number>()} variant="rule" /> },
  ];

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <FormField name="ruleName" label={t('screening_monitoring_0000')} control={form.control} />
        <FormSelect name="tokenId" label={t('screening_monitoring_0001')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(tokens ?? [])]} allValue={ALL_VALUE} />
        <FormSelect name="blockchainId" label={tc('PUB_Blockchain')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(chains ?? [])]} allValue={ALL_VALUE} />
        <FormSelect name="businessType" label={t('screening_monitoring_0002')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(bizTypes ?? [])]} allValue={ALL_VALUE} />
        <FormDatePicker name="dateRange" label={tc('PUB_CreateTime')} control={form.control} mode="range" />
        <FormSelect name="status" label={tc('PUB_Status')} control={form.control} options={RULE_STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value === ALL_VALUE ? ALL_VALUE : o.value }))} allValue={ALL_VALUE} />
      </div>
      <div className="flex justify-between mb-4">
        <Button variant="outline" onClick={() => form.reset(EMPTY)}>{tc('PUB_Reset')}</Button>
        <div className="flex gap-2">
          {hasLimit(SCREENING_PERMISSIONS.CREATE_RULE) && <Button onClick={() => router.push('/screening-monitoring/rule/create')}>{tc('PUB_New')}</Button>}
          {hasLimit(SCREENING_PERMISSIONS.CREATE_THIRD_PARTY_RULE) && <Button onClick={() => router.push('/screening-monitoring/rule/t_edit')}>{tc('PUB_New')}</Button>}
        </div>
      </div>
      <DataTable columns={cols} data={(data?.rows ?? []).map(r => ({ ...r, id: String(r.ruleId) }))} pagination={{ ...pg, total: data?.page?.total ?? 0 }} onPaginationChange={setPg} isLoading={isLoading}
        actions={[
          { key: 'View', label: tc('Router_0010_4_3'), limit: SCREENING_PERMISSIONS.VIEW_DETAIL, disabled: () => false },
          { key: 'Edit', label: tc('Router_0010_4_2'), limit: SCREENING_PERMISSIONS.EDIT_RULE, disabled: (r: RuleListItem) => !(r.status === 10 || r.status === 15) },
          { key: 'Disable', label: tc('Router_0010_4_5'), limit: SCREENING_PERMISSIONS.DISABLE_RULE, disabled: (r: RuleListItem) => r.status !== 10, confirmText: (r: RuleListItem) => t('screening_monitoring_0014').replace('${status}', t('screening_monitoring_0079')).replaceAll('${token}', r.tokenName).replace('${blockchain}', r.blockchainNameAbbreviation || '').replace('${Rule}', r.ruleName) },
          { key: 'Enable', label: tc('Router_0010_4_4'), limit: SCREENING_PERMISSIONS.ENABLE_RULE, disabled: (r: RuleListItem) => !(r.buttonFlag === false && r.status === 15), confirmText: (r: RuleListItem) => t('screening_monitoring_0014').replace('${status}', t('screening_monitoring_0080')).replaceAll('${token}', r.tokenName).replace('${blockchain}', r.blockchainNameAbbreviation || '').replace('${Rule}', r.ruleName) },
        ]}
        onAction={async (key, row) => { const r = row as RuleListItem; switch (key) { case 'View': router.push(`/screening-monitoring/rule/view?id=${r.ruleId}`); break; case 'Edit': router.push(`/screening-monitoring/rule/edit?id=${r.ruleId}`); break; case 'Disable': case 'Enable': await op.mutateAsync({ ruleId: r.ruleId, state: key === 'Enable' ? 10 : 15 }); break; } }}
      />
    </div>
  );
}
