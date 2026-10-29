/**
 * OverviewShell 的 5 个 Modal 容器（MintMelt / DeployContract / DeployHistory /
 * AdminWallet / Generate / Rigsec）。纯接线展示，open state 与回调由 OverviewShell
 * 经 props 注入（prop 命名与源主壳内联变量一致）。
 * 源: overview-shell.tsx 632-717
 */
'use client';

import * as React from 'react';
import type { ApplyListItem } from '@myorg/modules/td-admin/data-access';
import {
  MintMeltModal,
  type MintMeltModalInfo,
  type MintMeltType,
} from './mint-melt-modal';
import { DeployContractModal } from './deploy-contract-modal';
import {
  DeployHistoryModal,
  type DeployHistoryModalProps,
} from './deploy-history-modal';
import { AdminWalletModal, type AdminWalletCtx } from './admin-wallet-modal';
import { OverviewGenerateWalletModal } from './generate-wallet-modal';
import { OverviewRigsecWalletModal } from './rigsec-wallet-modal';
import type { AdminWalletModalActionContext } from './tab-wallets';
import type { GeneratedWalletSnapshot } from './use-overview-admin-wallet-modals';
import type { MintMeltAssetSnapshot } from './use-overview-mint-melt';

interface OverviewShellModalsProps {
  /** Mint/Melt Modal open（源 isModalOpen）。 */
  isModalOpen: boolean;
  mintMeltInfo: MintMeltModalInfo | null;
  mintMeltType: MintMeltType;
  /** 点击时资产快照（源 mintMeltAsset）。 */
  mintMeltAsset: MintMeltAssetSnapshot | null;
  handleMintMeltClose: () => void;
  /** DeployContractModal {taskCode, state} 点击时快照（源 deployModal）。 */
  deployModal: { taskCode: string; state?: number } | null;
  currentTd: ApplyListItem | undefined;
  handleDeployModalClose: () => void;
  /** DeployHistoryModal（源 isModalOpenHistory + deployHistory）。 */
  isModalOpenHistory: boolean;
  /** query data 允许 null（空归一化），弹窗处再 `?? undefined` 归一。 */
  deployHistory: DeployHistoryModalProps['history'] | null;
  setIsModalOpenHistory: React.Dispatch<React.SetStateAction<boolean>>;
  /** AdminWalletModal（源 adminWalletModalOpen + adminWalletCtx + adminWalletRow）。 */
  adminWalletModalOpen: boolean;
  adminWalletCtx: AdminWalletCtx | null;
  setAdminWalletModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setGeneratedWallet: React.Dispatch<
    React.SetStateAction<GeneratedWalletSnapshot | null>
  >;
  handleGenerateWallet: () => void;
  generatedWallet: GeneratedWalletSnapshot | null;
  consumeGeneratedWallet: () => void;
  adminWalletRow: AdminWalletModalActionContext['row'] | null;
  generateIsModalOpen: boolean;
  setGenerateIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isRigsecModalOpen: boolean;
  setIsRigsecModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/** 渲染 5 Modal 容器（td-18）。 */
export function OverviewShellModals({
  isModalOpen,
  mintMeltInfo,
  mintMeltType,
  mintMeltAsset,
  handleMintMeltClose,
  deployModal,
  currentTd,
  handleDeployModalClose,
  isModalOpenHistory,
  deployHistory,
  setIsModalOpenHistory,
  adminWalletModalOpen,
  adminWalletCtx,
  setAdminWalletModalOpen,
  setGeneratedWallet,
  handleGenerateWallet,
  generatedWallet,
  consumeGeneratedWallet,
  adminWalletRow,
  generateIsModalOpen,
  setGenerateIsModalOpen,
  isRigsecModalOpen,
  setIsRigsecModalOpen,
}: OverviewShellModalsProps): React.JSX.Element {
  return (
    <>
      {/* 5 Modal 容器（td-18）：MintMeltModal 已接线，其余 4 Modal 占位 */}
      <MintMeltModal
        open={isModalOpen}
        modalInfo={
          mintMeltInfo ?? {
            title: '',
            availableBalance: 0,
            reserveBalance: '',
            tips: '',
          }
        }
        type={mintMeltType}
        // 点击时快照（mintMeltAsset），非实时 currentTd：Modal 打开期间切换 TD/refetch
        // 不影响展示与提交 body（防错资产铸销）。
        stablecoinCode={mintMeltAsset?.code ?? ''}
        stablecoinCodeLabel={mintMeltAsset?.symbol ?? ''}
        tokenTypeLabel={mintMeltAsset?.tokenTypeLabel ?? ''}
        onCancel={handleMintMeltClose}
      />

      {/* DeployContractModal（部署/升级，步骤进度）—— taskCode/state 为点击时快照，
          tdType 取当前资产（Modal 仅在 Tab2 内打开，切换 TD 时 Modal 阻塞 UI 无风险）；
          步骤详情由 Modal 内部 useDeployStepDetailQuery(taskCode) 拉取（源 getDeployInfo）。 */}
      <DeployContractModal
        open={deployModal != null}
        taskCode={deployModal?.taskCode ?? ''}
        tdType={currentTd?.type}
        contractState={deployModal?.state}
        onCancel={handleDeployModalClose}
      />

      {/* DeployHistoryModal（部署历史，useContractDeployHistoryQuery 取 data[0]） */}
      <DeployHistoryModal
        open={isModalOpenHistory}
        history={deployHistory ?? undefined}
        onCancel={() => setIsModalOpenHistory(false)}
      />

      {/* AdminWalletModal（4 态），onGenerateWallet 按 storageType 开子 Modal */}
      <AdminWalletModal
        open={adminWalletModalOpen}
        ctx={
          adminWalletCtx ?? {
            type: 'Details',
            title: '',
            id: '',
            walletType: '',
          }
        }
        onCancel={() => {
          setAdminWalletModalOpen(false);
          setGeneratedWallet(null);
        }}
        onGenerateWallet={handleGenerateWallet}
        generatedWallet={generatedWallet}
        onGeneratedConsumed={consumeGeneratedWallet}
      />

      {/* GenerateWalletModal（keystore 路径）—— chainType 来自触发行 virtualMachineCode（源 chainType: data.virtualMachineCode） */}
      <OverviewGenerateWalletModal
        open={generateIsModalOpen}
        chainType={adminWalletRow?.virtualMachineCode ?? ''}
        walletType={adminWalletRow?.type}
        roleName={adminWalletRow?.type}
        blockchainCode={adminWalletRow?.blockchainCode ?? ''}
        tokenName={adminWalletRow?.tdName}
        onCancel={() => setGenerateIsModalOpen(false)}
        onGenerated={setGeneratedWallet}
      />

      {/* RigsecWalletModal（rigsec/fireblocks 路径）—— 入参从触发行衍生 */}
      <OverviewRigsecWalletModal
        open={isRigsecModalOpen}
        chainType={adminWalletRow?.virtualMachineCode ?? ''}
        storageType={adminWalletRow?.storageType ?? 'key_rigsec'}
        roleName={String(adminWalletRow?.type ?? '')}
        blockchainCode={adminWalletRow?.blockchainCode ?? ''}
        tokenName={adminWalletRow?.tdName ?? ''}
        onCancel={() => setIsRigsecModalOpen(false)}
        onGenerated={({ walletAddress }) => setGeneratedWallet({ walletAddress })}
      />

    </>
  );
}
