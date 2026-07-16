/**
 * MintMeltModal — Mint/Melt 铸销 Modal。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx：
 * - `getReservBalance`（源 1698-1742）：拉储备/可销毁余额组装 modalInfo。
 * - `form2` + `onFinish`（源 1650-1668）：stablecoinCode/tokenType disabled 展示 + amount 输入。
 * - CustomModal + CustomForms（源 2039-2131）。
 *
 * ## Mint(type=1) / Melt(type=2)
 *
 * - Mint：availableBalance（可用余额）做上限校验，tips 文案 tokenized_deposit_0073。
 * - Melt：surplusCount（可销毁余额）做上限校验，tips 文案 tokenized_deposit_0074。
 * modalInfo 由调用方（OverviewShell）在打开 Modal 前拉 useReserveBalanceQuery 组装，
 * 本组件只负责展示 + 校验 + 提交。
 *
 * ## amount 校验（对齐源 2105-2125）
 *
 * 1. >0（PUB_Pleased + stablecoin_manage_004 占位）。
 * 2. ≤6 位小数（正则 /^[0-9]+(.[0-9]{1,6})?$/ → tokenized_deposit_0030）。
 * 3. ≤modalInfo.availableBalance（tokenized_deposit_0043）。
 *
 * ## 提交
 *
 * useSubmitMintMeltMutation({ amount, stablecoinCode, type })。
 * 成功关 Modal（onCancel）+ mutation 内部 invalidate overview（含 TD 记录/储备余额）。
 *
 * ## 与源差异
 *
 * - antd CustomModal + CustomForms + form2 → shared/ui Dialog + react-hook-form。
 * - antd InputNumber → 原生 Input type="number"（react-hook-form 受控，validator 同源）。
 * - stablecoinCode/tokenType 源用 getUsablePrice.symbol + t(`token_type_${mintMethod}`)，
 *   这里由 props.stablecoinCodeLabel + props.tokenTypeLabel 透传（Shell 已有 i18n 文案）。
 * - modalInfo.tips 的 `****` 占位：源用 .replace，迁移用 next-intl ICU {amount}。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
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
} from '@myorg/shared/ui';
import { useSubmitMintMeltMutation } from '@myorg/modules/tokenized-deposit/data-access';

/** modalInfo（调用方 getReservBalance 组装后透传）。 */
export interface MintMeltModalInfo {
  /** Modal 标题（Mint/Melt 按钮文案）。 */
  title: string;
  /** 校验上限（Mint=availableBalance / Melt=surplusCount）。 */
  availableBalance: number;
  /** 储备余额文案（tokenized_deposit_0072: 值 币种）。 */
  reserveBalance: string;
  /** tips 文案模板插值后的最终文案（tokenized_deposit_0073/0074）。 */
  tips: string;
}

/** Mint=1 / Melt=2（源 modalInfo.key === 'Mint' ? 1 : 2）。 */
export type MintMeltType = 1 | 2;

export interface MintMeltModalProps {
  /** Modal 开关。 */
  open: boolean;
  /** 调用方组装好的 modalInfo（含 tips/availableBalance）。 */
  modalInfo: MintMeltModalInfo;
  /** 1=Mint / 2=Melt。 */
  type: MintMeltType;
  /** stablecoinCode（提交 body + disabled 展示符号）。 */
  stablecoinCode: string;
  /** stablecoinCode 展示文案（源 form2.stablecoinCode = getUsablePrice.symbol）。 */
  stablecoinCodeLabel: string;
  /** tokenType 展示文案（源 t(`token_type_${mintMethod}`)）。 */
  tokenTypeLabel: string;
  /** 取消回调（Shell: setIsModalOpen(false)）。 */
  onCancel: () => void;
}

/** amount 表单值。 */
interface MintMeltFormValues {
  amount: string;
}

/** 6 位小数正则（对齐源 /^[0-9]+(.[0-9]{1,6})?$/）。 */
const AMOUNT_DECIMAL_PATTERN = /^[0-9]+(\.[0-9]{1,6})?$/;

/**
 * Mint/Melt Modal。
 *
 * 用法：
 * ```tsx
 * <MintMeltModal
 *   open={isModalOpen}
 *   modalInfo={modalInfo}
 *   type={mintOrMelt === 'Mint' ? 1 : 2}
 *   stablecoinCode={td?.code ?? ''}
 *   stablecoinCodeLabel={td?.symbol ?? ''}
 *   tokenTypeLabel={t(`token_type_${td?.mintMethod}`)}
 *   onCancel={() => setIsModalOpen(false)}
 * />
 * ```
 */
export function MintMeltModal({
  open,
  modalInfo,
  type,
  stablecoinCode,
  stablecoinCodeLabel,
  tokenTypeLabel,
  onCancel,
}: MintMeltModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const { mutateAsync, isPending } = useSubmitMintMeltMutation();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<MintMeltFormValues>({
    defaultValues: { amount: '' },
  });

  // 打开时重置 amount（对齐源 destroyOnClose + form2.resetFields）。
  React.useEffect(() => {
    if (open) {
      reset({ amount: '' });
      clearErrors('amount');
    }
  }, [open, reset, clearErrors]);

  // amount validator（对齐源 2105-2125）。
  const validateAmount = React.useCallback(
    (value: string): string | null => {
      const num = Number(value);
      if (!value || num <= 0) {
        // 源 t('PUB_Pleased').replace('****', t('stablecoin_manage_004'))。
        return t('PUB_Pleased').replace('****', t('stablecoin_manage_004'));
      }
      if (!AMOUNT_DECIMAL_PATTERN.test(value)) {
        return t('tokenized_deposit_0030');
      }
      if (num > modalInfo.availableBalance) {
        return t('tokenized_deposit_0043');
      }
      return null;
    },
    [t, modalInfo.availableBalance],
  );

  const onValid = async (values: MintMeltFormValues) => {
    const error = validateAmount(values.amount);
    if (error) {
      setError('amount', { message: error });
      return;
    }
    try {
      await mutateAsync({
        amount: values.amount,
        stablecoinCode,
        type,
      });
      // 源 t('PUB_Success').replace('****', t('PUB_Submit'))。
      toast.success(t('PUB_Success').replace('****', t('PUB_Submit')));
      onCancel();
    } catch {
      // mutation 错误由 apiClient 拦截器统一 toast，这里静默。
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{modalInfo.title}</DialogTitle>
          <DialogDescription className="sr-only">
            {modalInfo.title}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} noValidate>
          {/* stablecoinCode（disabled 展示，extra=储备余额文案） */}
          <div className="mb-4">
            <Label className="mb-1.5 block text-sm font-medium">
              {t('tokenized_deposit_0026')}
            </Label>
            <Input value={stablecoinCodeLabel} disabled readOnly />
            <p className="mt-1 text-xs text-muted-foreground">
              {modalInfo.reserveBalance}
            </p>
          </div>

          {/* tokenType（disabled 展示） */}
          <div className="mb-4">
            <Label className="mb-1.5 block text-sm font-medium">
              {t('tokenized_deposit_0062')}
            </Label>
            <Input value={tokenTypeLabel} disabled readOnly />
          </div>

          {/* amount（核心输入，validator） */}
          <div className="mb-4">
            <Label className="mb-1.5 block text-sm font-medium">
              {t('tokenized_deposit_0029')}
            </Label>
            <Input
              type="number"
              step="0.000001"
              min={0}
              aria-invalid={!!errors.amount}
              {...register('amount')}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {modalInfo.tips}
            </p>
            {errors.amount ? (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {errors.amount.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="flex-row justify-center gap-4 sm:justify-center">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('PUB_Cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t('PUB_Submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
