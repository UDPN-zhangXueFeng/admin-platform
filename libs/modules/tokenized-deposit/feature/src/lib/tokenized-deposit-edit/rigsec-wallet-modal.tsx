'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RadioGroup,
  RadioGroupItem,
} from '@myorg/shared/ui';

import type { KeyServiceOption } from '@myorg/modules/tokenized-deposit/data-access';

/**
 * RigsecWalletModal — rigsec/fireblocks 路径钱包生成 Modal（Hot/Cold 选择）。
 *
 * 迁移自 td-manage `edit/RigsecWalletModal.tsx`（94 行）。
 *
 * ## 触发
 *
 * `useWalletManagement.checkWalletAddress(type)` 在非 keystore 路径
 * （storageType !== 'key_keystore'，即 rigsec/fireblocks）时，
 * `setIsRigsecModalOpen(true)` + 设默认 walletAttribute（Hot/Cold）。
 *
 * ## 提交
 *
 * 「Confirm」→ props.onConfirm（即 useWalletManagement.handleRigsecSubmit）：
 * 调 generateWalletKeystore（walletType=walletAttribute, 无 password）回填
 * walletAddress + keyStore，关闭 Modal。loading 由 rigsecConfirmLoading 控制。
 *
 * ## Wallet Attribute
 *
 * RadioGroup 单选，options 来自 useWalletManagement.walletAttributeOptions
 * （Hot=1 / Cold=5，由 currentKeyService.walletTypes 派生）。onChange →
 * props.onWalletAttributeChange（setWalletAttribute）。
 *
 * ## 与源差异
 *
 * - antd Modal + Radio.Group → shared/ui Dialog + RadioGroup。
 * - 源全英文硬编码（"Generate Wallet"/"Cancel"/"Confirm"/角色名/"Wallet Attribute"/
 *   描述文案）→ i18n 化（PUB_/tokenized_deposit_0xxx/wallet_attribute）。
 * - antd Radio.Group value/onChange → Radix RadioGroup value/onValueChange（值转 number）。
 *
 * @param open Modal 开关（useWalletManagement.isRigsecModalOpen）
 * @param modalInfo { type: 1|2|3 }（useWalletManagement.modalInfo，决定角色名）
 * @param walletAttribute 当前选中 Hot/Cold（useWalletManagement.walletAttribute）
 * @param walletAttributeOptions Hot/Cold 候选（useWalletManagement.walletAttributeOptions）
 * @param loading 提交中（useWalletManagement.rigsecConfirmLoading）
 * @param tokenName 当前代币名（form.name，描述文案插值）
 * @param currentKeyService 当前密钥服务（含 keyServiceName，描述文案插值）
 * @param onWalletAttributeChange 切换 Hot/Cold（useWalletManagement.setWalletAttribute）
 * @param onCancel 取消（useWalletManagement：关闭 + 复位 walletAttribute）
 * @param onConfirm 提交（useWalletManagement.handleRigsecSubmit）
 */
export interface RigsecWalletModalProps {
  open: boolean;
  modalInfo: { type: 1 | 2 | 3 };
  walletAttribute: number;
  walletAttributeOptions: Array<{ value: number; label: string }>;
  loading: boolean;
  tokenName?: string;
  currentKeyService?: KeyServiceOption;
  onWalletAttributeChange: (value: number) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

/** 角色类型 → 角色 label key 映射（与 AdminWalletSection walletFieldGroups 一致）。 */
const ROLE_LABEL_KEY: Record<1 | 2 | 3, string> = {
  1: 'tokenized_deposit_0112',
  2: 'tokenized_deposit_0113',
  3: 'tokenized_deposit_0114',
};

export function RigsecWalletModal({
  open,
  modalInfo,
  walletAttribute,
  walletAttributeOptions,
  loading,
  tokenName,
  currentKeyService,
  onWalletAttributeChange,
  onCancel,
  onConfirm,
}: RigsecWalletModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const roleLabel = t(ROLE_LABEL_KEY[modalInfo.type]);
  const displayTokenName = tokenName || t('tokenized_deposit_0005');
  const displayKeyServiceName =
    currentKeyService?.keyServiceName || 'RigSec';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !loading && onCancel()}>
      <DialogContent className="max-w-[30rem]">
        <DialogHeader>
          <DialogTitle>{t('PUB_Generate_Wallet')}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="mb-6 text-sm text-muted-foreground">
            {t('tokenized_deposit_0138', {
              role: roleLabel,
              token: displayTokenName,
              service: displayKeyServiceName,
            })}
          </p>

          <div>
            <div className="mb-2 flex items-center">
              <span className="text-destructive" aria-hidden="true">*</span>
              <span className="font-medium">{t('wallet_attribute')}</span>
            </div>
            <RadioGroup
              value={walletAttribute !== undefined ? String(walletAttribute) : ''}
              onValueChange={(v) => onWalletAttributeChange(Number(v))}
              className="flex gap-4"
            >
              {walletAttributeOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <RadioGroupItem value={String(option.value)} />
                  {option.label}
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="flex-row justify-center gap-4 sm:justify-center">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            {t('PUB_Cancel')}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={loading}>
            {t('PUB_Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
