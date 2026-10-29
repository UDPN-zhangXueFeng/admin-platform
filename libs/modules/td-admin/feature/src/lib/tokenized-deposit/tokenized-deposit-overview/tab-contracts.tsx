/**
 * OverviewContractsTab — 运营总览页 Tab2 合约部署。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的 getItem() Tab2
 * （active==='2'，tokenized_deposit_0017「Smart Contracts」）。
 *
 * ## 结构（对齐源 1142-1442 行）
 *
 * 1. Steps（仅 type===0 TD）：Create / Approval / Deployment Contract 三步，
 *    current 由 applyStatus 推导（5→1 / 20→2 / 其它→3）。
 * 2. 合约包表标题区 + DeploymentHistory 按钮（权限 DEPLOYMENT_HISTORY，
 *    type!==1 时 disabled）。
 * 3. 合约包表（useContractPackageQuery，stablecoinCode）：
 *    packageName / blockchainName / packageVersion / contractLanguage /
 *    releaseTime / deployTime / state(Badge smartContract) / action。
 * 4. 合约明细表（useContractDetailQuery，stablecoinCode）：
 *    contractName / contractVersion / contractAddress / contractHash(空→'--') /
 *    deployTime / state(Badge smartContract)。
 *
 * ## 内联部署按钮分支（对齐源 1243-1289 行，逐字符）
 *
 * - type===1（升级型 TD）：
 *   - data.upgraded===1 且权限 UPGRADE_DEPLOY → 主按钮，
 *     label = state===1 ? Router_021(Details) : Router_0003_13(Upgrade)，
 *     点击 → onOpenDeployModal(首行 upgraded===1 ? upgradeTaskCode : taskCode)。
 *   - 否则 → disabled 主按钮（label Router_0003_13）+ Tooltip tokenized_deposit_0104。
 * - type!==1（普通部署 TD）：
 *   - 权限 DEPLOY → 主按钮，
 *     label = state===0 ? Router_0003_12(Deploy) : Router_021(Details)，
 *     点击 → onOpenDeployModal(首行 taskCode)。
 *   - 否则 → 不渲染（源码为 null）。
 *
 * taskCode/upgradeTaskCode 取「首行」（源码 newSmart[0]）；合约包表通常仅 1 行，
 * 首行 = 当前行。label/state 读取当前行 data，与源一致。
 *
 * ## 死代码（不迁移）
 *
 * - customTable 的 `to` 列整列注释（属 Tab1，非本 tab）。
 * - 源 Step 顶部还有一段基于 stepDetailList 的步骤进度（属于部署 Modal td-18，
 *   非本 tab 顶部 Steps）。本 tab 顶部仅渲染三步指示器。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import type { ApplyListItem } from '@myorg/modules/td-admin/data-access';
import { ContractDetailSection } from './contract-detail-section';
import { ContractPackageSection } from './contract-package-section';
import {
  DeploymentSteps,
  deriveStepCurrent,
} from './contract-deployment-steps';

export interface OverviewContractsTabProps {
  /** 当前选中 TD（源 getUsablePrice / stablecoinInfo）。提供 type/applyStatus/code。 */
  td: ApplyListItem;
  /**
   * 打开部署/升级 Modal 回调（td-18 实现）。
   * taskCode：源 newSmart[0] 首行三元（upgraded===1 ? upgradeTaskCode : taskCode）；
   * state：触发行的合约包 state（源 data.state，Modal 标题 contractState 用）。
   */
  onOpenDeployModal: (payload: { taskCode: string; state?: number }) => void;
  /** 打开部署历史 Modal 回调。 */
  onOpenDeployHistoryModal: () => void;
}

/**
 * 渲染 Tab2 合约部署。
 *
 * 用法（在 OverviewShell TabsContent value="2" 内）：
 * ```tsx
 * <OverviewContractsTab
 *   td={currentTd}
 *   onOpenDeployModal={(taskCode) => setDeployTaskCode(taskCode)}
 *   onOpenDeployHistoryModal={() => setDeployHistoryOpen(true)}
 * />
 * ```
 */
export function OverviewContractsTab({
  td,
  onOpenDeployModal,
  onOpenDeployHistoryModal,
}: OverviewContractsTabProps): React.JSX.Element {
  const showSteps = td?.type === 0;
  const stepCurrent = deriveStepCurrent(td?.applyStatus);

  return (
    <div className="flex flex-col gap-6 py-4">
      {showSteps ? <DeploymentSteps current={stepCurrent} /> : null}

       <ContractPackageSection
         td={td}
         onOpenDeployModal={onOpenDeployModal}
         onOpenDeployHistoryModal={onOpenDeployHistoryModal}
       />

      <ContractDetailSection td={td} />
    </div>
  );
}

