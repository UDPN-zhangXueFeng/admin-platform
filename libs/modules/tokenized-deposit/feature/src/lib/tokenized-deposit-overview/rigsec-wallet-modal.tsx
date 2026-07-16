/**
 * RigsecWalletModal — overview 钱包管理用 rigsec/fireblocks 钱包生成 Modal。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的 isRigsecModalOpen Modal
 * （源 2545-2645）。
 *
 * ## 触发（源 2370-2371）
 *
 * AdminWalletModal Update 态点「Generate Wallet」且 storageType!=='key_keystore'
 * （rigsec/fireblocks）时，Shell 打开本 Modal + 设默认 walletAttribute。
 *
 * ## 提交（源 2569-2599）
 *
 * 点 Confirm → useGenerateWalletKeystoreMutation（rigsec 分支：不传 password，
 * 传 chainType/walletType/storageType/roleName/blockchainCode/tokenName/ifAdd）。
 * 成功回填 walletAddress 到 AdminWalletModal 表单（onSuccess 透传 { walletAddress }）。
 *
 * ## Wallet Attribute（源 2634-2642）
 *
 * RadioGroup 单选 Cold=1 / Hot=2（源值与 edit 版 WALLET_ATTRIBUTE_TYPE 不同，
 * 源 index rigsec Modal 用 1=Cold / 2=Hot；本组件照搬源值，不与 edit 版常量耦合）。
 *
 * ## 描述文案（源 2607-2628）
 *
 * 全英文硬编码（A new {role} wallet address for {token} will be generated via
 * {service}...）。迁移 i18n 化：复用 edit 版 tokenized_deposit_0138（{token}/
 * {service}/{role} ICU 插值），保持两版文案一致。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RadioGroup,
  RadioGroupItem,
} from '@myorg/shared/ui';
import { useGenerateWalletKeystoreMutation } from '@myorg/modules/tokenized-deposit/data-access';

/** Wallet Attribute 候选（源 2638-2641：Cold=1 / Hot=2）。 */
const WALLET_ATTRIBUTE_OPTIONS = [
  { value: '1', labelKey: 'wallet_attr_cold' },
  { value: '2', labelKey: 'wallet_attr_hot' },
] as const;

export interface OverviewRigsecWalletModalProps {
  /** Modal 开关。 */
  open: boolean;
  /** chainType（generateWalletKeystore body）。 */
  chainType: string;
  /** storageType（key_rigsec / fireblocks，决定描述文案 service 名）。 */
  storageType: string;
  /** roleName（generateWalletKeystore body，源 Number(confirmType)）。 */
  roleName?: string;
  /** walletType（generateWalletKeystore body，源 Number(walletType)）。 */
  walletType?: number;
  /** blockchainCode（generateWalletKeystore body）。 */
  blockchainCode?: string;
  /** tokenName（generateWalletKeystore body + 描述文案插值）。 */
  tokenName?: string;
  /** 取消回调。 */
  onCancel: () => void;
  /**
   * 生成成功回调（Shell 回填 adminWallet 表单 chainAccountAddress）。
   * 接收 { walletAddress }（源 setFieldsValue chainAccountAddress）。
   */
  onGenerated: (result: { walletAddress?: string }) => void;
}

/**
 * overview 版 Rigsec Wallet Modal。
 *
 * 用法：
 * ```tsx
 * <OverviewRigsecWalletModal
 *   open={isRigsecModalOpen}
 *   chainType={adminCtx.chainType ?? ''}
 *   storageType={adminCtx.storageType ?? 'key_rigsec'}
 *   roleName={String(adminCtx.confirmType)}
 *   walletType={adminCtx.walletType}
 *   blockchainCode={adminCtx.blockchainCode}
 *   tokenName={adminCtx.tokenName}
 *   onCancel={() => setIsRigsecModalOpen(false)}
 *   onGenerated={({ walletAddress }) => {/* 回填 *\/}}
 * />
 * ```
 */
export function OverviewRigsecWalletModal({
  open,
  chainType,
  storageType,
  roleName,
  walletType,
  blockchainCode,
  tokenName,
  onCancel,
  onGenerated,
}: OverviewRigsecWalletModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const { mutateAsync, isPending } = useGenerateWalletKeystoreMutation();

  // walletAttribute（源 useState(1)，Cold 默认）。
  const [walletAttribute, setWalletAttribute] = React.useState<string>('1');

  // 打开时复位（源 onCancel + 初始 setWalletAttribute(1)）。
  React.useEffect(() => {
    if (open) {
      setWalletAttribute('1');
    }
  }, [open]);

  const handleConfirm = async () => {
    try {
      const res = await mutateAsync({
        chainType: chainType || '',
        storageType: storageType || 'key_rigsec',
        walletType: walletType ?? Number(walletAttribute),
        roleName: roleName ?? '',
        blockchainCode: blockchainCode ?? '',
        tokenName: tokenName ?? '',
        ifAdd: false,
      });
      onGenerated({ walletAddress: res?.walletAddress });
      onCancel();
    } catch {
      // mutation 错误由 apiClient 拦截器统一 toast。
    }
  };

  // 描述文案 service 名（源 storageType==='key_rigsec' ? 'RigSec' : 'Fireblocks'）。
  const serviceName = storageType === 'key_rigsec' ? 'RigSec' : 'Fireblocks';
  const displayTokenName = tokenName || t('tokenized_deposit_0005');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && !isPending && onCancel()}
    >
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('PUB_Generate_Wallet')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('PUB_Generate_Wallet')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="mb-6 text-sm text-muted-foreground">
            {t('tokenized_deposit_0138', {
              role: '',
              token: displayTokenName,
              service: serviceName,
            })}
          </p>

          <div>
            <div className="mb-2 flex items-center">
              <span className="text-destructive" aria-hidden="true">*</span>
              <span className="font-medium">{t('wallet_attribute')}</span>
            </div>
            <RadioGroup
              value={walletAttribute}
              onValueChange={setWalletAttribute}
              className="flex"
            >
              {WALLET_ATTRIBUTE_OPTIONS.map((option, index) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-2 text-sm ${
                    index > 0 ? 'ml-4' : ''
                  }`}
                >
                  <RadioGroupItem value={option.value} />
                  {t(option.labelKey)}
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="flex-row justify-center gap-4 sm:justify-center">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            {t('PUB_Cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            {t('PUB_Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
