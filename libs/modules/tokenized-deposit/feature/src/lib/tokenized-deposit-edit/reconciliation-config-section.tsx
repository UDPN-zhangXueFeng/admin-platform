'use client';

import * as React from 'react';
import { type Control, Controller, type UseFormSetValue } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, Checkbox, Field, FieldGroup, FieldLabel } from '@myorg/shared/ui';

import type {
  ReserveAccountOption,
  TDEditDetail,
  TDEditFormValues,
} from '@myorg/modules/tokenized-deposit/data-access';
import { MINT_METHOD, RECON_DISABLED, RECON_ENABLED } from '@myorg/modules/tokenized-deposit/util';
import { SectionHeading } from './ui/section-card';

/**
 * ReconciliationConfigSection — 对账配置区（Token 对账 + 储备资产对账）。
 *
 * 迁移自 td-manage `edit/ReconciliationConfigSection.tsx`（129 行）。
 *
 * ## 两个 Checkbox
 *
 * - `enableTokenReconciliation`（存 RECON_ENABLED(1)/RECON_DISABLED(0)）。
 * - `enableReserveAssetReconciliation`（仅 mintMethod===1 Stablecoin 显，同上）。
 *
 * ## 账户级锁定（严格保留源）
 *
 * `enableReserveAssetReconciliation===1`（储备账户已启用对账）→ 强制勾选且不可改：
 * - isReserveReconLocked = showReserveRecon && selectedReserve.enableReserveAssetReconciliation===1。
 * - effect：锁定且当前值非 ENABLED 时 setValue('enableReserveAssetReconciliation', 1)。
 *
 * ## 编辑态已启用 → disabled
 *
 * - tokenReconDisabled = isEditMode && detail.enableTokenReconciliation===1。
 * - reserveReconDisabled = isEditMode && detail.enableReserveAssetReconciliation===1 || isReserveReconLocked。
 */
export interface ReconciliationConfigSectionProps {
  control: Control<TDEditFormValues>;
  setValue: UseFormSetValue<TDEditFormValues>;
  hasCode: boolean;
  detailInfo: TDEditDetail;
  reserveList?: ReserveAccountOption[];
  reserveAccountId?: string | number;
  reserveReconValue?: number;
  mintMethod?: number;
}

export function ReconciliationConfigSection({
  control,
  setValue,
  hasCode,
  detailInfo,
  reserveList = [],
  reserveAccountId,
  reserveReconValue,
  mintMethod,
}: ReconciliationConfigSectionProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const showReserveRecon = mintMethod === MINT_METHOD.STABLECOIN;

  // 当前选中的储备账户（用于账户级锁定判定）。
  const selectedReserve = React.useMemo(
    () =>
      reserveList.find(
        (item) => String(item.reserveAccountId) === String(reserveAccountId),
      ),
    [reserveList, reserveAccountId],
  );

  // 账户级锁定：储备账户已启用对账 → 强制勾选且不可改。
  const isReserveReconLocked =
    showReserveRecon &&
    Number(
      (selectedReserve as (ReserveAccountOption & {
        enableReserveAssetReconciliation?: number;
      }) | undefined)?.enableReserveAssetReconciliation,
    ) === RECON_ENABLED;

  // 编辑态已启用 → disabled。
  const tokenReconDisabled =
    hasCode && Number(detailInfo.enableTokenReconciliation) === RECON_ENABLED;
  const reserveReconAlreadyEnabled =
    hasCode &&
    Number(detailInfo.enableReserveAssetReconciliation) === RECON_ENABLED;
  const reserveReconDisabled = reserveReconAlreadyEnabled || isReserveReconLocked;

  // 账户级锁定 effect：锁定且当前值非 ENABLED → 强制设为 ENABLED（源 useEffect 同）。
  React.useEffect(() => {
    if (!isReserveReconLocked) return;
    if (reserveReconValue === RECON_ENABLED) return;
    setValue('enableReserveAssetReconciliation', RECON_ENABLED);
  }, [isReserveReconLocked, reserveReconValue, setValue]);

  return (
    <Card>
      <SectionHeading
        icon={ShieldCheck}
        title={t('tokenized_deposit_recon_title')}
        description={t('td_section_operations_desc')}
      />
      <CardContent className="py-6">
        <FieldGroup
          className={
            showReserveRecon
              ? 'grid gap-5 md:grid-cols-2'
              : 'grid gap-5 md:grid-cols-2'
          }
        >
          {/* ── Token 对账（存 1/0）── */}
          <Controller
            control={control}
            name="enableTokenReconciliation"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="recon-token"
                  checked={Number(field.value) === RECON_ENABLED}
                  disabled={tokenReconDisabled}
                  onCheckedChange={(c) =>
                    field.onChange(c === true ? RECON_ENABLED : RECON_DISABLED)
                  }
                />
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor="recon-token">
                    {t('tokenized_deposit_recon_token_label')}
                  </FieldLabel>
                  <span className="text-sm text-muted-foreground">
                    {t('tokenized_deposit_recon_token_desc')}
                  </span>
                </div>
              </Field>
            )}
          />

          {/* ── 储备资产对账（仅 Stablecoin 显）── */}
          {showReserveRecon ? (
            <Controller
              control={control}
              name="enableReserveAssetReconciliation"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox
                    id="recon-reserve"
                    checked={Number(field.value) === RECON_ENABLED}
                    disabled={reserveReconDisabled}
                    onCheckedChange={(c) =>
                      field.onChange(
                        c === true ? RECON_ENABLED : RECON_DISABLED,
                      )
                    }
                  />
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel htmlFor="recon-reserve">
                      {t('tokenized_deposit_recon_reserve_label')}
                    </FieldLabel>
                    <span className="text-sm text-muted-foreground">
                      {t(
                        isReserveReconLocked
                          ? 'tokenized_deposit_recon_reserve_locked'
                          : 'tokenized_deposit_recon_reserve_desc',
                      )}
                    </span>
                  </div>
                </Field>
              )}
            />
          ) : null}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
