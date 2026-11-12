'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
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
  toast,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import {
  useAddTwoFactorMutation,
  useDisableTwoFactorMutation,
  useQrCode,
} from '@myorg/modules/td-admin/data-access';

const DEFAULT_QR_TTL_SECONDS = 1800;

/**
 * 2FA enable/disable page.
 *
 * Mirrors td-manage `src/pages/account-manage/components/register.tsx`:
 * - `?type=1` → register an authenticator (QR + code + current password).
 * - any other type → disable 2FA (current password + confirmation).
 *
 * The password is submitted in plaintext to the data-access layer, which
 * applies the AES encryption the RBAC backend expects; it is never sent raw.
 */
export function AccountRegisterPage() {
  const t = useTranslations('modules.account-manage');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = Number(searchParams.get('type'));
  const isEnable = type === 1;

  const {
    data: qrData,
    refetch: refetchQrCode,
    isFetching: qrFetching,
  } = useQrCode(isEnable);
  const addTwoFactor = useAddTwoFactorMutation();
  const disableTwoFactor = useDisableTwoFactorMutation();

  const [qrExpired, setQrExpired] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const form = useForm<{ code: string; password: string }>({
    defaultValues: { code: '', password: '' },
  });
  const form1 = useForm<{ password: string }>({
    defaultValues: { password: '' },
  });

  // Expire the QR code after the server-provided TTL (old page: expire * 1000).
  React.useEffect(() => {
    if (!isEnable || !qrData?.qrCode) return;
    setQrExpired(false);
    const ttlSeconds =
      Number(qrData.expire) > 0
        ? Number(qrData.expire)
        : DEFAULT_QR_TTL_SECONDS;
    const timer = window.setTimeout(
      () => setQrExpired(true),
      ttlSeconds * 1000
    );
    return () => window.clearTimeout(timer);
  }, [isEnable, qrData]);

  const handleRefreshQr = () => {
    setQrExpired(false);
    void refetchQrCode();
  };

  const handleEnable = async (values: { code: string; password: string }) => {
    try {
      await addTwoFactor.mutateAsync(values);
      toast.success(tc('PUB_Success').replace('****', tc('PUB_Submit')));
      router.push('/account-manage');
    } catch {
      toast.error('Unable to register the authenticator. Please try again.');
    }
  };

  const handleDisable = async () => {
    try {
      await disableTwoFactor.mutateAsync({
        password: form1.getValues('password'),
      });
      toast.success(tc('PUB_Success').replace('****', tc('PUB_Submit')));
      setShowConfirm(false);
      router.push('/account-manage');
    } catch {
      toast.error('Unable to disable two-factor authentication.');
    }
  };

  if (isEnable) {
    return (
      <div className="w-full">
        <Card className="my-8">
          <CardHeader>
            <CardTitle>{t('account_manage_0020')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">{t('account_manage_0021')}</div>
            <div className="flex justify-center gap-8 pt-8">
              <div>
                {qrExpired ? (
                  <div className="flex h-[158px] w-[158px] flex-col items-center justify-center gap-2 rounded border text-center text-xs text-muted-foreground">
                    <span>QR code expired</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={qrFetching}
                      onClick={handleRefreshQr}
                    >
                      Refresh
                    </Button>
                  </div>
                ) : qrData?.qrCode ? (
                  <Image
                    src={`data:image/png;base64,${qrData.qrCode}`}
                    alt="2FA QR code"
                    width={158}
                    height={158}
                  />
                ) : (
                  <div className="flex h-[158px] w-[158px] items-center justify-center rounded border text-xs text-muted-foreground">
                    QR Loading...
                  </div>
                )}
              </div>
              <Card className="!bg-indigo-50">
                <div className="space-y-1 p-4 text-sm">
                  <div>{t('account_manage_0022')}</div>
                  <div>{t('account_manage_0023')}</div>
                  <div>
                    {t('account_manage_0024')}
                    {qrData?.userName}
                  </div>
                  <div>
                    {t('account_manage_0025')}
                    {qrData?.secretKey?.replace(/(.{4})/g, '$1 ')}
                  </div>
                  <div>{t('account_manage_0026')}</div>
                </div>
              </Card>
            </div>
            <form
              onSubmit={form.handleSubmit(handleEnable)}
              className="mx-auto mt-8 max-w-md"
            >
              <FormField
                name="code"
                label={t('account_manage_0031')}
                required
                register={form.register('code', {
                  required: t('account_manage_0033'),
                  pattern: {
                    value: /^[0-9]*$/,
                    message: t('account_manage_0032'),
                  },
                })}
                error={form.formState.errors.code?.message}
              />
              <div className="-mt-4 mb-4 text-xs text-red-500">
                * {t('account_manage_0028')}
              </div>
              <FormField
                name="password"
                label={t('account_manage_0030')}
                type="password"
                required
                register={form.register('password', {
                  required: 'Required',
                })}
                error={form.formState.errors.password?.message}
              />
              <div className="-mt-4 mb-4 text-xs text-red-500">
                * {t('account_manage_0029')}
              </div>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/account-manage')}
                >
                  {tc('PUB_Cancel')}
                </Button>
                <Button type="submit" loading={addTwoFactor.isPending}>
                  {t('account_manage_0027')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Card className="my-8">
        <CardHeader>
          <CardTitle>{t('account_manage_0035')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">{t('account_manage_0036')}</div>
          <form
            onSubmit={form1.handleSubmit(() => setShowConfirm(true))}
            className="mx-auto max-w-md"
          >
            <FormField
              name="password"
              label={t('account_manage_0030')}
              type="password"
              required
              register={form1.register('password', {
                required: 'Required',
              })}
              error={form1.formState.errors.password?.message}
            />
            <div className="-mt-4 mb-4 text-xs text-red-500">
              * {t('account_manage_0034')}
            </div>
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/account-manage')}
              >
                {tc('PUB_Cancel')}
              </Button>
              <Button type="submit" variant="destructive">
                {t('account_manage_0037')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="text-yellow-500">!</span>
              <span className="ml-2">{t('account_manage_0010')}</span>
            </DialogTitle>
          </DialogHeader>
          <p className="mb-4 text-sm">{t('account_manage_0038')}</p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirm(false)}
            >
              {tc('PUB_Cancel')}
            </Button>
            <Button
              variant="destructive"
              loading={disableTwoFactor.isPending}
              onClick={handleDisable}
            >
              {tc('PUB_Disable')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
