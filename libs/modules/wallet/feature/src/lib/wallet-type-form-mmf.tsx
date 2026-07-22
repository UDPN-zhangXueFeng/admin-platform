'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@myorg/shared/ui';
import { FormDatePicker } from '@myorg/shared/ui-forms';
import {
  useAddMmfWalletTypeMutation,
  useGenerateKeystoreMutation,
  useUpdateMmfWalletTypeMutation,
  useWalletTypeDetailQuery,
  type MmfWalletTypeSavePayload,
} from '@myorg/modules/wallet/data-access';
import { getEncryptionData } from '@myorg/modules/wallet/util';
import type { MmfFormValues } from './wallet-type-form-fields';

/**
 * WalletTypeMmfForm — MMF 钱包类型表单（新增 / 编辑共用）。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/mff/mff-add.tsx`（531 行）。
 * - query.id 存在 → 编辑：useWalletTypeDetailQuery(ruleId) 回填 + updateMmf。
 * - query.id 缺失 → 新增：addMmf。
 * - 生成钱包弹窗：useGenerateKeystoreMutation({chainType:'evm', password(加密)})
 *   → 回填 address/keystore/password（明文回填到表单，提交时再加密）。
 *
 * 字段（对齐源三段布局）：
 *   1. 基金基本信息：tokenName(只读) / name / walletTypeCode / fundType / riskLevel
 *      / fundAssetValue(只读,默认1) / fundInceptionTime(新增 DatePicker/编辑只读)。
 *   2. 派息钱包：depositInterestWalletAddress(+生成钱包链接) / keystore / password
 *      （编辑态仅展示地址，不可改）。
 *   3. 统计时间：dailyStatisticalTime（原生 time input）。
 */
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

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
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
    if (!isEdit || !detail) return;
    reset({
      tokenName,
      name: detail.name,
      walletTypeCode: detail.walletTypeCode,
      riskLevel: detail.riskLevel,
      fundType: detail.fundType,
      fundAssetValue: detail.fundAssetValue ?? 1,
      fundInceptionTime: detail.fundInceptionTime
        ? new Date(Number(detail.fundInceptionTime)).toISOString().slice(0, 10)
        : '',
      depositInterestWalletAddress: detail.depositInterestWalletAddress,
      dailyStatisticalTime:
        typeof detail.dailyStatisticalTime === 'string'
          ? detail.dailyStatisticalTime.slice(0, 5)
          : '',
    });
  }, [isEdit, detail, reset, tokenName]);

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
    if (!genPassword) {
      toast.error(
        t('walletType.form.validation.required', {
          field: t('walletType.form.label.keystorePassword'),
        }),
      );
      return;
    }
    generateMutation.mutate(
      { chainType: 'evm', password: getEncryptionData(genPassword) },
      {
        onSuccess: (res) => {
          // 回填表单：address / keystore / 明文 password（提交时再加密，对齐源）。
          setValue('depositInterestWalletAddress', res.walletAddress ?? '', {
            shouldValidate: true,
          });
          setValue('depositInterestKeyStore', res.keystore ?? '');
          setValue('depositInterestKeyStorePassword', genPassword);
          setGenOpen(false);
          setGenPassword('');
          toast.success(t('walletType.form.generateWalletDialog.successHint'));
        },
        onError: () => toast.error(t('common.failed')),
      },
    );
  };

  // ── 提交确认 ──
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingValues, setPendingValues] = React.useState<MmfFormValues | null>(
    null,
  );

  const buildPayload = (values: MmfFormValues): MmfWalletTypeSavePayload => {
    const time = values.dailyStatisticalTime
      ? `${values.dailyStatisticalTime}:00`
      : '';
    // 源：编辑态 fundInceptionTime 用 details 原值（不可改）；新增态转时间戳。
    const rawInception = isEdit
      ? detail?.fundInceptionTime
      : values.fundInceptionTime
        ? new Date(values.fundInceptionTime).getTime()
        : undefined;
    const fundInceptionTime =
      rawInception === undefined || rawInception === ''
        ? undefined
        : Number(rawInception);
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
    setPendingValues(values);
    setConfirmOpen(true);
  };

  const onConfirmSubmit = () => {
    if (!pendingValues) return;
    setConfirmOpen(false);
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
    const mutation = isEdit ? updateMutation : addMutation;
    mutation.mutate(editPayload, {
      onSuccess: () => {
        toast.success(t('userWallet.modal.submitSuccess'));
        router.back();
      },
      onError: () => toast.error(t('common.failed')),
    });
  };

  const fundTypeOptions = [1, 2, 3, 4, 5, 6, 7, 8];
  const riskLevelOptions = [1, 2, 3, 4];

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-4">
      <h4 className="text-lg font-semibold">
        {t('walletType.form.mmfTitle', {
          type: isEdit ? t('common.edit') : t('common.new'),
        })}
      </h4>

      {/* ── 基金基本信息 ── */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h4 className="border-0 border-b border-solid border-slate-200 pb-2">
          {t('walletType.form.section.mmfBasic')}
        </h4>
        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          {t('walletType.form.section.mmfBasicDesc')}
        </p>
        <div className="flex flex-wrap justify-between gap-4">
          <Controller
            control={control}
            name="tokenName"
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.tokenName')}
                </Label>
                <Input value={(field.value as string) ?? ''} disabled />
              </div>
            )}
          />
          <Controller
            control={control}
            name="accountType"
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.accountType')}
                </Label>
                <Input value={(field.value as string) ?? ''} disabled />
              </div>
            )}
          />
          <Controller
            control={control}
            name="name"
            rules={{
              required: t('walletType.form.validation.required', {
                field: t('walletType.form.label.fundName'),
              }),
              pattern: {
                value: /^[a-zA-Z0-9 \-/]+$/,
                message: t('walletType.form.validation.namePattern'),
              },
            }}
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.fundName')}
                </Label>
                <Input
                  value={(field.value as string) ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  maxLength={50}
                  placeholder={t('walletType.form.placeholder.walletTypeName')}
                  aria-invalid={!!errors.name}
                />
                {errors.name ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {String(errors.name.message ?? '')}
                  </p>
                ) : null}
              </div>
            )}
          />
          <Controller
            control={control}
            name="walletTypeCode"
            rules={{
              required: t('walletType.form.validation.required', {
                field: t('walletType.form.label.walletTypeCode'),
              }),
              pattern: {
                value: /^[a-zA-Z0-9._-]+$/,
                message: t('walletType.form.validation.codePattern'),
              },
            }}
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.walletTypeCode')}
                </Label>
                <Input
                  value={(field.value as string) ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  maxLength={20}
                  disabled={isEdit}
                  placeholder={t('walletType.form.placeholder.walletTypeCode')}
                  aria-invalid={!!errors.walletTypeCode}
                />
                {errors.walletTypeCode ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {String(errors.walletTypeCode.message ?? '')}
                  </p>
                ) : null}
              </div>
            )}
          />
          <Controller
            control={control}
            name="fundType"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.fundType')}
                </Label>
                <Select
                  value={
                    field.value != null ? String(field.value) : undefined
                  }
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <SelectTrigger aria-invalid={!!errors.fundType}>
                    <SelectValue placeholder={t('walletType.form.label.fundType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {fundTypeOptions.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {t(`walletType.mmfFundType.${n}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fundType ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {t('walletType.form.validation.required', {
                      field: t('walletType.form.label.fundType'),
                    })}
                  </p>
                ) : null}
              </div>
            )}
          />
          <Controller
            control={control}
            name="riskLevel"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.riskLevel')}
                </Label>
                <Select
                  value={
                    field.value != null ? String(field.value) : undefined
                  }
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <SelectTrigger aria-invalid={!!errors.riskLevel}>
                    <SelectValue placeholder={t('walletType.form.label.riskLevel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {riskLevelOptions.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {t(`walletType.mmfRiskLevel.${n}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.riskLevel ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {t('walletType.form.validation.required', {
                      field: t('walletType.form.label.riskLevel'),
                    })}
                  </p>
                ) : null}
              </div>
            )}
          />
          <Controller
            control={control}
            name="fundAssetValue"
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {t('walletType.form.label.fundAssetValue')}
                </Label>
                <div className="flex items-stretch">
                  <Input
                    type="number"
                    value={field.value === undefined ? '' : String(field.value)}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    className="rounded-r-none"
                    disabled
                  />
                  {symbol ? (
                    <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                      {symbol}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          />
          <FormDatePicker<MmfFormValues>
            name="fundInceptionTime"
            control={control}
            label={t('walletType.form.label.fundInceptionTime')}
            required
            disabled={isEdit}
            max={new Date().toISOString().slice(0, 10)}
            error={
              errors.fundInceptionTime
                ? t('walletType.form.validation.required', {
                    field: t('walletType.form.label.fundInceptionTime'),
                  })
                : undefined
            }
          />
        </div>
      </section>

      {/* ── 派息钱包 ── */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
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
              render={({ field }) => (
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
              render={({ field }) => (
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
                </div>
              )}
            />
          </>
        ) : null}
      </section>

      {/* ── 统计时间 ── */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h4 className="border-0 border-b border-solid border-slate-200 pb-2">
          {t('walletType.form.section.statisticalTime')}
        </h4>
        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          {t('walletType.form.section.statisticalTimeDesc')}
        </p>
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
      </section>

      {/* ── 底部操作 ── */}
      <div className="mt-10 flex justify-end gap-8">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t('common.back')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {t('common.submit')}
        </Button>
      </div>

      {/* ── 生成钱包弹窗 ── */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
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

      {/* ── 提交确认 ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.confirm')}</DialogTitle>
            <DialogDescription>{t('walletType.form.confirmContent')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={isPending} onClick={onConfirmSubmit}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
