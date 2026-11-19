'use client';

import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Card, Input, Label, Textarea } from '@myorg/shared/ui';
import type { MmfFormValues } from './wallet-type-form-fields';

export function WalletTypeMmfPayoutFields({ control, errors, isEdit, openGenerateDialog }: {
  control: Control<MmfFormValues>;
  errors: FieldErrors<MmfFormValues>;
  isEdit: boolean;
  openGenerateDialog: () => void;
}) {
  const t = useTranslations('modules.wallet');
  return (
      <Card className="p-6">
        <h4 className="border-0 border-b border-solid border-slate-200 pb-2">
          {t('walletType.form.section.dividendWallet')}
        </h4>
        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          {t('walletType.form.section.dividendWalletDesc')}
        </p>
        <Controller
          control={control}
          name="depositInterestWalletAddress"
          rules={{
            required: t('walletType.form.validation.required', {
              field: t('walletType.form.label.depositInterestWalletAddress'),
            }),
          }}
          render={({ field }) => (
            <div className="w-[45%] min-w-[200px]">
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="block text-sm font-medium">
                  {t('walletType.form.label.depositInterestWalletAddress')}
                </Label>
                {!isEdit ? (
                  <button
                    type="button"
                    className="text-sm text-primary underline-offset-2 hover:underline"
                    onClick={openGenerateDialog}
                  >
                    {t('walletType.form.label.generateWalletLink')}
                  </button>
                ) : null}
              </div>
              <Input
                value={(field.value as string) ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                disabled={isEdit}
                aria-invalid={!!errors.depositInterestWalletAddress}
              />
              {isEdit ? (
                <p className="mt-1 text-sm text-primary">
                  {t('walletType.form.addressLocked')}
                </p>
              ) : null}
              {errors.depositInterestWalletAddress ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {String(errors.depositInterestWalletAddress.message ?? '')}
                </p>
              ) : null}
            </div>
          )}
        />
        {!isEdit ? (
          <>
            <Controller
              control={control}
              name="depositInterestKeyStore"
              rules={{
                required: t('walletType.form.validation.required', {
                  field: t('walletType.form.label.depositInterestKeyStore'),
                }),
              }}
              render={({ field, fieldState }) => (
                <div className="mt-4 w-[45%] min-w-[200px]">
                  <Label className="mb-1.5 block text-sm font-medium">
                    {t('walletType.form.label.depositInterestKeyStore')}
                  </Label>
                  <Textarea
                    rows={4}
                    value={(field.value as string) ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                  {fieldState.error && <p role="alert" className="text-sm text-destructive">{fieldState.error.message}</p>}
                </div>
              )}
            />
            <Controller
              control={control}
              name="depositInterestKeyStorePassword"
              rules={{
                required: t('walletType.form.validation.required', {
                  field: t('walletType.form.label.depositInterestKeyStorePassword'),
                }),
              }}
              render={({ field, fieldState }) => (
                <div className="mt-4 w-[45%] min-w-[200px]">
                  <Label className="mb-1.5 block text-sm font-medium">
                    {t('walletType.form.label.depositInterestKeyStorePassword')}
                  </Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={(field.value as string) ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                  {fieldState.error && <p role="alert" className="text-sm text-destructive">{fieldState.error.message}</p>}
                </div>
              )}
            />
          </>
        ) : null}
      </Card>
  );
}
