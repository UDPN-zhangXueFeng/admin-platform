/**
 * OverviewShell 的管理员钱包 Modal 群 hook：AdminWalletModal 4 态上下文、触发行
 * 快照、生成结果快照与 Generate/Rigsec 子 Modal 开关及回调。
 * 源: overview-shell.tsx 158-177、426-484
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { AdminWalletCtx } from './admin-wallet-modal';
import type { AdminWalletModalActionContext } from './tab-wallets';

/** 生成钱包结果快照（keystore/walletAddress/password），回填 AdminWalletModal 表单。 */
export interface GeneratedWalletSnapshot {
  keystore?: string;
  walletAddress?: string;
  password?: string;
}

/** 运营总览页主壳的管理员钱包 Modal 群状态。 */
export function useOverviewAdminWalletModals() {
  const t = useTranslations('modules.tokenized-deposit');

  // ── AdminWalletModal（源 adminWalletModalOpen + adminWalletModalInfo 4 态）──
  const [adminWalletModalOpen, setAdminWalletModalOpen] = React.useState(false);
  const [adminWalletCtx, setAdminWalletCtx] =
    React.useState<AdminWalletCtx | null>(null);
  // 触发行原始数据（GenerateWallet/RigsecWallet 子 Modal 入参 chainType/blockchainCode/
  // tokenName/walletType 等从 row 衍生，AdminWalletCtx 类型不含这些字段）。
  const [adminWalletRow, setAdminWalletRow] =
    React.useState<AdminWalletModalActionContext['row'] | null>(null);
  // 生成钱包结果快照（keystore/walletAddress/password），回填 AdminWalletModal 表单
  // （源 generateForm onSuccess → formAdminWallet.setFieldsValue，td-18 回填增强）。
  const [generatedWallet, setGeneratedWallet] =
    React.useState<GeneratedWalletSnapshot | null>(null);

  // ── GenerateWalletModal / RigsecWalletModal 开关（源 generateIsModalOpen +
  // isRigsecModalOpen）──
  const [generateIsModalOpen, setGenerateIsModalOpen] = React.useState(false);
  const [isRigsecModalOpen, setIsRigsecModalOpen] = React.useState(false);

  // ── Tab 回调：tab-wallets 打开管理员钱包 Modal ──
  // 源 actionClick 按分支组装 adminWalletModalInfo（id/title/type/walletType/walletAddress/
  // chainType/storageType/blockchainCode/tokenName/confirmType）。WalletItem 行含这些字段，
  // 这里从 row 组装 AdminWalletCtx（modal props 类型）。chainType 等子 Modal 入参由
  // adminWalletCtx 衍生（modal 自身不消费 chainType，仅 generate/rigsec 子 Modal 需要）。
  const handleOpenAdminWalletModal = React.useCallback(
    ({ action, row }: AdminWalletModalActionContext) => {
      const t0 = t;
      // 源 4 态 title/type 映射：Update/Details/History（Approval 走死代码 Examine，不上报）。
      const type: AdminWalletCtx['type'] =
        action === 'Update' ? 'Update' : action;
      const walletTypeText =
        row.type == null ? '' : t0(`admin_wallet_type_${row.type}`);
      const title =
        action === 'Update'
          ? t0('tokenized_deposit_0076').replace(
              '{type}',
              t0('tokenized_deposit_0122'),
            )
          : action === 'History'
            ? t0('tokenized_deposit_0077')
            : `${t0('tokenized_deposit_0145')} ${t0('PUB_Detail')}`;
      // id：Update 用 accountId（源 data.accountId），Details/History 用 stablecoinId（源 data.stablecoinId）。
      const id =
        action === 'Update'
          ? (row.accountId ?? '')
          : (row.stablecoinId ?? '');
      const ctx: AdminWalletCtx = {
        type,
        title,
        id,
        walletType: walletTypeText,
        accountType: row.type,
        stablecoinId: row.stablecoinId,
        walletAddress: row.walletAddress,
        storageType: row.storageType,
      };
      setAdminWalletCtx(ctx);
      setAdminWalletRow(row);
      setAdminWalletModalOpen(true);
    },
    [t],
  );

  // ── AdminWalletModal 「生成钱包」入口 → 按 storageType 开子 Modal（源 onGenerateWallet）──
  // keystore 路径 → GenerateWalletModal；rigsec/fireblocks → RigsecWalletModal。
  const handleGenerateWallet = React.useCallback(() => {
    const isKeystore = adminWalletCtx?.storageType === 'key_keystore';
    if (isKeystore) {
      setGenerateIsModalOpen(true);
    } else {
      setIsRigsecModalOpen(true);
    }
  }, [adminWalletCtx?.storageType]);

  // 子生成 Modal 结果消费完成（AdminWalletModal 回填后清快照）。
  const consumeGeneratedWallet = React.useCallback(() => {
    setGeneratedWallet(null);
  }, []);

  return {
    adminWalletModalOpen,
    adminWalletCtx,
    adminWalletRow,
    generatedWallet,
    generateIsModalOpen,
    isRigsecModalOpen,
    setAdminWalletModalOpen,
    setGeneratedWallet,
    setGenerateIsModalOpen,
    setIsRigsecModalOpen,
    handleOpenAdminWalletModal,
    handleGenerateWallet,
    consumeGeneratedWallet,
  };
}
