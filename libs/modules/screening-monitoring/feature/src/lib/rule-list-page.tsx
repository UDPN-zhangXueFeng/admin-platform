'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, DataTable, type DataTablePagination } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import type { RuleListItem } from '@myorg/modules/screening-monitoring/data-access';
import { useBusinessTypeList, useBlockchainOptions, useRuleList, useStablecoinOptions, useOperateRule } from '@myorg/modules/screening-monitoring/data-access';
import { ALL_VALUE, RULE_STATUS_OPTIONS } from '@myorg/modules/screening-monitoring/util';
import { ScreeningStatusBadge } from '@myorg/modules/screening-monitoring/ui';

const PAGE_SIZE = 10;
interface Filters { ruleName: string; tokenId: string; blockchainId: string; businessType: string; startDate: string; endDate: string; status: string; }
const EMPTY: Filters = { ruleName: '', tokenId: ALL_VALUE, blockchainId: ALL_VALUE, businessType: ALL_VALUE, startDate: '', endDate: '', status: ALL_VALUE };

export function RuleListPage() {
  const t = useTranslations('modules.screening-monitoring'); const tc = useTranslations('common');
  const router = useRouter();
  const { data: tokens } = useStablecoinOptions(); const { data: chains } = useBlockchainOptions(); const { data: bizTypes } = useBusinessTypeList();
  const [pg, setPg] = React.useState<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: PAGE_SIZE });
  const { register, control, watch, reset } = useForm<Filters>({ defaultValues: EMPTY }); const f = watch();
  const qf = React.useMemo(() => {
    const r: Record<string, unknown> = {};
    if (f.ruleName) r.ruleName = f.ruleName; if (f.tokenId !== ALL_VALUE) r.tokenId = f.tokenId; if (f.blockchainId !== ALL_VALUE) r.blockchainId = f.blockchainId; if (f.businessType !== ALL_VALUE) r.businessType = f.businessType; if (f.startDate) r.startDate = f.startDate; if (f.endDate) r.endDate = f.endDate; if (f.status !== ALL_VALUE) r.status = f.status;
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
    {
      id: 'actions', header: tc('PUB_Action'), cell: ({ row }) => {
        const r = row.original;
        const confirmDisable = () => t('screening_monitoring_0014').replace('${status}', t('screening_monitoring_0079')).replaceAll('${token}', r.tokenName).replace('${blockchain}', r.blockchainNameAbbreviation || '').replace('${Rule}', r.ruleName);
        const confirmEnable = () => t('screening_monitoring_0014').replace('${status}', t('screening_monitoring_0080')).replaceAll('${token}', r.tokenName).replace('${blockchain}', r.blockchainNameAbbreviation || '').replace('${Rule}', r.ruleName);
        return (
          <div className="flex items-center gap-3">
            <Button variant="link" className="h-auto p-0" onClick={() => router.push(`/screening-monitoring/rule/view?id=${r.ruleId}`)}>{tc('Router_0010_4_3')}</Button>
            <Button variant="link" className="h-auto p-0" disabled={!(r.status === 10 || r.status === 15)} onClick={() => router.push(`/screening-monitoring/rule/edit?id=${r.ruleId}`)}>{tc('Router_0010_4_2')}</Button>
            <Button variant="link" className="h-auto p-0" disabled={r.status !== 10} onClick={async () => { if (window.confirm(confirmDisable())) await op.mutateAsync({ ruleId: r.ruleId, state: 15 }); }}>{tc('Router_0010_4_5')}</Button>
            <Button variant="link" className="h-auto p-0" disabled={!(r.buttonFlag === false && r.status === 15)} onClick={async () => { if (window.confirm(confirmEnable())) await op.mutateAsync({ ruleId: r.ruleId, state: 10 }); }}>{tc('Router_0010_4_4')}</Button>
          </div>
        );
      },
    },
  ];

  const tablePagination = React.useMemo<DataTablePagination>(() => ({ page: pg.pageNum, pageSize: pg.pageSize, total: data?.page?.total ?? 0, onPageChange: (page: number) => setPg((prev) => ({ ...prev, pageNum: page })) }), [pg.pageNum, pg.pageSize, data?.page?.total]);

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <FormField name="ruleName" label={t('screening_monitoring_0000')} register={register('ruleName')} placeholder={t('screening_monitoring_0000')} />
        <FormSelect name="tokenId" label={t('screening_monitoring_0001')} control={control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(tokens ?? [])]} placeholder={tc('PUB_All')} />
        <FormSelect name="blockchainId" label={tc('PUB_Blockchain')} control={control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(chains ?? [])]} placeholder={tc('PUB_All')} />
        <FormSelect name="businessType" label={t('screening_monitoring_0002')} control={control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(bizTypes ?? []).map(b => ({ label: b.label, value: String(b.value) }))]} placeholder={tc('PUB_All')} />
        <FormDatePicker name="startDate" label={tc('PUB_CreateTime')} control={control} />
        <FormDatePicker name="endDate" label={tc('PUB_CreateTime')} control={control} />
        <FormSelect name="status" label={tc('PUB_Status')} control={control} options={RULE_STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value === ALL_VALUE ? ALL_VALUE : o.value }))} placeholder={tc('PUB_All')} />
      </div>
      <div className="flex justify-between mb-4">
        <Button variant="outline" onClick={() => reset(EMPTY)}>{tc('PUB_Reset')}</Button>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/screening-monitoring/rule/create')}>{tc('PUB_New')}</Button>
          <Button onClick={() => router.push('/screening-monitoring/rule/t_edit')}>{tc('PUB_New')}</Button>
        </div>
      </div>
      <DataTable columns={cols} data={(data?.rows ?? []).map(r => ({ ...r, id: String(r.ruleId) }))} pagination={tablePagination} isLoading={isLoading} />
    </div>
  );
}
