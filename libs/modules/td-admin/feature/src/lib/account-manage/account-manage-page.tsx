'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { Copy, RefreshCw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
  toast,
} from '@myorg/shared/ui';
import {
  useAccessKey,
  useAddMetaMaskMutation,
  useDisableMetaMaskMutation,
  useEditMetaMaskMutation,
  useMetaMaskHistory,
  useTwoFactorStatus,
  useUserInfo,
} from '@myorg/modules/td-admin/data-access';
import { connectToMetamask } from '../approval-manage/approval-manage-metamask';
import { formatAdminTimestamp } from '../format-admin-time';
import {
  METAMASK_OPERATE_TYPE_LABEL,
  METAMASK_OPERATE_USER_LABEL,
  METAMASK_STATUS_ENABLED,
  TWO_FACTOR_STATUS_DISABLED,
} from './account-manage.constants';

/**
 * Account management page (access key / MetaMask wallet / 2FA).
 *
 * Mirrors td-manage `src/pages/account-manage/index.tsx`:
 * - MetaMask wallet card has three states — unbound (Configure Wallet
 *   Address), bound (Update Wallet Address + Disable), and the update-history
 *   drawer. Both actions connect to MetaMask, list accounts, and let the user
 *   pick the address in a dialog before calling add/edit.
 * - Disabling asks for confirmation first, then refreshes the wallet info and
 *   the change history (mutation invalidation).
 */
export function AccountManagePage() {
  const t = useTranslations('modules.account-manage');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const router = useRouter();

  const [accessKeyQuery, setAccessKeyQuery] = React.useState('');
  const {
    data: accessKey,
    refetch: refetchAccessKey,
  } = useAccessKey(accessKeyQuery);
  const { data: userInfo } = useUserInfo();
  const { data: mmHistory } = useMetaMaskHistory();
  const { data: twoFactor } = useTwoFactorStatus();

  const addWallet = useAddMetaMaskMutation();
  const editWallet = useEditMetaMaskMutation();
  const disableWallet = useDisableMetaMaskMutation();

  const [showHistory, setShowHistory] = React.useState(false);
  const [doRe, setDoRe] = React.useState(false);

  const [connecting, setConnecting] = React.useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = React.useState(false);
  const [walletList, setWalletList] = React.useState<string[]>([]);
  const [selectedWallet, setSelectedWallet] = React.useState('');
  const [installPromptOpen, setInstallPromptOpen] = React.useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = React.useState(false);

  const hasWallet = userInfo != null;
  const savingWallet = addWallet.isPending || editWallet.isPending;
  const busy = connecting || savingWallet || disableWallet.isPending;

  const successToast = React.useCallback(
    (verb: string) => tc('PUB_Success').replace('****', verb),
    [tc]
  );

  const handleRefreshKey = async () => {
    setDoRe(true);
    const current = accessKey?.accessKey ?? '';
    // The old page re-requested the access key with the currently displayed
    // key in the body; fall back to a plain refetch when it is unchanged.
    if (current && current !== accessKeyQuery) {
      setAccessKeyQuery(current);
    } else {
      await refetchAccessKey();
    }
    window.setTimeout(() => setDoRe(false), 1000);
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const provider = await connectToMetamask({
        onRequireInstall: () => setInstallPromptOpen(true),
      });
      if (!provider) return;

      // ethers v6 `listAccounts()` resolves signers (v5 resolved addresses).
      const addresses = (await provider.listAccounts()).map(
        (signer) => signer.address
      );
      if (addresses.length === 0) return;

      setWalletList(addresses);
      setSelectedWallet(addresses[0]);
      setWalletDialogOpen(true);
    } finally {
      setConnecting(false);
    }
  };

  const handleSaveWallet = async () => {
    if (!selectedWallet) return;
    try {
      if (hasWallet) {
        await editWallet.mutateAsync(selectedWallet);
      } else {
        await addWallet.mutateAsync(selectedWallet);
      }
      setWalletDialogOpen(false);
      toast.success(successToast(tc('PUB_Submit')));
    } catch {
      toast.error('Unable to save the wallet address. Please try again.');
    }
  };

  const handleDisableWallet = async () => {
    try {
      await disableWallet.mutateAsync();
      setDisableConfirmOpen(false);
      toast.success(successToast(tc('PUB_Disable')));
    } catch {
      toast.error('Unable to disable the wallet. Please try again.');
    }
  };

  return (
    <div className="w-1/2 mb-8">
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <CardTitle>{t('account_manage_0000')}</CardTitle>
            <button
              type="button"
              className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Refresh"
              onClick={handleRefreshKey}
            >
              <RefreshCw
                className={`h-4 w-4 ${doRe ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">{t('account_manage_0001')}</div>
          <div className="rounded border">
            <KV label={t('account_manage_0046')} value={accessKey?.gateway} />
            <KV
              label={t('account_manage_0002')}
              value={accessKey?.accessKey}
              copyable
            />
            <KV
              label={t('account_manage_0003')}
              value={formatAdminTimestamp(accessKey?.expiryDate)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="!mt-3">
        <CardHeader>
          <CardTitle>{t('account_manage_0039')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">{t('account_manage_0005')}</div>
          <div className="mb-3 rounded border">
            <KV
              label={tc('PUB_Status')}
              value={
                userInfo?.status === METAMASK_STATUS_ENABLED
                  ? tc('PUB_Enabled')
                  : tc('PUB_Disabled')
              }
            />
            {userInfo?.accountKey && (
              <KV
                label={t('account_manage_0014')}
                value={userInfo.accountKey}
                copyable
              />
            )}
            {userInfo?.updateOn && (
              <KV
                label={tc('PUB_UpdateOn')}
                value={formatAdminTimestamp(userInfo.updateOn)}
              />
            )}
          </div>
          <div className="flex gap-3">
            <Button
              disabled={busy}
              loading={connecting || savingWallet}
              onClick={handleConnect}
            >
              {hasWallet
                ? t('account_manage_0013')
                : t('account_manage_0006')}
            </Button>
            {hasWallet && (
              <Button
                variant="destructive"
                disabled={busy}
                loading={disableWallet.isPending}
                onClick={() => setDisableConfirmOpen(true)}
              >
                {tc('PUB_Disable')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowHistory(true)}>
              {t('account_manage_0007')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="!mt-3">
        <CardHeader>
          <CardTitle>{t('account_manage_0016')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">{t('account_manage_0017')}</div>
          <div className="rounded border">
            <KV
              label={tc('PUB_Status')}
              value={
                twoFactor?.status === TWO_FACTOR_STATUS_DISABLED
                  ? tc('PUB_Disabled')
                  : tc('PUB_Enabled')
              }
            />
          </div>
          <Button
            className="mt-3"
            variant={
              twoFactor?.status === TWO_FACTOR_STATUS_DISABLED
                ? 'default'
                : 'destructive'
            }
            onClick={() =>
              router.push(
                `/account-manage/register?type=${twoFactor?.status ?? 0}`
              )
            }
          >
            {twoFactor?.status === TWO_FACTOR_STATUS_DISABLED
              ? t('account_manage_0018')
              : t('account_manage_0019')}
          </Button>
        </CardContent>
      </Card>

      {/* Wallet address picker — opened after MetaMask returns its accounts. */}
      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('account_manage_0015')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('account_manage_0009')}
          </p>
          <RadioGroup
            value={selectedWallet}
            onValueChange={setSelectedWallet}
            className="gap-3"
          >
            {walletList.map((address) => (
              <div key={address} className="flex items-start gap-2">
                <RadioGroupItem
                  value={address}
                  id={`wallet-${address}`}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`wallet-${address}`}
                  className="break-all font-mono text-xs font-normal"
                >
                  {address}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWalletDialogOpen(false)}
            >
              {tc('PUB_Cancel')}
            </Button>
            <Button
              type="button"
              disabled={!selectedWallet || savingWallet}
              loading={savingWallet}
              onClick={handleSaveWallet}
            >
              {tc('PUB_Submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MetaMask not installed (old page used antd Modal.confirm). */}
      <AlertDialog open={installPromptOpen} onOpenChange={setInstallPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ta('connectMetaMask')}</AlertDialogTitle>
            <AlertDialogDescription>
              {ta('metaMaskNotInstalled')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('PUB_Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                window.open('https://metamask.io/download/', '_blank')
              }
            >
              {tc('PUB_Submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable wallet confirmation. */}
      <AlertDialog
        open={disableConfirmOpen}
        onOpenChange={setDisableConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('account_manage_0010')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('account_manage_0011')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('PUB_Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={disableWallet.isPending}
              onClick={(event) => {
                // Keep the dialog open while the request is in flight so the
                // operator sees the result instead of a flash-close.
                event.preventDefault();
                void handleDisableWallet();
              }}
            >
              {tc('PUB_Disable')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Drawer open={showHistory} onOpenChange={setShowHistory}>
        <DrawerContent className="w-[35%] max-w-none">
          <DrawerHeader>
            <DrawerTitle>{t('account_manage_0007')}</DrawerTitle>
          </DrawerHeader>
          <div className="mt-4 flex flex-col gap-4 overflow-y-auto">
            {(mmHistory || []).map((item, index) => {
              const operateLabel =
                METAMASK_OPERATE_TYPE_LABEL[item.operateType];
              return (
                <Card key={`${item.operateTime}-${index}`}>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      {operateLabel
                        ? `${t(operateLabel)} ${formatAdminTimestamp(
                            item.operateTime
                          )} ${t(METAMASK_OPERATE_USER_LABEL)} ${
                            item.operateUser
                          }`
                        : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <KV
                      label={tc('PUB_Status')}
                      value={
                        item.status !== 1
                          ? t('account_manage_0044')
                          : t('account_manage_0045')
                      }
                    />
                    <KV
                      label={t('account_manage_0014')}
                      value={item.accountKey}
                    />
                  </CardContent>
                </Card>
              );
            })}
            {(!mmHistory || mmHistory.length === 0) && (
              <div className="py-8 text-center text-muted-foreground">
                No history
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function KV({
  label,
  value,
  copyable,
}: {
  label: string;
  value?: string;
  copyable?: boolean;
}) {
  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="flex border-b px-4 py-2 last:border-b-0">
      <span className="w-40 text-sm text-muted-foreground">{label}</span>
      <span className="flex flex-1 items-center gap-2 break-all text-sm">
        <span>{value || '-'}</span>
        {copyable && value ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Copy"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </span>
    </div>
  );
}
