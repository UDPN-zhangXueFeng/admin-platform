'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import { FormDatePicker } from '@myorg/shared/ui-forms';
import {
  earningsCalculate,
  getWalletBalanceCalculate,
  useEarningsSendMutation,
  type BalanceCalcResult,
} from '@myorg/modules/td-admin/data-access';
import { EMPTY_DISPLAY } from '.';

/** Earnings use the initial balance from the card action, then recalculate per date. */
export interface WalletTypeEarningsTarget {
  /** 目标钱包类型 ruleId。 */
  ruleId: number;
  /** 份额单位后缀（源 item.tdSymbol，totalUnits 的 addonAfter）。 */
  symbol: string;
  /** 收益币种后缀（源 item.currencySymbol，totalEarnings 的 addonAfter）。 */
  currentSymbol: string;
}

interface WalletTypeEarningsDialogProps {
  target: WalletTypeEarningsTarget;
  initialDate: string;
  initialBalance: BalanceCalcResult;
  onClose: () => void;
}

/** 表单值：earningsDate 为 `YYYY-MM-DD` 字符串；totalEarnings 为字符串数字。 */
interface EarningsFormValues {
  earningsDate: string;
  totalEarnings: string;
}

export const earningsToday = () => formatDate(new Date(), 'yyyy-MM-dd');

export function WalletTypeEarningsDialog({
  target,
  initialDate,
  initialBalance,
  onClose,
}: WalletTypeEarningsDialogProps): React.JSX.Element | null {
  const t = useTranslations('modules.wallet');
  const sendMutation = useEarningsSendMutation();

  const { control, register, handleSubmit, watch, setValue, setError, formState: { errors } } =
    useForm<EarningsFormValues>({ defaultValues: { earningsDate: initialDate, totalEarnings: '' } });
  const [balance, setBalance] = React.useState({ date: initialDate, data: initialBalance });
  const [balanceLoading, setBalanceLoading] = React.useState(false);
  const [earningsResult, setEarningsResult] = React.useState<{ date: string; amount: string; value: string | number }>();
  const [earningsLoading, setEarningsLoading] = React.useState(false);
  const submitLock = React.useRef(false);
  const ruleId = target.ruleId;
  const watchedDate = watch('earningsDate');
  const watchedEarnings = watch('totalEarnings');
  const balanceMatchesDate = balance.date === watchedDate;
  const totalUnits = balanceMatchesDate ? balance.data.totalUnits : undefined;
  const dailyStatisticalTime = balanceMatchesDate ? balance.data.dailyStatisticalTime : undefined;
  const validEarnings = (value: string) => value.trim() !== '' && Number.isFinite(Number(value));

  React.useEffect(() => {
    if (balanceMatchesDate || !watchedDate) return;
    let active = true;
    setValue('totalEarnings', '');
    setBalanceLoading(true);
    getWalletBalanceCalculate({ ruleId, earningsDate: watchedDate }).then((data) => {
      if (!active) return;
      if (data?.totalUnits == null) throw new Error('Missing calculated wallet balance');
      setBalance({ date: watchedDate, data });
      setBalanceLoading(false);
    }).catch(() => {
      if (!active) return;
      setBalanceLoading(false);
      toast.error(t('walletType.earnings.balanceCalcFailed'));
    });
    return () => { active = false; };
  }, [balanceMatchesDate, watchedDate, ruleId, setValue, t]);

  // 第二段：收益计算。totalEarnings 变化时触发（源 InputNumber onChange → earningsCalculate）。
  React.useEffect(() => {
    if (!balanceMatchesDate || !validEarnings(watchedEarnings)) {
      setEarningsLoading(false);
      setEarningsResult(undefined);
      return;
    }
    const raw = watchedEarnings.trim();
    let cancelled = false;
    setEarningsLoading(true);
    earningsCalculate({
      ruleId,
      earningsDate: watchedDate,
      totalEarnings: raw,
    })
      .then((res) => {
        if (cancelled) return;
        if (res?.earningsPerUnit == null) throw new Error('Missing calculated earnings per unit');
        setEarningsResult({ date: watchedDate, amount: raw, value: res.earningsPerUnit });
      })
      .catch(() => {
        if (cancelled) return;
        setEarningsResult(undefined);
        toast.error(t('walletType.earnings.earningsCalcFailed'));
      })
      .finally(() => {
        if (!cancelled) setEarningsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [watchedEarnings, watchedDate, balanceMatchesDate, ruleId, t]);

  const earningsPerUnit = earningsResult?.date === watchedDate && earningsResult.amount === watchedEarnings.trim()
    ? earningsResult.value : undefined;
  const onSubmit = (values: EarningsFormValues) => {
    if (!values.earningsDate) {
      setError('earningsDate', { message: t('walletType.form.validation.required', { field: t('walletType.earnings.earningsDate') }) });
      return;
    }
    if (!balanceMatchesDate || earningsPerUnit == null || earningsLoading || submitLock.current) return;
    submitLock.current = true;
    sendMutation.mutate({ ruleId, totalEarnings: values.totalEarnings, earningsDate: values.earningsDate }, {
      onSuccess: () => { toast.success(t('walletType.earnings.submitSuccess')); onClose(); },
      onSettled: () => { submitLock.current = false; },
    });
  };
  const handleClose = () => { if (!submitLock.current) onClose(); };

  const unitSuffix = target.symbol || EMPTY_DISPLAY;
  const earningsSuffix = target.currentSymbol || EMPTY_DISPLAY;
  const submitting = sendMutation.isPending;

  return (
    <Dialog open onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('walletType.earnings.modalTitle')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          {/* 第一段：收益日期（选/改触发余额计算） */}
          <FormDatePicker
            name="earningsDate"
            control={control}
            label={t('walletType.earnings.earningsDate')}
            required
            error={errors.earningsDate?.message}
            disabled={submitting}
          />
          {/* totalUnits：余额（只读回填，带单位后缀 + 统计时间提示） */}
          <div className="space-y-1.5">
            <Label htmlFor="wt-total-units">
              {t('walletType.earnings.totalUnits')}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="wt-total-units"
                value={totalUnits == null ? '' : String(totalUnits)}
                readOnly
                disabled={balanceLoading}
                aria-readonly
              />
              <span className="shrink-0 text-sm text-muted-foreground">
                {unitSuffix}
              </span>
            </div>
            {dailyStatisticalTime ? (
              <p className="text-xs text-muted-foreground">
                {t('walletType.earnings.dailyStatisticalTime')}{' '}
                {dailyStatisticalTime}
              </p>
            ) : null}
          </div>
          {/* 第二段：总收益（输入触发每单位收益计算） */}
          <div className="space-y-1.5">
            <Label htmlFor="wt-total-earnings">
              {t('walletType.earnings.totalEarnings')}
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="wt-total-earnings"
                type="number"
                inputMode="decimal"
                step="any"
                autoComplete="off"
                disabled={submitting || !balanceMatchesDate}
                aria-invalid={!!errors.totalEarnings}
                {...register('totalEarnings', {
                  validate: (value) => validEarnings(value) || t('walletType.form.validation.required', { field: t('walletType.earnings.totalEarnings') }),
                })}
              />
              <span className="shrink-0 text-sm text-muted-foreground">
                {earningsSuffix}
              </span>
            </div>
            {errors.totalEarnings?.message && <p role="alert" className="text-sm text-destructive">{errors.totalEarnings.message}</p>}
            {/* 计算结果提示框（源 extra 信息块，含公式回显） */}
            <div className="space-y-1 rounded-md bg-indigo-50 p-2 text-xs text-indigo-700">
              <div className="font-medium">
                {t('walletType.earnings.calcTipTitle')}
              </div>
              <div className="text-indigo-600">
                {t('walletType.earnings.calcTipHint')}
              </div>
              {validEarnings(watchedEarnings) ? (
                <div className="mt-1 flex flex-col gap-0.5">
                  <span>{t('walletType.earnings.formulaLabel')}</span>
                  <span>
                    {`= ${watchedEarnings} ${earningsSuffix} / ${totalUnits ?? EMPTY_DISPLAY}`}
                  </span>
                  <span>
                    {`= ${earningsLoading ? '...' : earningsPerUnit ?? EMPTY_DISPLAY} ${earningsSuffix}`}
                  </span>
                </div>
              ) : (
                <span className="text-indigo-600">
                  {t('walletType.earnings.formulaEmpty')}
                </span>
              )}
            </div>
          </div>
          <DialogFooter className="flex-row justify-center gap-4 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || balanceLoading || earningsLoading || (validEarnings(watchedEarnings) && earningsPerUnit == null)}>
              {t('common.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
