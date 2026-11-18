'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAvailableWalletTypesQuery, useChangeWalletTypeMutation, useFundsOperateMutation, useWalletOperateMutation, type UserWallet } from '@myorg/modules/td-admin/data-access';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Textarea } from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { amountWithSymbol, type UserWalletAction } from './user-wallet-rules';
import { WalletLoadError } from './user-wallet-table';

interface ActionFields {
  stablecoinCount: string;
  newRuleId: string;
  remarks: string;
}

export function UserWalletActionDialog({ row, action, onClose }: {
  row: UserWallet;
  action: UserWalletAction;
  onClose: () => void;
}) {
  const t = useTranslations('modules.wallet');
  const changeType = action === 'changeWalletType';
  const funds = action === 'freezeFunds' || action === 'unfreezeFunds';
  const choices = useAvailableWalletTypesQuery(row.walletId, changeType);
  const options = (choices.data ?? []).flatMap(({ ruleId, walletType }) => ruleId == null ? [] : [{
    value: String(ruleId), label: walletType ?? String(ruleId),
  }]);
  const currentRule = options.find((option) => option.label === row.walletType)?.value ?? '';

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`userWallet.modal.${action}Title`)}</DialogTitle>
          <DialogDescription>{t(`userWallet.modal.${action}SubTitle`)}</DialogDescription>
        </DialogHeader>
        {changeType && choices.isError ? <WalletLoadError retry={choices.refetch} /> :
          changeType && choices.isPending ? <p role="status">{t('userWallet.modal.loadingAvailableTypes')}</p> :
          changeType && !options.length ? <p role="status">{t('userWallet.modal.noAvailableTypes')}</p> :
          <ActionForm row={row} action={action} funds={funds} currentRule={currentRule} options={options} onClose={onClose} />}
        {changeType && (choices.isError || choices.isPending || !options.length) && (
          <DialogFooter><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button></DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActionForm({ row, action, funds, currentRule, options, onClose }: {
  row: UserWallet;
  action: UserWalletAction;
  funds: boolean;
  currentRule: string;
  options: { value: string; label: string }[];
  onClose: () => void;
}) {
  const t = useTranslations('modules.wallet');
  const changeType = action === 'changeWalletType';
  const freeze = action === 'freezeFunds' || action === 'freezeWallet';
  const fundsMutation = useFundsOperateMutation();
  const walletMutation = useWalletOperateMutation();
  const changeMutation = useChangeWalletTypeMutation();
  const { control, register, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<ActionFields>({
    defaultValues: { stablecoinCount: '', newRuleId: currentRule, remarks: '' },
  });
  const amount = t('userWallet.modal.amount');
  const reason = t(freeze ? 'userWallet.modal.reasonFreeze' : 'userWallet.modal.reasonUnfreeze');

  return (
    <form noValidate className="space-y-4" onSubmit={handleSubmit(async (values) => {
      clearErrors();
      const required = (field: string) => t('userWallet.modal.fieldRequired', { field });
      const stablecoinCount = values.stablecoinCount.trim();
      const remarks = values.remarks.trim();
      const rule = options.find((option) => option.value === values.newRuleId);
      let invalid = false;
      if (funds && (!stablecoinCount || !/[1-9]/.test(stablecoinCount))) {
        setError('stablecoinCount', { message: required(amount) });
        invalid = true;
      } else if (funds && !/^\d+(?:\.\d{1,6})?$/.test(stablecoinCount)) {
        setError('stablecoinCount', { message: t('userWallet.modal.amountPrecision') });
        invalid = true;
      }
      if (changeType && !rule) {
        setError('newRuleId', { message: t('userWallet.modal.selectWalletType') });
        invalid = true;
      }
      if (!remarks || remarks.length > 200) {
        setError('remarks', { message: remarks ? t('userWallet.modal.remarksMaxLength') : required(reason) });
        invalid = true;
      }
      if (invalid || !row.walletId) return;
      const walletId = Number(row.walletId);
      try {
        if (funds) await fundsMutation.mutateAsync({ walletId, type: freeze ? 6 : 7, stablecoinCount, remarks });
        else if (changeType && rule) await changeMutation.mutateAsync({ walletId, newRuleId: Number(rule.value), reason: remarks });
        else await walletMutation.mutateAsync({ walletId, type: freeze ? 2 : 3, remarks });
        toast.success(t('userWallet.modal.submitSuccess'));
        onClose();
      } catch (error) {
        setError('root', { message: error instanceof Error && error.message ? error.message : t('userWallet.modal.submitFailed') });
      }
    })}>
      {funds && (
        <div className="space-y-2">
          <FormField name="stablecoinCount" label={amount} register={register('stablecoinCount')} inputMode="decimal" required error={errors.stablecoinCount?.message} />
          <p className="text-sm text-muted-foreground">
            {t(freeze ? 'userWallet.modal.availableBalance' : 'userWallet.modal.frozenBalance')}
            {amountWithSymbol(freeze ? row.usableCount : row.freezeCount, row.symbol)}
          </p>
        </div>
      )}
      {changeType && (
        <>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>{t('userWallet.modal.tokenName')}</span>
            <Input value={row.tdName ?? ''} disabled />
          </label>
          <FormSelect name="newRuleId" control={control} label={t('userWallet.modal.walletType')}
            options={options} placeholder={t('userWallet.modal.selectWalletType')} required error={errors.newRuleId?.message} />
        </>
      )}
      <div className="space-y-1.5">
        <label htmlFor="wallet-action-remarks" className="text-sm font-medium">{reason} *</label>
        <Textarea id="wallet-action-remarks" {...register('remarks')} maxLength={200} rows={5} required
          aria-invalid={Boolean(errors.remarks)} aria-describedby={errors.remarks ? 'wallet-remarks-error' : undefined} />
        {errors.remarks?.message && <p id="wallet-remarks-error" role="alert" className="text-sm text-destructive">{errors.remarks.message}</p>}
      </div>
      {!changeType && <p className="text-sm text-muted-foreground">{t(`userWallet.modal.${action}Tip`)}</p>}
      {errors.root?.message && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={isSubmitting}>{t('common.submit')}</Button>
      </DialogFooter>
    </form>
  );
}
