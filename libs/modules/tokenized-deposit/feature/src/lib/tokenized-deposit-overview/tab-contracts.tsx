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
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { Button, DataTable, Progress } from '@myorg/shared/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import {
  APPLY_STATUS,
  EMPTY_DISPLAY,
  TD_PERMISSIONS,
} from '@myorg/modules/tokenized-deposit/util';
import {
  useContractPackageQuery,
  useContractDetailQuery,
  type ApplyListItem,
  type ContractDetailItem,
  type ContractPackageItem,
} from '@myorg/modules/tokenized-deposit/data-access';
import {
  TokenizedDepositCopy,
  TokenizedDepositStatusBadge,
} from '@myorg/modules/tokenized-deposit/ui';

/** 时间戳格式（对齐源 formatTimestamp → 'YYYY-MM-DD HH:mm:ss'）。 */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** Steps 三步标题（源码硬编码英文，按需补 i18n 可后续迭代）。 */
const STEP_LABELS = ['Create', 'Approval', 'Deployment Contract'] as const;

/**
 * 由 applyStatus 推导 Steps current（对齐源 1149-1155 行）。
 *
 * applyStatus===5(REVIEWING) → 1（Approval）
 * applyStatus===20(PENDING_DEPLOY) → 2（Deployment Contract）
 * 其它 → 3（Deployment Contract，末步/完成态）
 */
function deriveStepCurrent(applyStatus?: number): number {
  if (applyStatus === APPLY_STATUS.REVIEWING) return 1;
  if (applyStatus === APPLY_STATUS.PENDING_DEPLOY) return 2;
  return 3;
}

export interface OverviewContractsTabProps {
  /** 当前选中 TD（源 getUsablePrice / stablecoinInfo）。提供 type/applyStatus/code。 */
  td: ApplyListItem;
  /**
   * 打开部署/升级 Modal 回调（td-18 实现）。
   * 传入 taskCode（部署用 taskCode，或升级型 TD 的 upgradeTaskCode）。
   */
  onOpenDeployModal: (taskCode: string) => void;
  /** 打开部署历史 Modal 回调（td-18 实现）。 */
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

// ═══════════════════════════════════════════════════════════════════
// Steps（type===0）：Create / Approval / Deployment Contract
// ═══════════════════════════════════════════════════════════════════

/**
 * 三步指示器（shared/ui 无 Steps，用 flex + Progress 自建）。
 *
 * current 为 0-base：0=Create、1=Approval、2=Deployment Contract。
 * 当前步及之前标为主色 + 勾，未来步标灰。对齐源 antd Steps size="small"。
 */
function DeploymentSteps({ current }: { current: number }): React.JSX.Element {
  return (
    <ol className="mx-auto my-2 flex w-[80%] items-center">
      {STEP_LABELS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            className="flex flex-1 items-center last:flex-none"
            aria-current={active ? 'step' : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                className={[
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  done || active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground',
                ].join(' ')}
              >
                {done ? '✓' : index + 1}
              </span>
              <span
                className={[
                  'text-sm font-medium',
                  done || active ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {index < STEP_LABELS.length - 1 ? (
              <Progress
                value={done ? 100 : 0}
                className="mx-3 h-1 flex-1"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 合约包表（useContractPackageQuery）+ DeploymentHistory 按钮
// ═══════════════════════════════════════════════════════════════════

interface ContractPackageSectionProps {
  td: ApplyListItem;
  onOpenDeployModal: (taskCode: string) => void;
  onOpenDeployHistoryModal: () => void;
}

/**
 * 合约包表区块。
 *
 * endpoint: POST /api/manage/v1/td/contract/latestInfo（getNewSmartListApi）。
 * body: stablecoinCode（源 getUsablePrice.code）。源 Table pagination={false}。
 */
function ContractPackageSection({
  td,
  onOpenDeployModal,
  onOpenDeployHistoryModal,
}: ContractPackageSectionProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const params = React.useMemo(
    () => ({ pageNum: 1, pageSize: 100, stablecoinCode: td?.code ?? '' }),
    [td?.code],
  );

  const query = useContractPackageQuery(params);
  const rows = query.data?.rows ?? [];
  const isLoading = query.isLoading || query.isFetching;

  // taskCode 源（首行 = newSmart[0]，合约包表通常仅 1 行）。
  const firstRow = rows[0];

  const handleDeploy = React.useCallback(
    // 部署 taskCode 统一取首行 firstRow（合约包表通常仅 1 行，源 newSmart[0] 三元
    // 逻辑）。onDeploy 不需要 per-row 参数，故契约为 () => void，避免 unused 参数。
    () => {
      if (!firstRow) return;
      // type===1 且首行已升级 → upgradeTaskCode；否则 taskCode（源 newSmart[0]?.upgraded===1 三元）。
      const taskCode =
        td?.type === 1 && firstRow.upgraded === 1
          ? firstRow.upgradeTaskCode
          : firstRow.taskCode;
      if (taskCode) onOpenDeployModal(taskCode);
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
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
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
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
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
          <ContractDeployAction row={row.original} onDeploy={handleDeploy} />
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
 * taskCode 取首行（newSmart[0]）。
 */
function ContractDeployAction({
  row,
  onDeploy,
}: {
  row: ContractPackageItem;
  onDeploy: () => void;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  // type===1：升级型 TD
  if (row.__tdType === 1) {
    // 标记由外层注入（见下）；此处仅按 upgraded + 权限分支。
  }

  return (
    <>
      {/* type===1 分支 */}
      {row.__tdType === 1 ? (
        row.upgraded === 1 ? (
          <PermissionGuard permission={TD_PERMISSIONS.UPGRADE_DEPLOY}>
            <Button
              size="sm"
              onClick={() => onDeploy()}
            >
              {/* state===1 → Details(Router_021)；否则 Upgrade(Router_0003_13) */}
              {row.state === 1 ? t('Router_021') : t('Router_0003_13')}
            </Button>
          </PermissionGuard>
        ) : (
          // upgraded!==1 或无 UPGRADE_DEPLOY 权限 → disabled + Tooltip
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
        )
      ) : (
        /* type!==1 分支：有 DEPLOY 权限才渲染按钮，否则 null（源码为 null） */
        <PermissionGuard permission={TD_PERMISSIONS.DEPLOY}>
          <Button size="sm" onClick={() => onDeploy()}>
            {/* state===0 → Deploy(Router_0003_12)；否则 Details(Router_021) */}
            {row.state === 0 ? t('Router_0003_12') : t('Router_021')}
          </Button>
        </PermissionGuard>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 合约明细表（useContractDetailQuery）
// ═══════════════════════════════════════════════════════════════════

/**
 * 合约明细表区块。
 *
 * endpoint: POST /api/manage/v1/td/contract/detail（getContractInfoApi）。
 * body: stablecoinCode。源 Table pagination={false}。
 */
function ContractDetailSection({
  td,
}: {
  td: ApplyListItem;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const params = React.useMemo(
    () => ({ pageNum: 1, pageSize: 100, stablecoinCode: td?.code ?? '' }),
    [td?.code],
  );

  const query = useContractDetailQuery(params);
  const rows = query.data?.rows ?? [];
  const isLoading = query.isLoading || query.isFetching;

  const columns = React.useMemo<ColumnDef<ContractDetailItem>[]>(
    () => [
      {
        // tokenized_deposit_0016：contractName
        accessorKey: 'contractName',
        header: t('tokenized_deposit_0016'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.contractName} />
        ),
      },
      {
        // tokenized_deposit_0023：contractVersion
        accessorKey: 'contractVersion',
        header: t('tokenized_deposit_0023'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.contractVersion} />
        ),
      },
      {
        // tokenized_deposit_0024：contractAddress
        accessorKey: 'contractAddress',
        header: t('tokenized_deposit_0024'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.contractAddress} />
        ),
      },
      {
        // tokenized_deposit_0172：contractHash（空串 → '--'）
        accessorKey: 'contractHash',
        header: t('tokenized_deposit_0172'),
        cell: ({ row }) => {
          const hash = row.original.contractHash;
          if (hash === '' || hash == null) {
            return <span>{EMPTY_DISPLAY}</span>;
          }
          return <TokenizedDepositCopy text={hash} />;
        },
      },
      {
        // tokenized_deposit_0126：deployTime
        accessorKey: 'deployTime',
        header: t('tokenized_deposit_0126'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
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
    ],
    [t],
  );

  return (
    <section>
      {/* 源：标题 tokenized_deposit_0127「Smart Contract Information」 */}
      <h3 className="mb-3 ml-1 text-base font-semibold">
        {t('tokenized_deposit_0127')}
      </h3>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage={t('empty')}
      />
    </section>
  );
}
