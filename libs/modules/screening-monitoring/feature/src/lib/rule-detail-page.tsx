'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, DataTable, type DataTablePagination, Tabs, TabsList, TabsTrigger, TabsContent } from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import type { RuleDetailItem, RuleOperationLog, RuleOperationRecord } from '@myorg/modules/screening-monitoring/data-access';
import { useRuleDetail, useRuleOperationLog, useRuleOperationRecords } from '@myorg/modules/screening-monitoring/data-access';
import { ALL_VALUE, RULE_OPERATION_OPTIONS } from '@myorg/modules/screening-monitoring/util';
import { ScreeningRiskLevelTag, ScreeningStatusBadge } from '@myorg/modules/screening-monitoring/ui';

const PAGE_SIZE = 10;

export function RuleDetailPage() {
  const t = useTranslations('modules.screening-monitoring'); const tc = useTranslations('common');
  const router = useRouter(); const sp = useSearchParams(); const id = Number(sp.get('id'));
  const { data: detail, isLoading } = useRuleDetail(id);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!detail) return <div className="p-8 text-muted-foreground">Rule not found</div>;

  return (
    <div>
      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">{t('screening_monitoring_0038')}</TabsTrigger>
          <TabsTrigger value="records">{t('screening_monitoring_0044')}</TabsTrigger>
          <TabsTrigger value="log">{t('screening_monitoring_0045')}</TabsTrigger>
        </TabsList>
        <TabsContent value="basic">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KV label={t('screening_monitoring_0000')} value={detail.ruleName} />
            <KV label={t('screening_monitoring_0001')} value={detail.tokenName} span={2} />
            <KV label={tc('PUB_Blockchain')} value={detail.blockchainName} />
            <KV label={t('screening_monitoring_0002')} value={detail.businessName} span={2} />
            <KV label={t('screening_monitoring_0003')} value={detail.monitorFrequencyName} />
            <KV label={t('screening_monitoring_0042')} value={detail.updateUser} span={2} />
            <KV label={t('screening_monitoring_0043')} value={detail.updateDate ? new Date(Number(detail.updateDate)).toLocaleString() : '-'} />
            <KV label={tc('PUB_Status')} value={<ScreeningStatusBadge status={detail.status} variant="rule" />} span={2} />
          </div>
          <div className="bg-white p-4 mt-8 font-bold">{t('screening_monitoring_0040')}</div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0041')}</th>
                <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0010')}</th>
                <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0011')}</th>
                <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0032')}</th>
                <th className="py-2 pr-4 font-medium">{t('screening_monitoring_0069')}</th>
              </tr>
            </thead>
            <tbody>
              {(detail.detailList || []).map((item: RuleDetailItem, i: number) => (
                <tr key={i} className="border-b">
                  <td className="py-2 pr-4">{item.minValue}{detail.unit === 2 ? ' % ' : ''} - {item.maxValue}{detail.unit === 2 ? ' % ' : ''}</td>
                  <td className="py-2 pr-4">{item.riskScoring}</td>
                  <td className="py-2 pr-4"><ScreeningRiskLevelTag priority={item.priority} /></td>
                  <td className="py-2 pr-4">{t(`rule_action_${item.handleType}`)}</td>
                  <td className="py-2 pr-4 max-w-xs truncate block">{item.emailRecipients || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
        <TabsContent value="records"><OperationRecordsTab ruleId={id} t={t} tc={tc} router={router} /></TabsContent>
        <TabsContent value="log"><ExecutionLogTab ruleId={id} t={t} tc={tc} /></TabsContent>
      </Tabs>
      <div className="flex justify-center mt-6"><Button variant="outline" onClick={() => router.back()}>{tc('PUB_GoBack')}</Button></div>
    </div>
  );
}

function OperationRecordsTab({ ruleId, t, tc, router }: { ruleId: number; t: (k: string) => string; tc: (k: string) => string; router: ReturnType<typeof useRouter> }) {
  const [pg, setPg] = React.useState<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: PAGE_SIZE });
  const { control, watch } = useForm<{ recordType: string }>({ defaultValues: { recordType: ALL_VALUE } });
  const rt = watch('recordType');
  const qf = React.useMemo(() => { const f: Record<string, unknown> = { ruleId }; if (rt !== ALL_VALUE) f.recordType = rt; return f; }, [rt, ruleId]);
  const { data, isLoading } = useRuleOperationRecords({ pageNum: pg.pageNum, pageSize: pg.pageSize, filters: qf as never });
  const cols: ColumnDef<RuleOperationRecord>[] = [
    { id: 'recordType', header: t('screening_monitoring_0047'), accessorKey: 'recordType', cell: ({ getValue }) => t(`rule_operation_type_${getValue<number>()}`) },
    { id: 'createUserName', header: tc('PUB_Creater'), accessorKey: 'createUserName' },
    { id: 'createTime', header: tc('PUB_CreateTime'), accessorKey: 'createTime', cell: ({ getValue }) => { const v = getValue<string>(); return v ? new Date(Number(v)).toLocaleString() : '-'; } },
    { id: 'state', header: tc('PUB_Status'), accessorKey: 'state', cell: ({ getValue }) => tc(`common_task_status_${getValue<number>()}`) },
    { id: 'actions', header: tc('PUB_Action'), cell: ({ row }) => <Button variant="link" className="h-auto p-0" onClick={() => router.push(`/approval-manage/view?id=${row.original.taskId}&busCode=${row.original.busCode}`)}>{tc('Router_0010_4_3')}</Button> },
  ];
  const tablePagination = React.useMemo<DataTablePagination>(() => ({ page: pg.pageNum, pageSize: pg.pageSize, total: data?.page?.total ?? 0, onPageChange: (page: number) => setPg((prev) => ({ ...prev, pageNum: page })) }), [pg.pageNum, pg.pageSize, data?.page?.total]);
  return (
    <div>
      <div className="w-48 mb-4"><FormSelect name="recordType" label={t('screening_monitoring_0046')} control={control} options={RULE_OPERATION_OPTIONS.map(o => ({ label: o.label, value: o.value === ALL_VALUE ? ALL_VALUE : o.value }))} placeholder={tc('PUB_All')} /></div>
      <DataTable columns={cols} data={(data?.rows ?? []).map(r => ({ ...r, id: String(r.ruleRecordId) }))} pagination={tablePagination} isLoading={isLoading} />
    </div>
  );
}

function ExecutionLogTab({ ruleId, t, tc }: { ruleId: number; t: (k: string) => string; tc: (k: string) => string }) {
  const [pg, setPg] = React.useState<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: PAGE_SIZE });
  const { control, watch } = useForm<{ startDate: string; endDate: string }>({ defaultValues: { startDate: '', endDate: '' } });
  const dr = watch();
  const qf = React.useMemo(() => { const f: Record<string, unknown> = { ruleId }; if (dr.startDate) f.startDate = dr.startDate; if (dr.endDate) f.endDate = dr.endDate; return f; }, [dr.startDate, dr.endDate, ruleId]);
  const { data, isLoading } = useRuleOperationLog({ pageNum: pg.pageNum, pageSize: pg.pageSize, filters: qf as never });
  const cols: ColumnDef<RuleOperationLog>[] = [
    { id: 'taskId', header: t('screening_monitoring_0049'), accessorKey: 'taskId' },
    { id: 'executionTime', header: t('screening_monitoring_0048'), accessorKey: 'executionTime', cell: ({ getValue }) => { const v = getValue<string>(); return v ? new Date(Number(v)).toLocaleString() : '-'; } },
    { id: 'blockchainName', header: tc('PUB_Blockchain'), accessorKey: 'blockchainName' },
    { id: 'totalWalletsScanned', header: t('screening_monitoring_0050'), accessorKey: 'totalWalletsScanned' },
    { id: 'anomalousWallets', header: t('screening_monitoring_0051'), accessorKey: 'anomalousWallets' },
  ];
  const tablePagination = React.useMemo<DataTablePagination>(() => ({ page: pg.pageNum, pageSize: pg.pageSize, total: data?.page?.total ?? 0, onPageChange: (page: number) => setPg((prev) => ({ ...prev, pageNum: page })) }), [pg.pageNum, pg.pageSize, data?.page?.total]);
  return (
    <div>
      <div className="w-64 mb-4 flex gap-4">
        <FormDatePicker name="startDate" label={t('screening_monitoring_0048')} control={control} />
        <FormDatePicker name="endDate" label={t('screening_monitoring_0048')} control={control} />
      </div>
      <DataTable columns={cols} data={(data?.rows ?? []).map(r => ({ ...r, id: String(r.logId) }))} pagination={tablePagination} isLoading={isLoading} />
    </div>
  );
}

function KV({ label, value, span = 1 }: { label: string; value: React.ReactNode; span?: number }) { return <div className={span > 1 ? `col-span-${span}` : ''}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium mt-1">{value}</dd></div>; }
