/**
 * Mint / Melt Modal（铸造/销毁弹窗）及其常量、类型。
 * 源: tokenized-deposit-view-page.tsx 60-64, 74-98, 519-688
 */
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@myorg/shared/ui';
import {
  useIssueStablecoinMutation,
  useRemoveStablecoinMutation,
} from '@myorg/modules/td-admin/data-access';


/** Mint 数量上限（对齐源 InputNumber max 999999999999）。 */
const MINT_MAX = 999999999999;

/** 金额校验正则：整数或最多 6 位小数（对齐源 /^[0-9]+(.[0-9]{1,6})?$/）。 */
const DECIMAL_6_RE = /^[0-9]+(\.[0-9]{1,6})?$/;

/**
 * Mint / Melt 操作类型（modalInfo.key，源用 Issuance / Destruction 区分分支）。
 *
 * - `Issuance` → 调 useIssueStablecoinMutation（铸造）。
 * - `Destruction` → 调 useRemoveStablecoinMutation（销毁）。
 */
export type MintMeltMode = 'Issuance' | 'Destruction';

/** 稳定币列表项（useStablecoinListQuery 返回 unknown[]，按业务断言取 [0]）。 */
export interface StablecoinListItem {
  stablecoinId?: number | string;
  name?: string;
  symbol?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────
// Mint / Melt Modal 表单值
// ─────────────────────────────────────────────────────────────────────

interface MintMeltFormValues {
  /** 数量（源 stablecoinCount，InputNumber）。 */
  stablecoinCount: string;
}

// ═════════════════════════════════════════════════════════════════════
// Mint / Melt Modal
// ═════════════════════════════════════════════════════════════════════

interface MintMeltModalProps {
  open: boolean;
  mode: MintMeltMode;
  coinName: string;
  surplusCount: number | undefined;
  stablecoin: StablecoinListItem | undefined;
  onCancel: () => void;
  onSuccess: () => void;
}

/**
 * Mint / Melt Modal（源 isMintModalOpen + CustomForms）。
 *
 * - mode==='Issuance' → 标题 Router_018、subTitle manage_013、tips manage_014、
 *   useIssueStablecoinMutation（body stablecoinCount/stablecoinId/stablecoinName/unit）。
 * - mode==='Destruction' → 标题 Router_019、subTitle manage_015、tips manage_016
 *   （**** → surplusCount）、useRemoveStablecoinMutation（body stablecoinCount/stablecoinId）。
 *
 * 金额校验（对齐源 validator）：>0、≤6 位小数；Mint ≤ MINT_MAX，Melt ≤ surplusCount。
 */
export function MintMeltModal({
  open,
  mode,
  coinName,
  surplusCount,
  stablecoin,
  onCancel,
  onSuccess,
}: MintMeltModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const issueMutation = useIssueStablecoinMutation();
  const removeMutation = useRemoveStablecoinMutation();
  const isMint = mode === 'Issuance';
  const isSubmitting = issueMutation.isPending || removeMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MintMeltFormValues>({
    defaultValues: { stablecoinCount: '' },
  });

  // 打开时重置数量（对齐源 form.resetFields()）。
  React.useEffect(() => {
    if (open) {
      reset({ stablecoinCount: '' });
    }
  }, [open, reset, mode]);

  const title = isMint ? t('Router_018') : t('Router_019');
  const subTitle = isMint ? t('stablecoin_manage_013') : t('stablecoin_manage_015');
  // Mint tips 固定文案；Melt tips 含 **** 占位 → surplusCount（源 .replace('****', ...)）。
  const tips = isMint
    ? t('stablecoin_manage_014')
    : t('stablecoin_manage_016').replace('****', String(surplusCount ?? 0));

  // ── 金额校验（对齐源 validator + max）──
  const validateAmount = React.useCallback(
    (raw: string): string | undefined => {
      if (raw === '' || raw == null) {
        return t('PUB_Pleased').replace('****', t('stablecoin_manage_004'));
      }
      const num = Number(raw);
      if (Number.isNaN(num) || num <= 0) {
        return t('PUB_Pleased').replace('****', t('stablecoin_manage_004'));
      }
      if (!DECIMAL_6_RE.test(raw)) {
        return t('stablecoin_manage_025');
      }
      if (isMint && num > MINT_MAX) {
        return t('PUB_Pleased').replace('****', t('stablecoin_manage_004'));
      }
      if (!isMint && surplusCount != null && num > surplusCount) {
        return t('PUB_Pleased').replace('****', t('stablecoin_manage_004'));
      }
      return undefined;
    },
    [t, isMint, surplusCount],
  );

  const onValid = (values: MintMeltFormValues) => {
    if (stablecoin?.stablecoinId == null || (!isMint && !Number.isFinite(surplusCount))) return;
    if (isMint) {
      issueMutation.mutate(
        {
          stablecoinCount: values.stablecoinCount,
          stablecoinId: stablecoin?.stablecoinId,
          stablecoinName: stablecoin?.name,
          stablecoinUnit: stablecoin?.symbol,
        },
        {
          onSuccess: () => onSuccess(),
        },
      );
    } else {
      removeMutation.mutate(
        {
          stablecoinCount: values.stablecoinCount,
          stablecoinId: stablecoin?.stablecoinId,
        },
        {
          onSuccess: () => onSuccess(),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subTitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-4">
          {/* 稳定币名称（标识）—— 源 selectIndex disabled Input，回填币种名 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('stablecoin_manage_003')}
            </label>
            <Input value={coinName} disabled readOnly />
          </div>

          {/* 数量 + tips */}
          <div>
            <label
              htmlFor="mint-melt-count"
              className="mb-1.5 block text-sm font-medium"
            >
              {t('stablecoin_manage_004')}
            </label>
            <Input
              id="mint-melt-count"
              type="number"
              step="0.000001"
              min={0}
              max={isMint ? MINT_MAX : surplusCount}
              aria-invalid={!!errors.stablecoinCount}
              {...register('stablecoinCount', {
                validate: validateAmount,
              })}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">{tips}</p>
            {errors.stablecoinCount ? (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {errors.stablecoinCount.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="flex-row justify-end gap-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('PUB_Cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || stablecoin?.stablecoinId == null || (!isMint && !Number.isFinite(surplusCount))}>
              {t('PUB_Submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
