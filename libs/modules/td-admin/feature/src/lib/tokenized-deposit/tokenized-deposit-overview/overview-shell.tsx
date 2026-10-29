/**
 * OverviewShell — 运营总览页主壳组件。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 主组件（2666 行）的：
 * - 顶部 state 50+（activeKey/active/getUsablePrice/showMelt/modal×5 open state 等）
 * - CustomTab TD 切换（自建，源 libs/components/CustomTabs.tsx）
 * - 概览卡（OverviewInfoCard，td-14）
 * - 9 操作按钮（OverviewActionButtons，td-14）
 * - 4 Tab 容器占位（td-15/16/17 实现 content）
 * - 5 Modal 容器占位（td-18 实现）
 * - applyListApi 标题列表联动（mount + active/activeKey 变化 → useApplyListQuery）
 *
 * 本任务（td-14）只搭骨架 + 联动 + 占位，Tab content 与 Modal 内部逻辑由后续任务实现。
 *
 * ## applyList 联动时序（文档 8.18）
 *
 * 1. mount：useApplyListQuery 自动拉取 applyList。
 * 2. 数据回来后按 activeKey 取当前 TD（getUsablePrice），并按 state/applyStatus 决定 active Tab：
 *    - state===0 && applyStatus===5||15 → active '4'（待部署/审批中→合约 Tab）
 *    - state===0 && applyStatus===20 → active '2'（待部署→合约 Tab）
 *    - 否则 → active '1'（默认铸销记录 Tab）
 * 3. mintMethod===1/type===1 时拉 useHasPendingMeltQuery 决定 Melt 按钮可用性（showMelt）。
 * 4. 无数据（applyList 为空/undefined 且非 loading）→ 渲染 Empty 空页（含 Onboard 按钮）。
 *
 * ## Tab key 映射（源码 active '1'/'2'/'3'/'4'）
 *
 * '1' = records（铸销记录/SP/MMF Summary）
 * '2' = contracts（合约部署）
 * '3' = wallets（角色钱包 customTable2）
 * '4' = operation-records（操作记录）
 *
 * ## 死代码不迁移（文档 8.21）
 *
 * - customTable `to` 列注释
 * - customTable2 `Examine` action 注释（TD_PERMISSIONS.EXAMINE 权限码保留）
 * - Force Transfer 行
 * - GeneratemodalInfo/table2InitialValues/table2Form/walletAttribute/stepOneProgress 死 state
 * - actionClick 'Approval' 死分支
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { useContractDeployHistoryQuery } from '@myorg/modules/td-admin/data-access';
import { OverviewInfoCard } from './overview-info-card';
import { OverviewActionButtons } from './overview-action-buttons';
import { OverviewEmpty, TdSwitcher } from './overview-shell-helpers';
import {
  OverviewShellError,
  OverviewShellLoading,
} from './overview-shell-fallbacks';
import { OverviewTabs } from './overview-tabs';
import { OverviewShellModals } from './overview-shell-modals';
import { OverviewConfirmDialogs } from './overview-confirm-dialogs';
import { useOverviewTdSelection } from './use-overview-td-selection';
import { useOverviewMintMelt } from './use-overview-mint-melt';
import { useOverviewAdminWalletModals } from './use-overview-admin-wallet-modals';
import { useOverviewConfirm } from './use-overview-confirm';
import { useOverviewAction } from './use-overview-action';


/**
 * 运营总览页主壳。
 *
 * 用法：
 * ```tsx
 * <OverviewShell />
 * ```
 *
 * 路由挂载由 module-registry（td-24）的 `list` pageKey → TokenizedDepositOverviewPage 完成。
 */
export function OverviewShell(): React.JSX.Element {
  // ── DeployContractModal（源 isModalOpenDelopy）──
  // {taskCode, state} 点击时快照（源 1252-1256：首行三元 taskCode + data.state）。
  const [deployModal, setDeployModal] = React.useState<{
    taskCode: string;
    state?: number;
  } | null>(null);

  // ── DeployHistoryModal（源 isModalOpenHistory）──
  const [isModalOpenHistory, setIsModalOpenHistory] = React.useState(false);

  // ── 主壳 50+ state / 联动 / 回调（机械拆分至下列 hooks，行为不变）──
  const {
    applyList,
    applyListLoading,
    applyListError,
    refetchApplyList,
    hasData,
    currentTd,
    activeIndex,
    active,
    setActive,
    setActiveCode,
    showMelt,
    handleSelectTd,
    handleOnboard,
  } = useOverviewTdSelection();

  const {
    isModalOpen,
    mintMeltInfo,
    mintMeltType,
    mintMeltAsset,
    setMintMeltType,
    setMintMeltAsset,
    handleMintMeltClose,
  } = useOverviewMintMelt();

  const {
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
  } = useOverviewAdminWalletModals();

  const {
    statusConfirm,
    deleteConfirm,
    statusPending,
    deletePending,
    setStatusConfirm,
    setDeleteConfirm,
    handleStatusConfirm,
    handleStatusCancel,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useOverviewConfirm(setActiveCode);

  // ── DeployHistoryModal 数据（源 smartHistory = getContractHistoryApi data[0]）──
  const { data: deployHistory } = useContractDeployHistoryQuery(
    currentTd?.code,
    isModalOpenHistory,
  );

  // ── Tab 回调：tab-contracts 打开部署/升级 Modal ──
  // 源 1252/1279：taskCode=首行三元(upgraded===1?upgradeTaskCode:taskCode)，
  // state=触发行合约包 state（Modal 标题用）。均在此快照，Modal 内部自行拉步骤详情。
  const handleOpenDeployModal = React.useCallback(
    (payload: { taskCode: string; state?: number }) => {
      if (!payload.taskCode) return;
      setDeployModal(payload);
    },
    [],
  );

  const handleDeployModalClose = React.useCallback(() => {
    setDeployModal(null);
  }, []);

  // ── Tab 回调：tab-contracts 打开部署历史 Modal ──
  const handleOpenDeployHistoryModal = React.useCallback(() => {
    setIsModalOpenHistory(true);
  }, []);

  // ── 9 按钮分发（OverviewActionButtons onAction）──
  const handleAction = useOverviewAction({
    currentTd,
    setActive,
    setMintMeltType,
    setMintMeltAsset,
    setStatusConfirm,
    setDeleteConfirm,
  });

  // ── 渲染 ──
  // loading 态：applyList 拉取中（避免空数据误判为 Empty）；骨架块，不写死文案。
  if (applyListLoading && !hasData) {
    return <OverviewShellLoading />;
  }

  // 错误态：拉取失败且无数据（react-query 有旧数据时保留旧数据继续展示）。
  if (applyListError && !hasData) {
    return <OverviewShellError refetchApplyList={refetchApplyList} />;
  }

  // 空页：无数据 → Empty（含 Onboard 按钮）。
  if (!hasData) {
    return <OverviewEmpty onOnboard={handleOnboard} />;
  }

  return (
    <div className="w-full">
      {/* TD 切换条（自建 CustomTab 等价） */}
      <TdSwitcher
        tdList={applyList ?? []}
        activeKey={activeIndex}
        onSelect={handleSelectTd}
        onOnboard={handleOnboard}
      />

      {/* 顶部概览卡 */}
      <OverviewInfoCard td={currentTd} />

      {/* 9 操作按钮 */}
      <OverviewActionButtons
        td={currentTd}
        showMelt={showMelt}
        onAction={handleAction}
      />

      {/* 4 Tab 容器（content 由 td-15/16/17 实现，本任务占位） */}
      <OverviewTabs
        active={active}
        onActiveChange={setActive}
        currentTd={currentTd}
        onOpenDeployModal={handleOpenDeployModal}
        onOpenDeployHistoryModal={handleOpenDeployHistoryModal}
        onOpenAdminWalletModal={handleOpenAdminWalletModal}
      />

      {/* 5 Modal 容器（td-18）：MintMeltModal 已接线，其余 4 Modal 占位 */}
      <OverviewShellModals
        isModalOpen={isModalOpen}
        mintMeltInfo={mintMeltInfo}
        mintMeltType={mintMeltType}
        mintMeltAsset={mintMeltAsset}
        handleMintMeltClose={handleMintMeltClose}
        deployModal={deployModal}
        currentTd={currentTd}
        handleDeployModalClose={handleDeployModalClose}
        isModalOpenHistory={isModalOpenHistory}
        deployHistory={deployHistory}
        setIsModalOpenHistory={setIsModalOpenHistory}
        adminWalletModalOpen={adminWalletModalOpen}
        adminWalletCtx={adminWalletCtx}
        setAdminWalletModalOpen={setAdminWalletModalOpen}
        setGeneratedWallet={setGeneratedWallet}
        handleGenerateWallet={handleGenerateWallet}
        generatedWallet={generatedWallet}
        consumeGeneratedWallet={consumeGeneratedWallet}
        adminWalletRow={adminWalletRow}
        generateIsModalOpen={generateIsModalOpen}
        setGenerateIsModalOpen={setGenerateIsModalOpen}
        isRigsecModalOpen={isRigsecModalOpen}
        setIsRigsecModalOpen={setIsRigsecModalOpen}
      />

      {/* Disable/Enable/Delete 二次确认（收口 td-14 gap，替代源 antd modal.confirm） */}
      <OverviewConfirmDialogs
        statusConfirm={statusConfirm}
        deleteConfirm={deleteConfirm}
        statusPending={statusPending}
        deletePending={deletePending}
        handleStatusConfirm={handleStatusConfirm}
        handleStatusCancel={handleStatusCancel}
        handleDeleteConfirm={handleDeleteConfirm}
        handleDeleteCancel={handleDeleteCancel}
      />
    </div>
  );
}
