/**
 * OverviewShell 的 4 Tab 容器（TabsList + 铸销记录/合约部署/角色钱包/操作记录
 * TabsContent），Tab key 定义走 TAB_DEFS。
 * 源: overview-shell.tsx 581-629
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@myorg/shared/ui';
import type { ApplyListItem } from '@myorg/modules/td-admin/data-access';
import { OverviewRecordsTab } from './tab-records';
import { OverviewContractsTab } from './tab-contracts';
import {
  OverviewWalletsTab,
  type AdminWalletModalActionContext,
} from './tab-wallets';
import { OverviewOperationRecordsTab } from './tab-operation-records';
import {
  TAB_DEFS,
  tab1LabelKey,
  type OverviewTabKey,
} from './overview-shell-helpers';

interface OverviewTabsProps {
  /** 当前选中 Tab key（源 active）。 */
  active: OverviewTabKey;
  onActiveChange: (key: OverviewTabKey) => void;
  currentTd: ApplyListItem | undefined;
  /** tab-contracts 打开部署/升级 Modal。 */
  onOpenDeployModal: (payload: { taskCode: string; state?: number }) => void;
  /** tab-contracts 打开部署历史 Modal。 */
  onOpenDeployHistoryModal: () => void;
  /** tab-wallets 打开管理员钱包 Modal。 */
  onOpenAdminWalletModal: (ctx: AdminWalletModalActionContext) => void;
}

/** 渲染 4 Tab 容器（content 由 td-15/16/17 实现）。 */
export function OverviewTabs({
  active,
  onActiveChange,
  currentTd,
  onOpenDeployModal,
  onOpenDeployHistoryModal,
  onOpenAdminWalletModal,
}: OverviewTabsProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <>
      <Tabs value={active} onValueChange={(v) => onActiveChange(v as OverviewTabKey)}>
        <TabsList>
          {TAB_DEFS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {t(tab.key === '1' ? tab1LabelKey(currentTd) : tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab1：铸销记录 / SP / MMF Summary（td-15） */}
        <TabsContent value="1">
          {currentTd ? (
            <OverviewRecordsTab key={currentTd.code} td={currentTd} />
          ) : null}
        </TabsContent>

        {/* Tab2：合约部署（td-16） */}
        <TabsContent value="2">
          {currentTd ? (
            <OverviewContractsTab
              key={currentTd.code}
              td={currentTd}
              onOpenDeployModal={onOpenDeployModal}
              onOpenDeployHistoryModal={onOpenDeployHistoryModal}
            />
          ) : null}
        </TabsContent>

        {/* Tab3：角色钱包 customTable2（td-17） */}
        <TabsContent value="3">
          {currentTd ? (
            <OverviewWalletsTab
              key={currentTd.code}
              td={currentTd}
              onOpenAdminWalletModal={onOpenAdminWalletModal}
            />
          ) : null}
        </TabsContent>

        {/* Tab4：操作记录（td-17） */}
        <TabsContent value="4">
          {currentTd ? (
            <OverviewOperationRecordsTab
              key={currentTd.code}
              td={currentTd}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </>
  );
}
