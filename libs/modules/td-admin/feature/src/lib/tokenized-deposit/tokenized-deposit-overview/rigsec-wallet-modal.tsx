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
 * 传 chainType/walletType/storageType/roleName/blockchainCode/tokenName/ifAdd；
 * walletType 源为 `Number(标签串) || 1` 恒 1，Cold/Hot 单选不透传）。
 * 成功回填 walletAddress 到 AdminWalletModal 表单（onSuccess 透传 { walletAddress }）。
 *
 * ## Wallet Attribute（源 2634-2642）
 *
 * RadioGroup 单选 Cold=1 / Hot=2（源值与 edit 版 WALLET_ATTRIBUTE_TYPE 不同，
 * 源 index rigsec Modal 用 1=Cold / 2=Hot；本组件照搬源值，不与 edit 版常量耦合）。
 *
 * ## 描述文案（源 2607-2628）
 *
 * 保持源的英文硬编码语义：A new {role} wallet address for {token} will be
 * generated via {service}...；不将该弹窗改为 tokenized-deposit i18n 键，
 * 以免改变上游展示契约。
 * 提交接口仍位于 td-admin data-access；本文件不新增依赖。
 */
'use client';

import * as React from 'react';
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
import { useGenerateWalletKeystoreMutation } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit';

/** Wallet Attribute 候选（源 2638-2641：Cold=1 / Hot=2）。 */
const WALLET_ATTRIBUTE_OPTIONS = [
  { value: '1', label: 'Cold Wallet' },
  { value: '2', label: 'Hot Wallet' },
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
  blockchainCode,
  tokenName,
  onCancel,
  onGenerated,
}: OverviewRigsecWalletModalProps): React.JSX.Element {
  const { mutateAsync, isPending } = useGenerateWalletKeystoreMutation();
  const roleLabel =
    Number(roleName) === 1
      ? 'Contract Owner'
      : Number(roleName) === 2
        ? 'Gas Payment'
        : 'Management';
  const serviceName = storageType === 'key_rigsec' ? 'RigSec' : 'Fireblocks';
  const displayTokenName = tokenName || 'Token Name';

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
        // 源 index.tsx:2577-2580 walletType 为 `Number(标签字符串) || 1` → 恒 1
        //（Cold/Hot 单选在上游是死状态，不透传；review NF-4 源差异保真，2026-10-28）。
        walletType: 1,
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


  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && !isPending && onCancel()}
    >
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Wallet</DialogTitle>
          <DialogDescription className="sr-only">
            Generate Wallet
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="mb-6 text-sm text-muted-foreground">
            A new <span className="font-bold">{roleLabel}</span> wallet address
            for <span className="font-bold">{displayTokenName}</span> will be
            generated via <span className="font-bold">{serviceName}</span>.
            Upon confirmation, the role information will be updated accordingly.
          </p>

          <div>
            <div className="mb-2 flex items-center">
              <span className="text-destructive" aria-hidden="true">*</span>
              <span className="font-medium">Wallet Attribute</span>
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
                  {option.label}
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="flex-row justify-center gap-4 sm:justify-center">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
