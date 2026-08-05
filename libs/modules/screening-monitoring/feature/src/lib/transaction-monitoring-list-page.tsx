'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, DataTable, type DataTablePagination, Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose, Card, RadioGroup, RadioGroupItem, Textarea } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { toast } from '@myorg/shared/ui';
import type { SuspiciousTransaction } from '@myorg/modules/screening-monitoring/data-access';
import { useBlockchainOptions, useBusinessTypeList, useProcessSuspicious, useRetrySuspicious, useStablecoinOptions, useSuspiciousList } from '@myorg/modules/screening-monitoring/data-access';
import { ALL_VALUE, PROCESS_REVERSE_OPTIONS, RISK_LEVEL_OPTIONS, SUSPICIOUS_STATUS_OPTIONS } from '@myorg/modules/screening-monitoring/util';
import { ScreeningRiskLevelTag, ScreeningStatusBadge } from '@myorg/modules/screening-monitoring/ui';

const PAGE_SIZE = 10;
interface Filters { walletAddress: string; tokenId: string; blockchainId: string; businessType: string; priority: string; status: string; startDate: string; endDate: string; }
const EMPTY: Filters = { walletAddress: '', tokenId: ALL_VALUE, blockchainId: ALL_VALUE, businessType: ALL_VALUE, priority: ALL_VALUE, status: ALL_VALUE, startDate: '', endDate: '' };

export function TransactionMonitoringListPage() {
  const t = useTranslations('modules.screening-monitoring'); const tc = useTranslations('common');
  const router = useRouter();
  const { data: tokens } = useStablecoinOptions(); const { data: chains } = useBlockchainOptions(); const { data: bizTypes } = useBusinessTypeList();
  const [pg, setPg] = React.useState<{ pageNum: number; pageSize: number }>({ pageNum: 1, pageSize: PAGE_SIZE });
  const { register, control, watch, reset } = useForm<Filters>({ defaultValues: EMPTY }); const fv = watch();
  const qf = React.useMemo(() => { const r: Record<string, unknown> = {}; if (fv.walletAddress) r.walletAddress = fv.walletAddress; if (fv.tokenId !== ALL_VALUE) r.tokenId = fv.tokenId; if (fv.blockchainId !== ALL_VALUE) r.blockchainId = fv.blockchainId; if (fv.businessType !== ALL_VALUE) r.businessType = fv.businessType; if (fv.priority !== ALL_VALUE) r.priority = fv.priority; if (fv.status !== ALL_VALUE) r.status = fv.status; if (fv.startDate) r.startDate = fv.startDate; if (fv.endDate) r.endDate = fv.endDate; return r; }, [fv]);
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
    {
      id: 'actions', header: tc('PUB_Action'), cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-3">
            <Button variant="link" className="h-auto p-0" onClick={() => router.push(`/screening-monitoring/transaction-monitoring/view?id=${r.suspiciousId}&type=${r.businessType}`)}>{tc('Router_0010_4_3')}</Button>
            <Button variant="link" className="h-auto p-0" disabled={!(r.state === 1 || r.state === 4)} onClick={() => { setModalInfo(r); drawForm.reset(); setDrawerOpen(true); }}>{tc('Router_0012_2_1')}</Button>
            <Button variant="link" className="h-auto p-0" disabled={r.state !== 5} onClick={async () => { setSpinning(true); try { await retryMut.mutateAsync({ suspiciousId: r.suspiciousId }); await refetch(); toast.success(tc('PUB_Success').replace('****', tc('PUB_Reset'))); } finally { setSpinning(false); } }}>{tc('Router_0012_2_4')}</Button>
          </div>
        );
      },
    },
  ];

  const tablePagination = React.useMemo<DataTablePagination>(() => ({ page: pg.pageNum, pageSize: pg.pageSize, total: data?.page?.total ?? 0, onPageChange: (page: number) => setPg((prev) => ({ ...prev, pageNum: page })) }), [pg.pageNum, pg.pageSize, data?.page?.total]);

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <FormField name="walletAddress" label={t('screening_monitoring_0015')} register={register('walletAddress')} placeholder={t('screening_monitoring_0015')} />
        <FormSelect name="tokenId" label={t('screening_monitoring_0001')} control={control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(tokens ?? [])]} placeholder={tc('PUB_All')} />
        <FormSelect name="blockchainId" label={tc('PUB_Blockchain')} control={control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(chains ?? [])]} placeholder={tc('PUB_All')} />
        <FormSelect name="businessType" label={t('screening_monitoring_0002')} control={control} options={[{ label: tc('PUB_All'), value: ALL_VALUE }, ...(bizTypes ?? []).map(b => ({ label: b.label, value: String(b.value) }))]} placeholder={tc('PUB_All')} />
        <FormSelect name="priority" label={t('screening_monitoring_0011')} control={control} options={RISK_LEVEL_OPTIONS.map(o => ({ label: o.label, value: o.value === ALL_VALUE ? ALL_VALUE : o.value }))} placeholder={tc('PUB_All')} />
        <FormSelect name="status" label={tc('PUB_Status')} control={control} options={SUSPICIOUS_STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value === ALL_VALUE ? ALL_VALUE : o.value }))} placeholder={tc('PUB_All')} />
        <FormDatePicker name="startDate" label={t('screening_monitoring_0016')} control={control} />
        <FormDatePicker name="endDate" label={t('screening_monitoring_0016')} control={control} />
      </div>
      <div className="flex justify-between mb-4"><Button variant="outline" onClick={() => reset(EMPTY)}>{tc('PUB_Reset')}</Button></div>
      <DataTable columns={cols} data={(data?.rows ?? []).map(r => ({ ...r, id: String(r.suspiciousId) }))} pagination={tablePagination} isLoading={isLoading || spinning} />
      <Drawer open={drawerOpen} onOpenChange={(o) => setDrawerOpen(o)}>
        <DrawerContent className="w-[35%] max-w-2xl">
          <DrawerHeader className="flex justify-between items-center">
            <DrawerTitle>{t('screening_monitoring_0020')}</DrawerTitle>
            <DrawerClose asChild><button onClick={() => setDrawerOpen(false)} className="text-xl">&times;</button></DrawerClose>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto">
            <h4 className="py-4">{t('screening_monitoring_0057')}</h4>
            <Card>
              <div className="space-y-2"><KV label={t('screening_monitoring_0015')} value={modalInfo?.walletAddress} /><KV label={t('screening_monitoring_0001')} value={modalInfo?.stablecoinName} /><KV label={tc('PUB_Blockchain')} value={modalInfo?.blockchainName} /><KV label={t('screening_monitoring_0002')} value={modalInfo?.businessName} /><KV label={t('screening_monitoring_0019')} value={(modalInfo?.businessType === 40 || modalInfo?.businessType === 50) ? modalInfo?.description + '%' : (modalInfo?.businessType === 20 || modalInfo?.businessType === 30) ? modalInfo?.description + t('screening_monitoring_0081') : modalInfo?.description} /><KV label={t('screening_monitoring_0011')} value={<ScreeningRiskLevelTag priority={modalInfo?.priority} />} /><KV label={t('screening_monitoring_0074')} value={t(`suggested_action_type_${modalInfo?.handleType}`)} /></div>
            </Card>
            <h4 className="py-4 mt-4">{t('screening_monitoring_0077')}</h4>
            <Card>
              <form onSubmit={drawForm.handleSubmit(async (v) => { await processMut.mutateAsync({ suspiciousId: modalInfo.suspiciousId, ...v }); setDrawerOpen(false); refetch(); })}>
                <div className="mb-4"><label className="block text-sm mb-1">{t('screening_monitoring_0076')}</label><RadioGroup value={String(drawForm.watch('processRemark') ?? '')} onValueChange={(v) => drawForm.setValue('processRemark', Number(v))} className="flex gap-4">{PROCESS_REVERSE_OPTIONS.map(o => (<div key={o.value} className="flex items-center gap-2"><RadioGroupItem value={String(o.value)} id={`pr-${o.value}`} /><label htmlFor={`pr-${o.value}`}>{t(o.label)}</label></div>))}</RadioGroup></div>
                <div className="mb-4"><label className="block text-sm mb-1">{t('screening_monitoring_0055')}</label><Textarea {...drawForm.register('comments')} /></div>
                <div className="flex justify-center gap-4"><Button type="button" variant="outline" onClick={() => { drawForm.reset(); setDrawerOpen(false); }}>{tc('PUB_Cancel')}</Button><Button type="submit">{tc('PUB_Submit')}</Button></div>
              </form>
            </Card>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex py-2"><span className="w-[30%] text-sm text-muted-foreground">{label}</span><span className="flex-1 text-sm">{value}</span></div>; }
