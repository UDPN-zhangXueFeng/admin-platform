'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useAddMmfWalletTypeMutation,
  useGenerateKeystoreMutation,
  useUpdateMmfWalletTypeMutation,
  useWalletTypeDetailQuery,
  type MmfWalletTypeSavePayload,
} from '@myorg/modules/td-admin/data-access';
import { getEncryptionData } from '.';
import type { MmfFormValues } from './wallet-type-form-fields';
import { WalletTypeMmfFundFields } from './wallet-type-mmf-fund-fields';
import { WalletTypeMmfPayoutFields } from './wallet-type-mmf-payout-fields';
import { WalletTypeSubmitDialog } from './wallet-type-submit-dialog';

export function WalletTypeMmfForm({
  ruleId,
  tdId,
  tokenName,
  symbol,
}: {
  ruleId?: number;
  tdId: number;
  tokenName?: string;
  symbol?: string;
}): React.JSX.Element {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const isEdit = ruleId != null;

  const today = formatDate(new Date(), 'yyyy-MM-dd');
  const submitLock = React.useRef(false);
  const generateLock = React.useRef(false);
  const hydrated = React.useRef<number | undefined>(undefined);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<MmfFormValues>({
    defaultValues: {
      tokenName,
      fundAssetValue: 1,
      accountType: t('accountType.3'),
    },
  });

  const detailResult = useWalletTypeDetailQuery(ruleId, isEdit);
  const detail = detailResult.data;

  // 编辑态回填（源 getWalletheadDetails → setFieldsValue）。
  React.useEffect(() => {
    if (!isEdit || !detail || hydrated.current === ruleId) return;
    hydrated.current = ruleId;
    const inception = Number(detail.fundInceptionTime);
    const inceptionDate = new Date(inception < 1e12 ? inception * 1000 : inception);
    reset({
      tokenName,
      accountType: t('accountType.3'),
      name: detail.name,
      walletTypeCode: detail.walletTypeCode,
      riskLevel: detail.riskLevel,
      fundType: detail.fundType,
      fundAssetValue: detail.fundAssetValue ?? 1,
      fundInceptionTime: inception && !Number.isNaN(inceptionDate.getTime()) ? formatDate(inceptionDate, 'yyyy-MM-dd') : '',
      depositInterestWalletAddress: detail.depositInterestWalletAddress,
      dailyStatisticalTime: detail.dailyStatisticalTime ?? '',
    });
  }, [isEdit, detail, reset, tokenName, ruleId, t]);

  const addMutation = useAddMmfWalletTypeMutation();
  const updateMutation = useUpdateMmfWalletTypeMutation();
  const generateMutation = useGenerateKeystoreMutation();
  const isPending = addMutation.isPending || updateMutation.isPending;

  // ── 生成钱包弹窗 ──
  const [genOpen, setGenOpen] = React.useState(false);
  const [genPassword, setGenPassword] = React.useState('');

  // 源：已存在 address/keystore 时二次确认覆盖，否则直接打开。
  const openGenerateDialog = () => {
    const existing =
      getValues('depositInterestWalletAddress') ||
      getValues('depositInterestKeyStore');
    if (existing) {
      setConfirmReplaceGen(true);
    } else {
      setGenPassword('');
      setGenOpen(true);
    }
  };
  const [confirmReplaceGen, setConfirmReplaceGen] = React.useState(false);

  const onGenerate = () => {
    if (generateLock.current) return;
    if (!genPassword) {
      toast.error(
        t('walletType.form.validation.required', {
          field: t('walletType.form.label.keystorePassword'),
        }),
      );
      return;
    }
    generateLock.current = true;
    generateMutation.mutate(
      { chainType: 'evm', password: getEncryptionData(genPassword) },
      {
        onSuccess: (res) => {
          if (!res?.walletAddress || !res.keystore) {
            toast.error(t('common.failed'));
            return;
          }
          setValue('depositInterestWalletAddress', res.walletAddress, { shouldValidate: true });
          setValue('depositInterestKeyStore', res.keystore, { shouldValidate: true });
          setValue('depositInterestKeyStorePassword', genPassword);
          setGenOpen(false);
          setGenPassword('');
          toast.success(t('walletType.form.generateWalletDialog.successHint'));
        },
        onSettled: () => { generateLock.current = false; },
      },
    );
  };

  // ── 提交确认 ──
  const [pendingValues, setPendingValues] = React.useState<MmfFormValues | null>(
    null,
  );

  const buildPayload = (values: MmfFormValues): MmfWalletTypeSavePayload => {
    const rawTime = values.dailyStatisticalTime ?? '';
    const time = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
    const fundInceptionTime = values.fundInceptionTime
      ? new Date(`${values.fundInceptionTime}T00:00:00`).getTime()
      : undefined;
    return {
      tdId,
      ...(isEdit ? { ruleId } : {}),
      name: values.name,
      walletTypeCode: values.walletTypeCode,
      fundType: values.fundType,
      riskLevel: values.riskLevel,
      fundAssetValue: Number(values.fundAssetValue ?? 1),
      fundInceptionTime,
      depositInterestWalletAddress: values.depositInterestWalletAddress,
      depositInterestKeyStore: values.depositInterestKeyStore,
      // 源：提交时对明文密码加密。
      depositInterestKeyStorePassword: values.depositInterestKeyStorePassword
        ? getEncryptionData(values.depositInterestKeyStorePassword)
        : undefined,
      dailyStatisticalTime: time,
    };
  };

  const onValid = (values: MmfFormValues) => {
    if (isPending || (isEdit && !detail)) return;
    if (!isEdit && (!values.fundInceptionTime || values.fundInceptionTime > today)) {
      setError('fundInceptionTime', {
        message: values.fundInceptionTime ? t('walletType.form.validation.futureDate') : t('walletType.form.validation.required', {
          field: t('walletType.form.label.fundInceptionTime'),
        }),
      }, { shouldFocus: true });
      return;
    }
    setPendingValues(values);
  };

  const onConfirmSubmit = () => {
    if (!pendingValues || submitLock.current) return;
    submitLock.current = true;
    const payload = buildPayload(pendingValues);
    // 源：编辑态仅提交 dailyStatisticalTime/fundType/name/riskLevel（updateMMFWalletTypeApi）。
    const editPayload: MmfWalletTypeSavePayload = isEdit
      ? {
          ruleId,
          dailyStatisticalTime: payload.dailyStatisticalTime,
          fundType: payload.fundType,
          name: payload.name,
          riskLevel: payload.riskLevel,
        }
      : payload;
    setPendingValues(null);
    const mutation = isEdit ? updateMutation : addMutation;
    mutation.mutate(editPayload, {
      onSuccess: () => {
        toast.success(t('userWallet.modal.submitSuccess'));
        router.back();
      },
      onSettled: () => { submitLock.current = false; },
    });
  };

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-4">
      <h4 className="text-lg font-semibold">
        {t('walletType.form.mmfTitle', {
          type: isEdit ? t('common.edit') : t('common.new'),
        })}
      </h4>
      {detailResult.isError && <p role="alert" className="text-destructive">{t('walletType.loadFailed')}</p>}

      <WalletTypeMmfFundFields control={control} errors={errors} isEdit={isEdit} symbol={symbol} today={today} />

      <WalletTypeMmfPayoutFields control={control} errors={errors} isEdit={isEdit} openGenerateDialog={openGenerateDialog} />

      {/* ── 统计时间 ── */}
      <Card className="p-6">
        <h4 className="border-0 border-b border-solid border-slate-200 pb-2">
          {t('walletType.form.section.statisticalTime')}
        </h4>
        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          {t('walletType.form.section.statisticalTimeDesc')}
        </p>
        <div className="mb-4 w-[45%] min-w-[200px]">
          <Label htmlFor="wt-distribution-frequency">{t('walletType.form.label.distributionFrequency')}</Label>
          <Input id="wt-distribution-frequency" disabled value={t('walletType.form.label.everyDay')} />
        </div>
        <Controller
          control={control}
          name="dailyStatisticalTime"
          rules={{
            required: t('walletType.form.validation.required', {
              field: t('walletType.form.label.dailyStatisticalTime'),
            }),
          }}
          render={({ field }) => (
            <div className="w-[45%] min-w-[200px]">
              <Label className="mb-1.5 block text-sm font-medium">
                {t('walletType.form.label.dailyStatisticalTime')}
              </Label>
              <Input
                type="time"
                step={1}
                value={(field.value as string) ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
              {errors.dailyStatisticalTime ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {String(errors.dailyStatisticalTime.message ?? '')}
                </p>
              ) : null}
            </div>
          )}
        />
      </Card>

      {/* ── 底部操作 ── */}
      <div className="mt-10 flex justify-end gap-8">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t('common.back')}
        </Button>
        <Button type="submit" disabled={isPending || (isEdit && !detail)}>
          {t('common.submit')}
        </Button>
      </div>

      {/* ── 生成钱包弹窗 ── */}
      <Dialog open={genOpen} onOpenChange={(next) => { if (!generateLock.current) setGenOpen(next); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('walletType.form.generateWalletDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('walletType.form.generateWalletDialog.subTitle')}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              {t('walletType.form.label.keystorePassword')}
            </Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={genPassword}
              onChange={(e) => setGenPassword(e.target.value)}
            />
            <p className="mt-2 flex items-center text-sm text-primary">
              {t('walletType.form.label.keystorePasswordHint')}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={generateMutation.isPending}
              onClick={() => {
                setGenPassword('');
                setGenOpen(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={generateMutation.isPending}
              onClick={onGenerate}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WalletTypeSubmitDialog open={pendingValues !== null} onClose={() => setPendingValues(null)} submitting={isPending} onConfirm={onConfirmSubmit} />

      {/* ── 覆盖已生成钱包的二次确认 ── */}
      <Dialog open={confirmReplaceGen} onOpenChange={setConfirmReplaceGen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.confirm')}</DialogTitle>
            <DialogDescription>{t('walletType.form.confirmContent')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmReplaceGen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmReplaceGen(false);
                setGenPassword('');
                setGenOpen(true);
              }}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
