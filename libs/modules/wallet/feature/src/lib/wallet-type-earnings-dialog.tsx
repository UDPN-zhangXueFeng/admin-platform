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
import { FormDatePicker } from '@myorg/shared/ui-forms';
import {
  earningsCalculate,
  getWalletBalanceCalculate,
  useEarningsSendMutation,
} from '@myorg/modules/wallet/data-access';
import { EMPTY_DISPLAY } from '@myorg/modules/wallet/util';

/**
 * WalletTypeEarningsDialog — MMF 钱包类型「收益派发」三段流弹窗。
 *
 * 迁移自 td-manage `src/pages/wallet/wallet-type/index.tsx` 的 CustomModal + CustomForms
 * 收益派发表单（业务热点 #1 后半）。
 *
 * 三段流（命令式触发，非 useQuery——calc 结果回填表单字段而非进缓存）：
 * 1. 选/改日期 → `getWalletBalanceCalculate({ruleId, earningsDate})` → 回填 totalUnits
 *    （余额）+ dailyStatisticalTime（统计时间）。
 * 2. 输入 totalEarnings → `earningsCalculate({ruleId, earningsDate, totalEarnings})`
 *    → 回填 earningsPerUnit（每单位收益）。
 * 3. 提交 → `useEarningsSendMutation`（EarningsSendPayload：ruleId/totalEarnings/
 *    earningsDate）→ 成功 toast + 关闭 + 失效缓存（mutation onSuccess 已 invalidate
 *    wallet.all，卡片/表自动刷新）。
 *
 * calc 失败不崩：balance calc 失败保留旧 totalUnits、弹 toast；earnings calc 失败
 * 清空 earningsPerUnit、弹 toast（忠实源 `res.data.code !== 0 return` 的静默降级 +
 * 显式错误提示）。
 *
 * 入口（卡片「收益派发」链接）打开弹窗时，父组件已用「今天」触发首次 balance calc；
 * 此组件在 `open` 由 false→true 时再次确保 totalUnits 已就绪（防御首开竞态）。
 */
export interface WalletTypeEarningsTarget {
  /** 目标钱包类型 ruleId。 */
  ruleId: number;
  /** 份额单位后缀（源 item.tdSymbol，totalUnits 的 addonAfter）。 */
  symbol: string;
  /** 收益币种后缀（源 item.currencySymbol，totalEarnings 的 addonAfter）。 */
  currentSymbol: string;
}

export interface WalletTypeEarningsDialogProps {
  /** 弹窗打开/关闭（受控）。 */
  open: boolean;
  /** 目标钱包类型。null 表示关闭态（与 open=false 等价，额外防御 ruleId 缺失）。 */
  target: WalletTypeEarningsTarget | null;
  /** 关闭回调。 */
  onClose: () => void;
}

/** 表单值：earningsDate 为 `YYYY-MM-DD` 字符串；totalEarnings 为字符串数字。 */
interface EarningsFormValues {
  earningsDate: string;
  totalEarnings: string;
}

const TODAY = (): string => new Date().toISOString().slice(0, 10);

export function WalletTypeEarningsDialog({
  open,
  target,
  onClose,
}: WalletTypeEarningsDialogProps): React.JSX.Element | null {
  const t = useTranslations('modules.wallet');
  const sendMutation = useEarningsSendMutation();

  const { control, register, handleSubmit, reset, watch, setValue } =
    useForm<EarningsFormValues>({
      defaultValues: { earningsDate: TODAY(), totalEarnings: '' },
    });

  // 命令式 calc 结果（不入 react-query 缓存，回填到本地 state + 表单字段）。
  const [totalUnits, setTotalUnits] = React.useState<string | number>('');
  const [dailyStatisticalTime, setDailyStatisticalTime] = React.useState('');
  const [earningsPerUnit, setEarningsPerUnit] = React.useState<
    string | number
  >('');
  const [balanceLoading, setBalanceLoading] = React.useState(false);
  const [earningsLoading, setEarningsLoading] = React.useState(false);

  const ruleId = target?.ruleId;
  const watchedDate = watch('earningsDate');
  const watchedEarnings = watch('totalEarnings');

  // 第一段：余额计算。日期或 ruleId 变化时触发（命令式 await）。
  const runBalanceCalc = React.useCallback(
    async (date: string, rid: number) => {
      if (!date || !rid) return;
      setBalanceLoading(true);
      try {
        const res = await getWalletBalanceCalculate({
          ruleId: rid,
          earningsDate: date,
        });
        setDailyStatisticalTime(String(res?.dailyStatisticalTime ?? ''));
        setTotalUnits(res?.totalUnits ?? '');
        setValue('totalEarnings', '', { shouldValidate: false });
        setEarningsPerUnit('');
      } catch {
        // calc 失败不崩：保留旧值 + toast 提示（忠实源静默 return 的语义增强）。
        toast.error(t('walletType.earnings.balanceCalcFailed'));
      } finally {
        setBalanceLoading(false);
      }
    },
    [setValue, t]
  );

  // 弹窗打开（或切换目标）时：重置表单 + 用「今天」触发首次余额计算（对齐源入口逻辑）。
  React.useEffect(() => {
    if (open && ruleId) {
      reset({ earningsDate: TODAY(), totalEarnings: '' });
      setEarningsPerUnit('');
      void runBalanceCalc(TODAY(), ruleId);
    }
  }, [open, ruleId, reset, runBalanceCalc]);

  // 弹窗内改日期 → 再次余额计算（源 DatePicker onChange → getWalletBalanceCalculate）。
  React.useEffect(() => {
    if (open && ruleId && watchedDate) {
      void runBalanceCalc(watchedDate, ruleId);
    }
  }, [watchedDate, open, ruleId, runBalanceCalc]);

  // 第二段：收益计算。totalEarnings 变化时触发（源 InputNumber onChange → earningsCalculate）。
  React.useEffect(() => {
    if (!open || !ruleId || !watchedDate) return;
    const raw = String(watchedEarnings ?? '').trim();
    if (!raw || !Number.isFinite(Number(raw))) {
      setEarningsPerUnit('');
      return;
    }
    let cancelled = false;
    setEarningsLoading(true);
    earningsCalculate({
      ruleId,
      earningsDate: watchedDate,
      totalEarnings: raw,
    })
      .then((res) => {
        if (cancelled) return;
        setEarningsPerUnit(res?.earningsPerUnit ?? '');
      })
      .catch(() => {
        if (cancelled) return;
        setEarningsPerUnit('');
        toast.error(t('walletType.earnings.earningsCalcFailed'));
      })
      .finally(() => {
        if (!cancelled) setEarningsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [watchedEarnings, watchedDate, open, ruleId, t]);

  // 第三段：提交派发（源 earningsSendApi onFinish）。
  const onSubmit = React.useCallback(
    (values: EarningsFormValues) => {
      if (!ruleId) return;
      sendMutation.mutate(
        {
          ruleId,
          totalEarnings: values.totalEarnings,
          earningsDate: values.earningsDate,
        },
        {
          onSuccess: () => {
            toast.success(t('walletType.earnings.submitSuccess'));
            reset({ earningsDate: TODAY(), totalEarnings: '' });
            setEarningsPerUnit('');
            onClose();
          },
          onError: () => {
            // mutation 抛错由全局拦截器处理；此处不额外 toast，避免重复。
          },
        }
      );
    },
    [ruleId, sendMutation, reset, onClose, t]
  );

  const handleClose = React.useCallback(() => {
    if (sendMutation.isPending) return;
    reset({ earningsDate: TODAY(), totalEarnings: '' });
    setEarningsPerUnit('');
    onClose();
  }, [sendMutation.isPending, reset, onClose]);

  if (!open || !target) return null;

  const unitSuffix = target.symbol || EMPTY_DISPLAY;
  const earningsSuffix = target.currentSymbol || EMPTY_DISPLAY;
  const submitting = sendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
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
          />
          {/* totalUnits：余额（只读回填，带单位后缀 + 统计时间提示） */}
          <div className="space-y-1.5">
            <Label htmlFor="wt-total-units">
              {t('walletType.earnings.totalUnits')}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="wt-total-units"
                value={totalUnits === '' ? '' : String(totalUnits)}
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
                {...register('totalEarnings', {
                  validate: (v) => {
                    const n = Number(v);
                    return Number.isFinite(n) && n > 0;
                  },
                })}
              />
              <span className="shrink-0 text-sm text-muted-foreground">
                {earningsSuffix}
              </span>
            </div>
            {/* 计算结果提示框（源 extra 信息块，含公式回显） */}
            <div className="space-y-1 rounded-md bg-indigo-50 p-2 text-xs text-indigo-700">
              <div className="font-medium">
                {t('walletType.earnings.calcTipTitle')}
              </div>
              <div className="text-indigo-600">
                {t('walletType.earnings.calcTipHint')}
              </div>
              {watchedEarnings && Number(watchedEarnings) > 0 ? (
                <div className="mt-1 flex flex-col gap-0.5">
                  <span>{t('walletType.earnings.formulaLabel')}</span>
                  <span>
                    {`=  ${watchedEarnings} ${earningsSuffix} / ${totalUnits || 0}`}
                  </span>
                  <span>
                    {`= ${earningsLoading ? '...' : earningsPerUnit || '--'} ${earningsSuffix}`}
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
            <Button type="submit" disabled={submitting || balanceLoading}>
              {t('common.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
