'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, DataTable, type DataTablePagination, Drawer, Card, RadioGroup, TextArea } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';
import { toast } from '@myorg/shared/ui-toast';
import type { SuspiciousTransaction } from '@myorg/modules/screening-monitoring/data-access';
import { useBlockchainOptions, useBusinessTypeList, useProcessSuspicious, useRetrySuspicious, useStablecoinOptions, useSuspiciousList } from '@myorg/modules/screening-monitoring/data-access';
import { ALL_VALUE, PROCESS_REVERSE_OPTIONS, RISK_LEVEL_OPTIONS, SCREENING_PERMISSIONS, SUSPICIOUS_STATUS_OPTIONS } from '@myorg/modules/screening-monitoring/util';
import { ScreeningRiskLevelTag, ScreeningStatusBadge } from '@myorg/modules/screening-monitoring/ui';

const PAGE_SIZE = 10;
interface Filters { walletAddress: string; tokenId: string; blockchainId: string; businessType: string; priority: string; status: string; dateRange: [string, string] | []; }
const EMPTY: Filters = { walletAddress: '', tokenId: ALL_VALUE, blockchainId: ALL_VALUE, businessType: ALL_VALUE, priority: ALL_VALUE, status: ALL_VALUE, dateRange: [] };

export function TransactionMonitoringListPage() {
  const t = useTranslations('modules.screening-monitoring'); const tc = useTranslations('common');
  const router = useRouter(); const { hasLimit } = useAuth();
  const { data: tokens } = useStablecoinOptions(); const { data: chains } = useBlockchainOptions(); const { data: bizTypes } = useBusinessTypeList();
  const [pg, setPg] = React.useState<DataTablePagination>({ pageNum: 1, pageSize: PAGE_SIZE });
  const form = useForm<Filters>({ defaultValues: EMPTY }); const fv = form.watch();
  const qf = React.useMemo(() => { const r: Record<string, unknown> = {}; if (fv.walletAddress) r.walletAddress = fv.walletAddress; if (fv.tokenId !== ALL_VALUE) r.tokenId = fv.tokenId; if (fv.blockchainId !== ALL_VALUE) r.blockchainId = fv.blockchainId; if (fv.businessType !== ALL_VALUE) r.businessType = fv.businessType; if (fv.priority !== ALL_VALUE) r.priority = fv.priority; if (fv.status !== ALL_VALUE) r.status = fv.status; if (fv.dateRange.length === 2) { r.startDate = fv.dateRange[0]; r.endDate = fv.dateRange[1]; } return r; }, [fv]);
  const { data, isLoading, refetch } = useSuspiciousList({ pageNum: pg.pageNum, pageSize: pg.pageSize, filters: qf as never });
  const processMut = useProcessSuspicious(); const retryMut = useRetrySuspicious();
  const [drawerOpen, setDrawerOpen] = React.useState(false); const [modalInfo, setModalInfo] = React.useState<SuspiciousTransaction>({} as SuspiciousTransaction);
  const drawForm = useForm<{ processRemark: number; comments: string }>({ defaultValues: { processRemark: 0, comments: '' } });
  const [spinning, setSpinning] = React.useState(false);

  const cols: ColumnDef<SuspiciousTransaction>[] = [
    { id: 'index', header: tc('PUB_Index'), accessorKey: 'suspiciousId', size: 60 },
    { id: 'walletAddress', header: t('screening_monitoring_0015'), accessorKey: 'walletAddress' },
    { id: 'ruleSource', header: 'Rule Source', accessorKey: 'ruleName', cell: () => <>Custom Rule</> },
    { id: 'scanTiming', header: 'Scan Timing', accessorKey: 'ruleName', cell: () => <>Post Transaction</> },
    { id: 'stablecoinName', header: t('screening_monitoring_0001'), accessorKey: 'stablecoinName' },
    { id: 'blockchainName', header: tc('PUB_Blockchain'), accessorKey: 'blockchainName' },
    { id: 'businessName', header: t('screening_monitoring_0002'), accessorKey: 'businessName' },
    { id: 'description', header: t('screening_monitoring_0019'), accessorKey: 'description', cell: ({ getValue, row }) => { const bt = row.original.businessType; const v = getValue<string>(); if (bt === 40 || bt === 50) return v + '%'; if (bt === 20 || bt === 30) return v + t('screening_monitoring_0081'); return v; } },
    { id: 'monitorDate', header: t('screening_monitoring_0016'), accessorKey: 'monitorDate', cell: ({ getValue }) => { const v = getValue<string>(); return v ? new Date(Number(v)).toLocaleString() : '-'; } },
    { id: 'priority', header: t('screening_monitoring_0011'), accessorKey: 'priority', cell: ({ getValue }) => <ScreeningRiskLevelTag priority={getValue<number>()} /> },
    { id: 'handleType', header: t('screening_monitoring_0074'), accessorKey: 'handleType', cell: ({ getValue }) => t(`suggested_action_type_${getValue<number>()}`) },
    { id: 'state', header: tc('PUB_Status'), accessorKey: 'state', cell: ({ getValue }) => <ScreeningStatusBadge status={getValue<number>()} variant="suspicious" /> },
    { id: 'handleResult', header: t('screening_monitoring_0075'), accessorKey: 'handleResult', cell: ({ getValue, row }) => row.original.state === 3 ? (getValue<boolean>() ? t('screening_monitoring_0082') : t('screening_monitoring_0083')) : '--' },
  ];

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <FormField name="walletAddress" label={t('screening_monitoring_0015')} control={form.control} />
        <FormSelect name="tokenId" label={t('screening_monitoring_0001')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(tokens ?? [])]} allValue={ALL_VALUE} />
        <FormSelect name="blockchainId" label={tc('PUB_Blockchain')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(chains ?? [])]} allValue={ALL_VALUE} />
        <FormSelect name="businessType" label={t('screening_monitoring_0002')} control={form.control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(bizTypes ?? [])]} allValue={ALL_VALUE} />
        <FormSelect name="priority" label={t('screening_monitoring_0011')} control={form.control} options={RISK_LEVEL_OPTIONS.map(o => ({ label: o.label, value: o.value === ALL_VALUE ? ALL_VALUE : o.value }))} allValue={ALL_VALUE} />
        <FormSelect name="status" label={tc('PUB_Status')} control={form.control} options={SUSPICIOUS_STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value === ALL_VALUE ? ALL_VALUE : o.value }))} allValue={ALL_VALUE} />
        <FormDatePicker name="dateRange" label={t('screening_monitoring_0016')} control={form.control} mode="range" />
      </div>
      <div className="flex justify-between mb-4"><Button variant="outline" onClick={() => form.reset(EMPTY)}>{tc('PUB_Reset')}</Button></div>
      <DataTable columns={cols} data={(data?.rows ?? []).map(r => ({ ...r, id: String(r.suspiciousId) }))} pagination={{ ...pg, total: data?.page?.total ?? 0 }} onPaginationChange={setPg} isLoading={isLoading || spinning}
        actions={[
          { key: 'View', label: tc('Router_0010_4_3'), limit: SCREENING_PERMISSIONS.VIEW_SUSPICIOUS, disabled: () => false },
          { key: 'Process', label: tc('Router_0012_2_1'), limit: SCREENING_PERMISSIONS.PROCESS_SUSPICIOUS, disabled: (r: SuspiciousTransaction) => !(r.state === 1 || r.state === 4) },
          { key: 'Reset', label: tc('Router_0012_2_4'), limit: SCREENING_PERMISSIONS.RETRY_SUSPICIOUS, disabled: (r: SuspiciousTransaction) => r.state !== 5 },
        ]}
        onAction={async (key, row) => { const r = row as SuspiciousTransaction; switch (key) { case 'View': router.push(`/screening-monitoring/transaction-monitoring/view?id=${r.suspiciousId}&type=${r.businessType}`); break; case 'Process': setModalInfo(r); drawForm.reset(); setDrawerOpen(true); break; case 'Reset': setSpinning(true); try { await retryMut.mutateAsync({ suspiciousId: r.suspiciousId }); await refetch(); toast.success(tc('PUB_Success').replace('****', tc('PUB_Reset'))); } finally { setSpinning(false); } break; } }}
      />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={<div className="flex justify-between items-center"><span>{t('screening_monitoring_0020')}</span><button onClick={() => setDrawerOpen(false)} className="text-xl">&times;</button></div>} width="35%">
        <h4 className="py-4">{t('screening_monitoring_0057')}</h4>
        <Card>
          <div className="space-y-2"><KV label={t('screening_monitoring_0015')} value={modalInfo?.walletAddress} /><KV label={t('screening_monitoring_0001')} value={modalInfo?.stablecoinName} /><KV label={tc('PUB_Blockchain')} value={modalInfo?.blockchainName} /><KV label={t('screening_monitoring_0002')} value={modalInfo?.businessName} /><KV label={t('screening_monitoring_0019')} value={(modalInfo?.businessType === 40 || modalInfo?.businessType === 50) ? modalInfo?.description + '%' : (modalInfo?.businessType === 20 || modalInfo?.businessType === 30) ? modalInfo?.description + t('screening_monitoring_0081') : modalInfo?.description} /><KV label={t('screening_monitoring_0011')} value={<ScreeningRiskLevelTag priority={modalInfo?.priority} />} /><KV label={t('screening_monitoring_0074')} value={t(`suggested_action_type_${modalInfo?.handleType}`)} /></div>
        </Card>
        <h4 className="py-4 mt-4">{t('screening_monitoring_0077')}</h4>
        <Card>
          <form onSubmit={drawForm.handleSubmit(async (v) => { await processMut.mutateAsync({ suspiciousId: modalInfo.suspiciousId, ...v }); setDrawerOpen(false); refetch(); })}>
            <div className="mb-4"><label className="block text-sm mb-1">{t('screening_monitoring_0076')}</label><RadioGroup name="processRemark" control={drawForm.control} options={PROCESS_REVERSE_OPTIONS.map(o => ({ label: t(o.label), value: o.value }))} /></div>
            <div className="mb-4"><label className="block text-sm mb-1">{t('screening_monitoring_0055')}</label><TextArea name="comments" control={drawForm.control} /></div>
            <div className="flex justify-center gap-4"><Button type="button" variant="outline" onClick={() => { drawForm.reset(); setDrawerOpen(false); }}>{tc('PUB_Cancel')}</Button><Button type="submit">{tc('PUB_Submit')}</Button></div>
          </form>
        </Card>
      </Drawer>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex py-2"><span className="w-[30%] text-sm text-muted-foreground">{label}</span><span className="flex-1 text-sm">{value}</span></div>; }
