'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import {
  Button,
  Checkbox,
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
import {
  useAccountTypesQuery,
  useAddWalletTypeMutation,
  useInterestPolicyQuery,
  useUpdateWalletTypeMutation,
  useWalletTypeDetailQuery,
  type InterestPolicy,
  type WalletTypeSavePayload,
} from '@myorg/modules/wallet/data-access';
import { getEncryptionData, UNLIMITED_THRESHOLD } from '@myorg/modules/wallet/util';
import {
  AddressField,
  AmountField,
  ReadOnlyField,
  type WalletTypeFormValues,
} from './wallet-type-form-fields';

/**
 * WalletTypeRegularForm — 常规钱包类型条件表单（新增 / 编辑共用）。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/edit.tsx`（1242 行）。
 *
 * 条件矩阵（源码核心）：
 * - issueType===5（TD）：渲染 accountType Select + 利息特性 Checkbox；否则二者不渲染。
 * - isTdCurrentAccount = issueType===5 && accountType===1（活期透支）：Checkbox 禁用。
 * - 维护费段：仅 issueType===5。
 * - 利息/透支段：!isTdCurrentAccount && interestFeatureEnablement：
 *   · accountType===2（储蓄）：arrangedInterestPolicy + 阶梯(calculateType===2)/固定利率
 *     + 生效日期 + deposit/accountClosure 地址 + keystore/password（新增，非负利率时无）。
 *   · accountType===1（活期透支）：arranged overdraft + arranged 利息 + unarranged
 *     overdraft + unarranged 利息 + receiving 地址 ×2。
 *
 * 利息策略：声明式 useInterestPolicyQuery(accountType)，结果就绪后填默认项；
 * Select onChange 时按选中项回填 rate/date/saveDetails（源 initInterestPolicyInfo）。
 *
 * 限额归一：提交时 ≥99999999999 → -1（normalizeLimitForSubmit）。
 * keystore 密码：提交时 getEncryptionData 加密。
 */
export function WalletTypeRegularForm({
  ruleId,
  tdId,
  tokenName,
  symbol,
  issueType,
}: {
  ruleId?: number;
  tdId: number;
  tokenName?: string;
  symbol?: string;
  issueType?: number;
}): React.JSX.Element {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const isEdit = ruleId != null;
  const isTd = issueType === 5;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WalletTypeFormValues>({
    defaultValues: { tokenName, maintenanceFeeCycle: 1 },
  });

  const accountType = watch('accountType') as number | undefined;
  const interestFeatureEnablement = watch(
    'interestFeatureEnablement',
  ) as boolean | undefined;

  const [checked, setChecked] = React.useState(false);

  const isTdCurrentAccount = isTd && accountType === 1;
  const showInterestSection =
    !isTdCurrentAccount && Boolean(interestFeatureEnablement);

  // ── 账户类型下拉 ──
  const accountTypesQuery = useAccountTypesQuery(tdId, isTd);
  const accountTypeList = accountTypesQuery.data ?? [];

  // ── 利息策略（accountType 驱动；活期透支固定 calculateType=1）──
  const interestQuery = useInterestPolicyQuery(
    {
      accountType: accountType ?? 0,
      interestType: accountType,
      calculateType: accountType === 1 ? 1 : undefined,
    },
    Boolean(accountType) && showInterestSection,
  );
  const interestPolicy = (interestQuery.data ?? []) as InterestPolicy[];

  // ── 编辑态详情回填 ──
  const detailResult = useWalletTypeDetailQuery(ruleId, isEdit);
  const detail = detailResult.data;
  const [detailApplied, setDetailApplied] = React.useState(false);

  // 限额回填：-1 → 99999999999（源码归一）。
  const normLimit = (v?: number | null) =>
    v === undefined || v === null || v === -1 ? UNLIMITED_THRESHOLD : v;

  React.useEffect(() => {
    if (!isEdit || !detail || detailApplied) return;
    reset({
      tokenName,
      name: detail.name,
      accountType: detail.accountType,
      singleTradingLimit: normLimit(detail.singleTradingLimit),
      dailyTradingLimit: normLimit(detail.dailyTradingLimit),
      balanceLimit: normLimit(detail.balanceLimit),
      minimumBalance: normLimit(detail.minimumBalance),
      dailyRedeemLimit: normLimit(detail.dailyRedeemLimit),
    });
    setDetailApplied(true);
  }, [isEdit, detail, detailApplied, reset, tokenName]);

  // 编辑态：详情就绪后填 TD 相关（维护费 / 利息策略默认项 / 透支字段）。
  // 延后一个 tick 让 interestPolicy 先加载（源码 setTimeout 300ms）。
  React.useEffect(() => {
    if (!isEdit || !detail || !isTd) return;
    const isChecked = detail.accountType === 1 ? false : detail.interestFeatureEnablement === 2;
    setChecked(isChecked);
    setValue('interestFeatureEnablement', isChecked);
    setValue('accountType', detail.accountType);
    setValue('maintenanceFee', numOrEmpty(detail.maintenanceFee));
    setValue('maintenanceFeeCycle', detail.feeCycle ?? 1);
    setValue('monthlyMinimumBalanceFee', numOrEmpty(detail.minimumBalanceFee));
    setValue('accountFeesWalletAddress', detail.accountFeesWalletAddress);

    if (detail.accountType === 1) {
      // 活期透支
      applyPolicy(detail, 'arranged');
      applyPolicy(detail, 'unarranged');
      setValue('arrangedOverdraftAmount', numOrEmpty(detail.arrangedOverdraftAmount));
      setValue('overdraftBufferPeriod', detail.overdraftBufferPeriod);
      setValue('overdraftBufferAmount', numOrEmpty(detail.overdraftBufferAmount));
      setValue('unarrangedOverdraftAmount', numOrEmpty(detail.unarrangedOverdraftAmount));
      setValue('unarrangedOverdraftFee', numOrEmpty(detail.unarrangedOverdraftFee));
      setValue('unarrangedOverdraftFeeMax', numOrEmpty(detail.unarrangedOverdraftFeeMax));
      setValue('receivingOverdraftFeeWalletAddress', detail.receivingOverdraftFeeWalletAddress);
      setValue('receivingOverdraftInterestWalletAddress', detail.receivingOverdraftInterestWalletAddress);
    } else {
      // 储蓄
      applyPolicy(detail, 'arranged');
      setValue('depositInterestWalletAddress', detail.depositInterestWalletAddress);
      setValue('accountClosureInterestWalletAddress', detail.accountClosureInterestWalletAddress);
      setValue('depositInterestKeyStore', detail.depositInterestKeyStore as string);
      setValue('depositInterestKeyStorePassword', detail.depositInterestKeyStorePassword as string);
    }
  }, [isEdit, detail, isTd]);

  // 利息策略默认项填充（非编辑态 / interestPolicy 就绪）。
  React.useEffect(() => {
    if (!interestPolicy.length) return;
    if (accountType === 1) {
      applyInterestPolicy(interestPolicy[0], 'arranged');
      applyInterestPolicy(interestPolicy[0], 'unarranged');
    } else {
      applyInterestPolicy(interestPolicy[0], 'arranged');
    }
  }, [accountType, interestPolicy, interestFeatureEnablement]);

  /** 详情 → 表单利息字段（编辑态，按 detail 的 policyId/name/rate 字段直填）。 */
  function applyPolicy(
    d: NonNullable<typeof detail>,
    type: 'arranged' | 'unarranged',
  ) {
    if (type === 'arranged') {
      setValue('arrangedInterestPolicyId', d.arrangedInterestPolicyId);
      setValue('arrangedInterestRate', rateStr(d.arrangedInterestRate, d.arrangedCalculateType));
      setValue('arrangedInterestEffectiveDate', fmtDate(d.arrangedInterestEffectiveDate));
    } else {
      setValue('unarrangedInterestPolicyId', d.unarrangedInterestPolicyId);
      setValue('unarrangedInterestRate', rateStr(d.unarrangedInterestRate));
      setValue('unarrangedInterestEffectiveDate', fmtDate(d.unarrangedInterestEffectiveDate));
    }
  }

  /** 利息策略下拉选中 / 默认项 → 填 rate/date/saveDetails（源 initInterestPolicyInfo）。 */
  function applyInterestPolicy(
    item: InterestPolicy | undefined,
    type: 'arranged' | 'unarranged',
  ) {
    if (!item) return;
    const calc = item.calculateType;
    const first = item.annualInterestRates?.[0];
    const rate = first?.interestRate ?? '';
    if (type === 'arranged') {
      setValue('arrangedInterestPolicyId', item.interestRuleId);
      setValue('arrangedInterestRate', calc === 1 ? `${rate}%` : '');
      setValue('arrangedInterestEffectiveDate', fmtDate(item.effectiveDate));
    } else {
      setValue('unarrangedInterestPolicyId', item.interestRuleId);
      setValue('unarrangedInterestRate', calc === 1 ? `${rate}%` : '');
      setValue('unarrangedInterestEffectiveDate', fmtDate(item.effectiveDate));
    }
    if (calc === 2 && item.annualInterestRates?.length) {
      setValue(
        'saveDetails',
        item.annualInterestRates.map((el) => ({ ...el })),
      );
    }
  }

  // isTdCurrentAccount：禁用利息特性（源 useEffect）。
  React.useEffect(() => {
    if (isTdCurrentAccount) {
      setChecked(false);
      setValue('interestFeatureEnablement', false);
    }
  }, [isTdCurrentAccount, setValue]);

  // 新增态：accountTypeList 就绪 → 选首项（源 useEffect）。
  React.useEffect(() => {
    if (isEdit || !accountTypeList.length) return;
    const first = accountTypeList[0];
    setValue('accountType', first.accountType as number);
  }, [accountTypeList]);

  const addMutation = useAddWalletTypeMutation();
  const updateMutation = useUpdateWalletTypeMutation();
  const isPending = addMutation.isPending || updateMutation.isPending;

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingValues, setPendingValues] =
    React.useState<WalletTypeFormValues | null>(null);

  const normForSubmit = (v: unknown) => {
    const n = Number(v);
    return Number.isNaN(n) || n >= UNLIMITED_THRESHOLD ? -1 : n;
  };

  const buildPayload = (values: WalletTypeFormValues): WalletTypeSavePayload => {
    const {
      interestFeatureEnablement: ife,
      depositInterestKeyStorePassword: keystorePw,
      ...rest
    } = values;
    const payload: WalletTypeSavePayload = {
      tdId,
      ...(isEdit ? { ruleId } : {}),
      ...rest,
      singleTradingLimit: normForSubmit(values.singleTradingLimit),
      dailyTradingLimit: normForSubmit(values.dailyTradingLimit),
      balanceLimit: normForSubmit(values.balanceLimit),
      minimumBalance: normForSubmit(values.minimumBalance),
      dailyRedeemLimit: normForSubmit(values.dailyRedeemLimit),
    };
    if (isTd) {
      // 选中传 2，未选中传 1（源码语义）。
      (payload as Record<string, unknown>).interestFeatureEnablement = ife ? 2 : 1;
    }
    if (keystorePw) {
      (payload as Record<string, unknown>).depositInterestKeyStorePassword =
        getEncryptionData(keystorePw as string);
    }
    return payload;
  };

  const onValid = (values: WalletTypeFormValues) => {
    setPendingValues(values);
    setConfirmOpen(true);
  };

  const onConfirmSubmit = () => {
    if (!pendingValues) return;
    setConfirmOpen(false);
    const payload = buildPayload(pendingValues);
    const mutation = isEdit ? updateMutation : addMutation;
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(t('userWallet.modal.submitSuccess'));
        router.back();
      },
      onError: () => toast.error(t('common.failed')),
    });
  };

  const tf = (k: string) => t(`walletType.form.${k}`) as string;

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-4">
      <h4 className="text-lg font-semibold">
        {t('walletType.form.title', {
          type: isEdit ? t('common.edit') : t('common.new'),
        })}
      </h4>

      {/* ── 基本信息段 ── */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h4 className="border-0 border-b border-solid border-slate-200 pb-2">
          {tf('section.basic')}
        </h4>
        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          {tf('section.basicDesc')}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          {isTd ? (
            <div className="w-[45%] min-w-[200px] space-y-2">
              <Controller
                control={control}
                name="accountType"
                rules={{ required: true }}
                render={({ field }) => (
                  <>
                    <Label className="block text-sm font-medium">
                      {tf('label.accountType')}
                    </Label>
                    <Select
                      value={
                        field.value != null ? String(field.value) : undefined
                      }
                      onValueChange={(v) => {
                        const id = Number(v);
                        field.onChange(id);
                      }}
                      disabled={isEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={tf('label.accountType')} />
                      </SelectTrigger>
                      <SelectContent>
                        {accountTypeList.map((el) => {
                          const at = el.accountType as number;
                          return (
                            <SelectItem key={at} value={String(at)}>
                              {t(`accountType.${at}`)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </>
                )}
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={isTdCurrentAccount}
                  onCheckedChange={(v) => {
                    const next = v === true;
                    setChecked(next);
                    setValue('interestFeatureEnablement', next);
                  }}
                />
                <span>{tf('interestFeature')}</span>
              </label>
            </div>
          ) : null}
          <Controller
            control={control}
            name="tokenName"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">
                  {tf('label.tokenName')}
                </Label>
                <Input value={(field.value as string) ?? ''} disabled />
              </div>
            )}
          />
        </div>
      </section>

      {/* ── 限额段 ── */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h4 className="border-0 border-b border-solid border-slate-200 pb-2">
          {tf('section.limit')}
        </h4>
        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          {tf('section.limitDesc')}
        </p>
        <div className="flex flex-wrap justify-between gap-4">
          <Controller
            control={control}
            name="name"
            rules={{ required: t('walletType.form.validation.required', { field: tf('label.name') }) }}
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">{tf('label.name')}</Label>
                <Input
                  value={(field.value as string) ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  disabled={isEdit}
                  aria-invalid={!!errors.name}
                />
                {errors.name ? (
                  <p className="mt-1 text-sm text-destructive" role="alert">
                    {String(errors.name.message)}
                  </p>
                ) : null}
              </div>
            )}
          />
          <AmountField control={control} name="singleTradingLimit" label={tf('label.singleTradingLimit')} symbol={symbol} error={errors.singleTradingLimit as undefined} t={t} />
          <AmountField control={control} name="dailyTradingLimit" label={tf('label.dailyTradingLimit')} symbol={symbol} error={errors.dailyTradingLimit as undefined} t={t} />
          <AmountField control={control} name="balanceLimit" label={tf('label.balanceLimit')} symbol={symbol} error={errors.balanceLimit as undefined} t={t} />
          <AmountField control={control} name="minimumBalance" label={tf('label.minimumBalance')} symbol={symbol} error={errors.minimumBalance as undefined} t={t} />
          <AmountField control={control} name="dailyRedeemLimit" label={tf('label.dailyRedeemLimit')} symbol={symbol} error={errors.dailyRedeemLimit as undefined} t={t} />
        </div>
      </section>

      {/* ── 维护费段（仅 issueType===5）── */}
      {isTd ? (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h4 className="border-0 border-b border-solid border-slate-200 pb-2">
            {tf('section.fee')}
          </h4>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            {tf('section.feeDesc')}
          </p>
          <div className="flex flex-col gap-4">
            <Controller
              control={control}
              name="maintenanceFee"
              rules={{
                validate: (v) =>
                  /^[0-9]+(\.[0-9]{1,2})?$/.test(String(v ?? '')) ||
                  tf('validation.amount'),
              }}
              render={({ field }) => (
                <div className="w-[45%] min-w-[200px]">
                  <Label className="mb-1.5 block text-sm font-medium">{tf('label.maintenanceFee')}</Label>
                  <div className="flex items-stretch">
                    <Controller
                      control={control}
                      name="maintenanceFeeCycle"
                      render={({ field: cycleField }) => (
                        <Select
                          value={cycleField.value != null ? String(cycleField.value) : '1'}
                          onValueChange={(v) => cycleField.onChange(Number(v))}
                        >
                          <SelectTrigger className="w-[120px] rounded-r-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">{t('walletType.maintenanceFeeCycle.1')}</SelectItem>
                            <SelectItem value="5">{t('walletType.maintenanceFeeCycle.5')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Input
                      type="number"
                      value={field.value === undefined ? '' : String(field.value)}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      className="rounded-none"
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
            <Controller
              control={control}
              name="monthlyMinimumBalanceFee"
              rules={{
                validate: (v) =>
                  /^[0-9]+(\.[0-9]{1,2})?$/.test(String(v ?? '')) ||
                  tf('validation.amount'),
              }}
              render={({ field }) => (
                <div className="w-[45%] min-w-[200px]">
                  <Label className="mb-1.5 block text-sm font-medium">{tf('label.monthlyMinimumBalanceFee')}</Label>
                  <div className="flex items-stretch">
                    <Input
                      type="number"
                      value={field.value === undefined ? '' : String(field.value)}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      className="rounded-r-none"
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
            <AddressField
              control={control}
              name="accountFeesWalletAddress"
              label={tf('label.accountFeesWalletAddress')}
              error={undefined}
              t={t}
              locked={isEdit && Boolean(detail?.accountFeesWalletAddress)}
            />
          </div>
        </section>
      ) : null}

      {/* ── 利息 / 透支段 ── */}
      {showInterestSection ? (
        <InterestOverdraftSection
          control={control}
          accountType={accountType}
          interestPolicy={interestPolicy}
          isEdit={isEdit}
          detailLockedAddress={detail ?? {}}
          onPolicyChange={applyInterestPolicy}
        />
      ) : null}

      {/* ── 底部操作 ── */}
      <div className="mt-10 flex justify-end gap-8">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t('common.back')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {t('common.submit')}
        </Button>
      </div>

      {/* ── 提交确认 ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.confirm')}</DialogTitle>
            <DialogDescription>{tf('confirmContent')}</DialogDescription>
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
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 子组件：利息 / 透支段（accountType 矩阵分支）
// ═══════════════════════════════════════════════════════════════════

function InterestOverdraftSection({
  control,
  accountType,
  interestPolicy,
  isEdit,
  detailLockedAddress,
  onPolicyChange,
}: {
  control: import('react-hook-form').Control<WalletTypeFormValues>;
  accountType?: number;
  interestPolicy: InterestPolicy[];
  isEdit: boolean;
  detailLockedAddress: Record<string, unknown>;
  onPolicyChange: (
    item: InterestPolicy | undefined,
    type: 'arranged' | 'unarranged',
  ) => void;
}): React.JSX.Element {
  const t = useTranslations('modules.wallet');
  const tf = (k: string) => t(`walletType.form.${k}`) as string;
  const policyOptions = interestPolicy.map((el) => ({
    label: el.interestPolicyName ?? '',
    value: String(el.interestRuleId ?? ''),
    item: el,
  }));

  const locked = (key: string) =>
    isEdit && Boolean(detailLockedAddress[key]);

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <h4 className="border-0 border-b border-solid border-slate-200 pb-2">
        {tf('section.interest')}
      </h4>
      <p className="mb-4 mt-2 text-sm text-muted-foreground">
        {tf('section.interestDesc')}
      </p>

      {accountType === 2 ? (
        // 储蓄：利息策略 + 阶梯/固定利率 + 生效日期 + 地址
        <div className="flex flex-col gap-4">
          <Controller
            control={control}
            name="arrangedInterestPolicyId"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="w-[45%] min-w-[200px]">
                <Label className="mb-1.5 block text-sm font-medium">{tf('label.arrangedInterestPolicy')}</Label>
                <Select
                  value={field.value != null ? String(field.value) : undefined}
                  onValueChange={(v) => {
                    const item = interestPolicy.find(
                      (el) => String(el.interestRuleId) === v,
                    );
                    field.onChange(item?.interestRuleId);
                    onPolicyChange(item, 'arranged');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tf('label.arrangedInterestPolicy')} />
                  </SelectTrigger>
                  <SelectContent>
                    {policyOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <ReadOnlyField control={control} name="arrangedInterestRate" label={tf('label.arrangedInterestRate')} />
          <ReadOnlyField control={control} name="arrangedInterestEffectiveDate" label={tf('label.arrangedInterestEffectiveDate')} />
          <AddressField
            control={control}
            name="depositInterestWalletAddress"
            label={tf('label.depositInterestWalletAddress')}
            error={undefined}
            t={t}
            locked={locked('depositInterestWalletAddress')}
          />
          {!isEdit ? (
            <>
              <Controller
                control={control}
                name="depositInterestKeyStore"
                rules={{ required: true }}
                render={({ field }) => (
                  <div className="w-[45%] min-w-[200px]">
                    <Label className="mb-1.5 block text-sm font-medium">{tf('label.depositInterestKeyStore')}</Label>
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
                rules={{ required: true }}
                render={({ field }) => (
                  <div className="w-[45%] min-w-[200px]">
                    <Label className="mb-1.5 block text-sm font-medium">{tf('label.depositInterestKeyStorePassword')}</Label>
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
          <AddressField
            control={control}
            name="accountClosureInterestWalletAddress"
            label={tf('label.accountClosureInterestWalletAddress')}
            error={undefined}
            t={t}
            locked={locked('accountClosureInterestWalletAddress')}
          />
        </div>
      ) : (
        // 活期透支：约定/非约定透支额度 + 费用 + 利息策略 + 收款地址
        <div className="flex flex-wrap justify-between gap-4">
          <AmountField control={control} name="arrangedOverdraftAmount" label={tf('label.arrangedOverdraftAmount')} symbol={tf('dayUnit')} error={undefined} t={t} />
          <AmountField control={control} name="overdraftBufferAmount" label={tf('label.overdraftBufferAmount')} symbol={tf('dayUnit')} error={undefined} t={t} />
          <Controller
            control={control}
            name="overdraftBufferPeriod"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="w-[30%] min-w-[180px]">
                <Label className="mb-1.5 block text-sm font-medium">{tf('label.overdraftBufferPeriod')}</Label>
                <div className="flex items-stretch">
                  <Input
                    type="number"
                    value={field.value === undefined ? '' : String(field.value)}
                    onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    className="rounded-r-none"
                  />
                  <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    {tf('dayUnit')}
                  </span>
                </div>
              </div>
            )}
          />
          <Controller
            control={control}
            name="arrangedInterestPolicyId"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="w-[30%] min-w-[180px]">
                <Label className="mb-1.5 block text-sm font-medium">{tf('label.arrangedInterestPolicy')}</Label>
                <Select
                  value={field.value != null ? String(field.value) : undefined}
                  onValueChange={(v) => {
                    const item = interestPolicy.find((el) => String(el.interestRuleId) === v);
                    field.onChange(item?.interestRuleId);
                    onPolicyChange(item, 'arranged');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tf('label.arrangedInterestPolicy')} />
                  </SelectTrigger>
                  <SelectContent>
                    {policyOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <ReadOnlyField control={control} name="arrangedInterestRate" label={tf('label.arrangedInterestRate')} />
          <ReadOnlyField control={control} name="arrangedInterestEffectiveDate" label={tf('label.arrangedInterestEffectiveDate')} />
          <AmountField control={control} name="unarrangedOverdraftAmount" label={tf('label.unarrangedOverdraftAmount')} symbol={tf('dayUnit')} error={undefined} t={t} />
          <AmountField control={control} name="unarrangedOverdraftFee" label={tf('label.unarrangedOverdraftFee')} symbol={tf('dayUnit')} error={undefined} t={t} />
          <AmountField control={control} name="unarrangedOverdraftFeeMax" label={tf('label.unarrangedOverdraftFeeMax')} symbol={tf('dayUnit')} error={undefined} t={t} />
          <Controller
            control={control}
            name="unarrangedInterestPolicyId"
            rules={{ required: true }}
            render={({ field }) => (
              <div className="w-[30%] min-w-[180px]">
                <Label className="mb-1.5 block text-sm font-medium">{tf('label.unarrangedInterestPolicy')}</Label>
                <Select
                  value={field.value != null ? String(field.value) : undefined}
                  onValueChange={(v) => {
                    const item = interestPolicy.find((el) => String(el.interestRuleId) === v);
                    field.onChange(item?.interestRuleId);
                    onPolicyChange(item, 'unarranged');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tf('label.unarrangedInterestPolicy')} />
                  </SelectTrigger>
                  <SelectContent>
                    {policyOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <ReadOnlyField control={control} name="unarrangedInterestRate" label={tf('label.unarrangedInterestRate')} />
          <ReadOnlyField control={control} name="unarrangedInterestEffectiveDate" label={tf('label.unarrangedInterestEffectiveDate')} />
          <AddressField control={control} name="receivingOverdraftFeeWalletAddress" label={tf('label.receivingOverdraftFeeWalletAddress')} error={undefined} t={t} locked={locked('receivingOverdraftFeeWalletAddress')} />
          <AddressField control={control} name="receivingOverdraftInterestWalletAddress" label={tf('label.receivingOverdraftInterestWalletAddress')} error={undefined} t={t} locked={locked('receivingOverdraftInterestWalletAddress')} />
        </div>
      )}
    </section>
  );
}

// ── helpers ──

function numOrEmpty(v?: number | string | null): number | string {
  if (v === undefined || v === null || v === '') return '';
  const n = Number(v);
  return n === 0 ? '' : n;
}

function rateStr(v?: number | string, calc?: number): string {
  if (v === undefined || v === null || v === '') return '';
  return calc === 1 ? `${v}%` : '';
}

function fmtDate(v?: number | string | null): string {
  if (v === undefined || v === null || v === '') return '';
  const ms = Number(v) >= 1e12 ? Number(v) : Number(v) * 1000;
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toISOString().slice(0, 10);
}
