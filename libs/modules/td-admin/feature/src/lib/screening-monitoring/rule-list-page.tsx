'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, DataTable, type DataTablePagination } from '@myorg/shared/ui';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';
import type { RuleListItem } from '@myorg/modules/td-admin/data-access';
import { useBusinessTypeList, useBlockchainOptions, useRuleList, useStablecoinOptions, useOperateRule } from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';
import { ALL_VALUE } from './screening-monitoring.constants';
import { RULE_STATUS_OPTIONS, SCREENING_PERMISSIONS } from '.';
import { ScreeningStatusBadge } from '.';
import { createRowActionsColumn, type RowAction } from '../row-actions';

const PAGE_SIZE = 10;
interface Filters { ruleName: string; tokenId: string; blockchainId: string; businessType: string; startDate: string; endDate: string; status: string; }
const EMPTY: Filters = { ruleName: '', tokenId: ALL_VALUE, blockchainId: ALL_VALUE, businessType: ALL_VALUE, startDate: '', endDate: '', status: ALL_VALUE };

export function RuleListPage() {
  const t = useTranslations('modules.screening-monitoring'); const tc = useTranslations('common');
  const router = useRouter();
  const authPermissions = useAuth().permissions ?? new Set<string>();
  /** 权限未配置（空集）时全放开，与 chart-of-accounts 一致。 */
  const hasPermission = React.useCallback((uuid: string) => authPermissions.size === 0 || authPermissions.has(uuid), [authPermissions]);
  const { data: tokens } = useStablecoinOptions(); const { data: chains } = useBlockchainOptions(); const { data: bizTypes } = useBusinessTypeList();
  const [pg, setPg] = React.useState<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: PAGE_SIZE });
  const { register, control, watch, reset } = useForm<Filters>({ defaultValues: EMPTY }); const f = watch();
  const qf = React.useMemo(() => {
    const r: Record<string, unknown> = {};
    if (f.ruleName) r.ruleName = f.ruleName; if (f.tokenId !== ALL_VALUE) r.tokenId = f.tokenId; if (f.blockchainId !== ALL_VALUE) r.blockchainId = f.blockchainId; if (f.businessType !== ALL_VALUE) r.businessType = f.businessType; if (f.startDate) r.startDate = f.startDate; if (f.endDate) r.endDate = f.endDate; if (f.status !== ALL_VALUE) r.status = f.status;
    return r;
  }, [f]);
  const { data, isLoading, isError } = useRuleList({ pageNum: pg.pageNum, pageSize: pg.pageSize, filters: qf as never });
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
    { id: 'createDate', header: tc('PUB_CreateTime'), accessorKey: 'createDate', cell: ({ getValue }) => formatAdminTimestamp(Number(getValue<string>())) },
    { id: 'status', header: tc('PUB_Status'), accessorKey: 'status', cell: ({ getValue }) => <ScreeningStatusBadge status={getValue<number>()} variant="rule" /> },
    createRowActionsColumn<RuleListItem>({
      detail: hasPermission(SCREENING_PERMISSIONS.VIEW_DETAIL) ? {
        label: tc('Router_0010_4_3'),
        onClick: (row) =>
          router.push(`/screening-monitoring/rule/view?ruleId=${row.ruleId}`),
      } : undefined,
      menu: (row) => {
        const confirmDisable = () => t('screening_monitoring_0014').replace('${status}', t('screening_monitoring_0079')).replaceAll('${token}', row.tokenName).replace('${blockchain}', row.blockchainNameAbbreviation || '').replace('${Rule}', row.ruleName);
        const confirmEnable = () => t('screening_monitoring_0014').replace('${status}', t('screening_monitoring_0080')).replaceAll('${token}', row.tokenName).replace('${blockchain}', row.blockchainNameAbbreviation || '').replace('${Rule}', row.ruleName);
        const items: RowAction<RuleListItem>[] = [];
        if (hasPermission(SCREENING_PERMISSIONS.EDIT_RULE)) {
          items.push({
            label: tc('Router_0010_4_2'),
            disabled: !(row.status === 10 || row.status === 15),
            onClick: (data) =>
              router.push(`/screening-monitoring/rule/edit?ruleId=${data.ruleId}`),
          });
        }
        if (hasPermission(SCREENING_PERMISSIONS.DISABLE_RULE)) {
          items.push({
            label: tc('Router_0010_4_5'),
            disabled: row.status !== 10,
            onClick: async (data) => {
              if (window.confirm(confirmDisable()))
                await op.mutateAsync({ ruleId: data.ruleId, state: 15 });
            },
          });
        }
        if (hasPermission(SCREENING_PERMISSIONS.ENABLE_RULE)) {
          items.push({
            label: tc('Router_0010_4_4'),
            disabled: !(row.buttonFlag === false && row.status === 15),
            onClick: async (data) => {
              if (window.confirm(confirmEnable()))
                await op.mutateAsync({ ruleId: data.ruleId, state: 10 });
            },
          });
        }
        return items;
      },
    }),
  ];

  const tablePagination = React.useMemo<DataTablePagination>(() => ({ page: pg.pageNum, pageSize: pg.pageSize, total: data?.page?.total ?? 0, onPageChange: (page: number) => setPg((prev) => ({ ...prev, pageNum: page })), onPageSizeChange: (size: number) => setPg({ pageNum: 1, pageSize: size }) }), [pg.pageNum, pg.pageSize, data?.page?.total]);

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <FormField name="ruleName" label={t('screening_monitoring_0000')} register={register('ruleName')} placeholder={t('screening_monitoring_0000')} />
        <FormSelect name="tokenId" label={t('screening_monitoring_0001')} control={control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(tokens ?? [])]} placeholder={tc('PUB_All')} />
        <FormSelect name="blockchainId" label={tc('PUB_Blockchain')} control={control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(chains ?? [])]} placeholder={tc('PUB_All')} />
        <FormSelect name="businessType" label={t('screening_monitoring_0002')} control={control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(bizTypes ?? []).map(b => ({ label: b.label, value: String(b.value) }))]} placeholder={tc('PUB_All')} />
        <FormDateRangePicker startName="startDate" endName="endDate" label={tc('PUB_CreateTime')} control={control} />
        <FormSelect name="status" label={tc('PUB_Status')} control={control} options={RULE_STATUS_OPTIONS.map(o => ({ label: o.label === 'PUB_All' ? tc('PUB_All') : t(o.label), value: o.value === ALL_VALUE ? ALL_VALUE : o.value }))} placeholder={tc('PUB_All')} />
      </div>
      <div className="flex justify-between mb-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPg((prev) => ({ ...prev, pageNum: 1 }))}>{tc('PUB_Query')}</Button>
          <Button variant="outline" onClick={() => { reset(EMPTY); setPg((prev) => ({ ...prev, pageNum: 1 })); }}>{tc('PUB_Reset')}</Button>
        </div>
        <div className="flex gap-2">
          {hasPermission(SCREENING_PERMISSIONS.CREATE_RULE) && <Button onClick={() => router.push('/screening-monitoring/rule/create')}>{tc('PUB_New')}</Button>}
          {hasPermission(SCREENING_PERMISSIONS.CREATE_THIRD_PARTY_RULE) && <Button onClick={() => router.push('/screening-monitoring/rule/t_edit')}>{tc('PUB_New')}</Button>}
        </div>
      </div>
      {isError ? <p className="text-sm text-destructive">Unable to load rules.</p> : null}
      <DataTable columns={cols} data={(data?.rows ?? []).map(r => ({ ...r, id: String(r.ruleId) }))} pagination={tablePagination} isLoading={isLoading} />
    </div>
  );
}
