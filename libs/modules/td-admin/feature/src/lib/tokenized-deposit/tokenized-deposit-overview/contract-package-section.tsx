/**
 * ContractPackageSection — 合约部署 Tab 合约包表区块 + 内联部署/升级按钮。
 *
 * 源: tab-contracts.tsx 75-76（DATETIME_FMT，与 contract-detail-section 共用）、
 * 197-429（合约包表 useContractPackageQuery + DeploymentHistory 按钮 +
 * ContractDeployAction 内联按钮分支）。
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { Button, DataTable } from '@myorg/shared/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { PermissionGuard, usePermission } from '@myorg/shared/util-auth';
import { formatAdminTimestamp } from '../../format-admin-time';
import {
  EMPTY_DISPLAY,
  TD_PERMISSIONS,
} from '@myorg/modules/td-admin/data-access';
import {
  useContractPackageQuery,
  type ApplyListItem,
  type ContractPackageItem,
} from '@myorg/modules/td-admin/data-access';
import {
  TokenizedDepositCopy,
  TokenizedDepositStatusBadge,
} from '..';


// ═══════════════════════════════════════════════════════════════════
// 合约包表（useContractPackageQuery）+ DeploymentHistory 按钮
// ═══════════════════════════════════════════════════════════════════

interface ContractPackageSectionProps {
  td: ApplyListItem;
  onOpenDeployModal: (payload: {
    taskCode: string;
    state?: number;
  }) => void;
  onOpenDeployHistoryModal: () => void;
}

/**
 * 合约包表区块。
 *
 * endpoint: POST /api/manage/v1/td/contract/latestInfo（getNewSmartListApi）。
 * body: stablecoinCode（源 getUsablePrice.code）。源 Table pagination={false}。
 */
export function ContractPackageSection({
  td,
  onOpenDeployModal,
  onOpenDeployHistoryModal,
}: ContractPackageSectionProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const params = React.useMemo(
    () => ({ stablecoinCode: td?.code ?? '' }),
    [td?.code],
  );

  const query = useContractPackageQuery(params);
  const rows = query.data ?? [];
  const isLoading = query.isLoading || query.isFetching;

  // taskCode 源（首行 = newSmart[0]，合约包表通常仅 1 行）。
  const firstRow = rows[0];

  const handleDeploy = React.useCallback(
    // 部署 taskCode 统一取首行 firstRow（合约包表通常仅 1 行，源 newSmart[0] 三元
    // 逻辑）；state 透传触发行（源 data.state），供 Modal 标题 contractState 分支。
    () => {
      if (!firstRow) return;
      // type===1 且首行已升级 → upgradeTaskCode；否则 taskCode（源 newSmart[0]?.upgraded===1 三元）。
      const taskCode =
        td?.type === 1 && firstRow.upgraded === 1
          ? firstRow.upgradeTaskCode
          : firstRow.taskCode;
      if (taskCode) onOpenDeployModal({ taskCode, state: firstRow.state });
    },
    [firstRow, td?.type, onOpenDeployModal],
  );

  const columns = React.useMemo<ColumnDef<ContractPackageItem>[]>(
    () => [
      {
        // tokenized_deposit_0123：packageName
        accessorKey: 'packageName',
        header: t('tokenized_deposit_0123'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.packageName} />
        ),
      },
      {
        // tokenized_deposit_0068：blockchainName
        accessorKey: 'blockchainName',
        header: t('tokenized_deposit_0068'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.blockchainName} />
        ),
      },
      {
        // tokenized_deposit_0023：packageVersion
        accessorKey: 'packageVersion',
        header: t('tokenized_deposit_0023'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.packageVersion} />
        ),
      },
      {
        // tokenized_deposit_0124：contractLanguage
        accessorKey: 'contractLanguage',
        header: t('tokenized_deposit_0124'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.contractLanguage} />
        ),
      },
      {
        // tokenized_deposit_0125：releaseTime
        accessorKey: 'releaseTime',
        header: t('tokenized_deposit_0125'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatAdminTimestamp(val) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // tokenized_deposit_0126：deployTime
        accessorKey: 'deployTime',
        header: t('tokenized_deposit_0126'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatAdminTimestamp(val) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // PUB_Status：smart_contract_status_{state}
        accessorKey: 'state',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <TokenizedDepositStatusBadge
            dimension="smartContract"
            status={getValue<number>()}
          />
        ),
      },
      {
        // PUB_Action：内联部署/升级按钮（type===1 / type!==1 两分支）
        id: 'actions',
        header: t('PUB_Action'),
        cell: ({ row }) => (
          <ContractDeployAction
            row={row.original}
            tdType={td?.type}
            onDeploy={handleDeploy}
          />
        ),
      },
    ],
    [t, handleDeploy],
  );

  return (
    <section>
      {/* 标题区 + DeploymentHistory 按钮（源 CustomTableTitle.button） */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">
          {t('tokenized_deposit_0022')}
        </h3>
        <PermissionGuard permission={TD_PERMISSIONS.DEPLOYMENT_HISTORY}>
          {/* 源 disabled: getUsablePrice?.type !== 1 */}
          <Button
            variant="outline"
            disabled={td?.type !== 1}
            onClick={onOpenDeployHistoryModal}
          >
            {t('Router_0003_11')}
          </Button>
        </PermissionGuard>
      </div>
      {query.isError && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-3 text-sm text-destructive"
        >
          <span>{t('td_query_load_failed')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
          >
            {t('td_retry')}
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage={t('empty')}
      />
    </section>
  );
}

/**
 * 合约包表 action 单元格内联按钮（源 1243-1289 行逐分支）。
 *
 * 见文件头注释「内联部署按钮分支」。label 读当前行 state，
 * taskCode 取首行（newSmart[0]）。tdType 来自 TD 标题行（源 getUsablePrice?.type），
 * 不读 row.__tdType（该注入标记从未被赋值，升级型 TD 分支曾恒走普通部署分支）。
 * type===1 无权限时源渲染 disabled+Tooltip 按钮（非隐藏），故用 usePermission 判定。
 */
function ContractDeployAction({
  row,
  tdType,
  onDeploy,
}: {
  row: ContractPackageItem;
  tdType?: number;
  onDeploy: () => void;
}): React.JSX.Element | null {
  const t = useTranslations('modules.tokenized-deposit');
  const hasUpgradeDeployPerm = usePermission(TD_PERMISSIONS.UPGRADE_DEPLOY);
  const hasDeployPerm = usePermission(TD_PERMISSIONS.DEPLOY);

  if (tdType === 1) {
    // 源：data.upgraded===1 && getLimt(b010a...) → 主按钮；否则 disabled + Tooltip。
    return row.upgraded === 1 && hasUpgradeDeployPerm ? (
      <Button size="sm" onClick={onDeploy}>
        {/* state===1 → Details(Router_021)；否则 Upgrade(Router_0003_13) */}
        {row.state === 1 ? t('Router_021') : t('Router_0003_13')}
      </Button>
    ) : (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* TooltipTrigger 需能 ref 转发；span 包裹避免 Button asChild 冲突 */}
            <span className="inline-flex">
              <Button size="sm" disabled>
                {t('Router_0003_13')}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('tokenized_deposit_0104')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // type!==1 分支：有 DEPLOY 权限才渲染按钮，否则 null（源码为 null）。
  return hasDeployPerm ? (
    <Button size="sm" onClick={onDeploy}>
      {/* state===0 → Deploy(Router_0003_12)；否则 Details(Router_021) */}
      {row.state === 0 ? t('Router_0003_12') : t('Router_021')}
    </Button>
  ) : null;
}
