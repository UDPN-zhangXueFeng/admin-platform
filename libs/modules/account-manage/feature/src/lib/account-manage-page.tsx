'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { Button, Card, Drawer, Dialog } from '@myorg/shared/ui';
import { toast } from '@myorg/shared/ui';
import { useAccessKey, useUserInfo, useMetaMaskHistory, useTwoFactorStatus } from '@myorg/modules/account-manage/data-access';
import { addMetaMask, disableMetaMask, editMetaMask } from '@myorg/modules/account-manage/data-access';

export function AccountManagePage() {
  const t = useTranslations('modules.account-manage'); const tc = useTranslations('common');
  const router = useRouter();
  const { data: accessKey, refetch: refetchKey } = useAccessKey();
  const { data: userInfo, refetch: refetchUser } = useUserInfo();
  const { data: mmHistory } = useMetaMaskHistory();
  const { data: twoFactor } = useTwoFactorStatus();
  const [loading, setLoading] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const [showWalletDialog, setShowWalletDialog] = React.useState(false);
  const [doRe, setDoRe] = React.useState(false);

  const handleRefreshKey = async () => { setDoRe(true); await refetchKey(); setTimeout(() => setDoRe(false), 1000); };
  const handleConnectWallet = async () => { setShowWalletDialog(true); };
  const handleDisableWallet = async () => { setLoading(true); try { await disableMetaMask(); await refetchUser(); toast.success(tc('PUB_Success')); } finally { setLoading(false); } };

  return (
    <div className="w-1/2 mb-8">
      <Card title={<div className="flex"><span>{t('account_manage_0000')}</span><span className={`cursor-pointer ml-2 ${doRe ? 'animate-spin' : ''}`} onClick={handleRefreshKey}>↻</span></div>}>
        <div className="mb-4">{t('account_manage_0001')}</div>
        <div className="border rounded">
          <KV label={t('account_manage_0046')} value={accessKey?.gateway} />
          <KV label={t('account_manage_0002')} value={accessKey?.accessKey} copyable />
          <KV label={t('account_manage_0003')} value={accessKey?.expiryDate ? new Date(Number(accessKey.expiryDate)).toLocaleString() : '-'} />
        </div>
      </Card>

      <Card title={t('account_manage_0039')} className="!mt-3">
        <div className="mb-4">{t('account_manage_0005')}</div>
        <div className="border rounded mb-3">
          <KV label={tc('PUB_Status')} value={userInfo?.status === 0 ? tc('PUB_Enabled') : tc('PUB_Disabled')} />
          {userInfo?.accountKey && <KV label={t('account_manage_0014')} value={userInfo.accountKey} copyable />}
          {userInfo?.updateOn && <KV label={tc('PUB_UpdateOn')} value={new Date(Number(userInfo.updateOn)).toLocaleString()} />}
        </div>
        <div className="flex gap-3">
          <Button loading={loading} onClick={handleConnectWallet}>{userInfo?.accountKey ? t('account_manage_0013') : t('account_manage_0006')}</Button>
          {userInfo?.accountKey && <Button variant="destructive" loading={loading} onClick={handleDisableWallet}>{tc('PUB_Disable')}</Button>}
          <Button onClick={() => setShowHistory(true)}>{t('account_manage_0007')}</Button>
        </div>
      </Card>

      <Card title={t('account_manage_0016')} className="!mt-3">
        <div className="mb-4">{t('account_manage_0017')}</div>
        <div className="border rounded"><KV label={tc('PUB_Status')} value={twoFactor?.status !== 1 ? tc('PUB_Enabled') : tc('PUB_Disabled')} /></div>
        <Button className="mt-3" style={twoFactor?.status !== 1 ? { backgroundColor: 'red' } : {}} onClick={() => router.push(`/account-manage/register?type=${twoFactor?.status}`)}>{twoFactor?.status === 1 ? t('account_manage_0018') : t('account_manage_0019')}</Button>
      </Card>

      <Drawer open={showHistory} onClose={() => setShowHistory(false)} title={t('account_manage_0007')} width="35%">
        {(mmHistory || []).map((item, i) => (
          <Card key={i} className="mb-4" title={<span className="text-sm">{item.operateType === 2 ? `${t('account_manage_0040')} ${new Date(Number(item.operateTime)).toLocaleString()} ${t('account_manage_0041')} ${item.operateUser}` : item.operateType === 3 ? `${t('account_manage_0042')} ${new Date(Number(item.operateTime)).toLocaleString()} ${t('account_manage_0041')} ${item.operateUser}` : `${t('account_manage_0043')} ${new Date(Number(item.operateTime)).toLocaleString()} ${t('account_manage_0041')} ${item.operateUser}`}</span>}>
            <KV label={tc('PUB_Status')} value={item.status !== 1 ? t('account_manage_0044') : t('account_manage_0045')} />
            <KV label={t('account_manage_0014')} value={item.accountKey} />
          </Card>
        ))}
        {(!mmHistory || mmHistory.length === 0) && <div className="text-center py-8 text-muted-foreground">No history</div>}
      </Drawer>
    </div>
  );
}

function KV({ label, value, copyable }: { label: string; value?: string; copyable?: boolean }) {
  return <div className="flex border-b last:border-b-0 py-2 px-4"><span className="w-40 text-sm text-muted-foreground">{label}</span><span className="flex-1 text-sm">{value || '-'}</span></div>;
}
