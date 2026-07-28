'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from '@myorg/shared/util-i18n';
import { Button, Card, Dialog, Input } from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import { toast } from '@myorg/shared/ui-toast';
import Image from 'next/image';
import { useQrCode, addTwoFactor, disableTwoFactor } from '@myorg/modules/account-manage/data-access';

export function AccountRegisterPage() {
  const t = useTranslations('modules.account-manage'); const tc = useTranslations('common');
  const router = useRouter(); const sp = useSearchParams();
  const type = Number(sp.get('type')); const isEnable = type === 1;
  const { data: qrData, refetch: refetchQr } = useQrCode();
  const [loading, setLoading] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const form = useForm<{ code: string; password: string }>({ defaultValues: { code: '', password: '' } });
  const form1 = useForm<{ password: string }>({ defaultValues: { password: '' } });

  const handleEnable = async (v: { code: string; password: string }) => {
    setLoading(true);
    try { await addTwoFactor({ code: v.code, password: v.password }); toast.success(tc('PUB_Success')); router.push('/account-manage'); } finally { setLoading(false); }
  };
  const handleDisable = async () => {
    setLoading(true);
    try { await disableTwoFactor({ status: 1, password: form1.getValues('password') }); toast.success(tc('PUB_Success')); router.push('/account-manage'); } finally { setLoading(false); setShowConfirm(false); }
  };

  if (isEnable) {
    return (
      <div className="w-full">
        <Card title={t('account_manage_0020')} className="my-8">
          <div className="mb-4">{t('account_manage_0021')}</div>
          <div className="flex justify-center gap-8 pt-8">
            <div>{qrData?.qrCode ? <Image src={`data:image/png;base64,${qrData.qrCode}`} alt="" width={158} height={158} /> : <div className="w-40 h-40 border rounded flex items-center justify-center text-muted-foreground">QR Loading...</div>}</div>
            <Card className="!bg-indigo-50">
              <div className="text-sm"><div>{t('account_manage_0022')}</div><div>{t('account_manage_0023')}</div><div>{t('account_manage_0024')}{qrData?.userName}</div><div>{t('account_manage_0025')}{qrData?.secretKey?.replace(/(.{4})/g, '$1 ')}</div><div>{t('account_manage_0026')}</div></div>
            </Card>
          </div>
          <form onSubmit={form.handleSubmit(handleEnable)} className="mt-8 max-w-md mx-auto">
            <FormField name="code" label={t('account_manage_0031')} control={form.control} rules={{ required: true, pattern: { value: /^[0-9]*$/, message: t('account_manage_0032') } }} />
            <div className="text-red-500 text-xs -mt-4 mb-4">* {t('account_manage_0028')}</div>
            <FormField name="password" label={t('account_manage_0030')} control={form.control} type="password" rules={{ required: true }} />
            <div className="text-red-500 text-xs -mt-4 mb-4">* {t('account_manage_0029')}</div>
            <div className="flex gap-4"><Button type="button" variant="outline" onClick={() => router.push('/account-manage')}>{tc('PUB_Cancel')}</Button><Button type="submit" loading={loading}>{t('account_manage_0027')}</Button></div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Card title={t('account_manage_0035')} className="my-8">
        <div className="mb-4">{t('account_manage_0036')}</div>
        <form onSubmit={form1.handleSubmit(() => setShowConfirm(true))} className="max-w-md mx-auto">
          <FormField name="password" label={t('account_manage_0030')} control={form1.control} type="password" rules={{ required: true }} />
          <div className="text-red-500 text-xs -mt-4 mb-4">* {t('account_manage_0034')}</div>
          <div className="flex gap-4"><Button type="button" variant="outline" onClick={() => router.push('/account-manage')}>{tc('PUB_Cancel')}</Button><Button type="submit" className="!bg-red-500">{t('account_manage_0037')}</Button></div>
        </form>
      </Card>
      <Dialog open={showConfirm} onClose={() => setShowConfirm(false)} title={<><span className="text-yellow-500">⚠</span><span className="ml-2">{t('account_manage_0010')}</span></>}>
        <p className="mb-4">{t('account_manage_0038')}</p>
        <div className="flex justify-end gap-4"><Button variant="outline" onClick={() => setShowConfirm(false)}>{tc('PUB_Cancel')}</Button><Button className="!bg-red-500" loading={loading} onClick={handleDisable}>{tc('PUB_Disable')}</Button></div>
      </Dialog>
    </div>
  );
}
