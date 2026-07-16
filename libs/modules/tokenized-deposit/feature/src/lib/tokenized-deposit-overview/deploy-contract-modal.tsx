/**
 * DeployContractModal — 合约部署/升级 Modal（步骤进度）。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx：
 * - `getDeployInfo`（源 157-164）：拉部署步骤详情（data[0].stepDetailList）。
 * - `getDeploy`（源 165-184）：部署/升级接口调用。
 * - CustomModal（源 2132-2255）：deployInfo 展示 + 部署按钮 + stepInfo 进度。
 *
 * ## 步骤进度（stepInfo，源 1669-1696）
 *
 * stepDetailList 逐项渲染：Step N + smartContractArr[index] 标题 + Progress 百分比 +
 * 状态图标（3=待处理 FieldTimeOutlined、4=进行中 LoadingOutlined、其它=完成 CheckCircle）。
 * 标题的 '****' 占位按 delopySatus(=deployType) 替换为 Upgrade/Deploy。
 *
 * ## 部署/升级分支（源 2179-2211）
 *
 * deployState===0（未部署）时：
 * - deployType===1 → 升级分支（权限 UPGRADE_DEPLOY b010a498...）：调 getDeployInfo
 *   拉 upgradeTaskCode 步骤。
 * - 其它 → 部署分支（权限 DEPLOY 14f35a31...）：调 useDeployContractMutation(taskCode)
 *   发起部署。
 *
 * ## 与源差异
 *
 * - antd CustomModal → shared/ui Dialog。
 * - antd Progress → shared/ui Progress（percent prop）。
 * - antd icons（FieldTime/Loading/CheckCircle）→ lucide-react（Clock/Loader2/CheckCircle2）。
 * - getDeployInfo/getDeploy 源在 index 内联，这里 props.taskCode 透传 + useDeployStepDetailQuery。
 * - 源 stepInfo 标题 smartContractArr[index].replace('****', ...)，迁移同逻辑。
 *
 * ## stepDetailList 字段（源 el.state / el.deployProcess）
 *
 * 源 stepDetailList 元素字段为 `state`（状态 3/4/其它）+ `deployProcess`（0-1 进度）。
 * model.ts StepItem 定义为 status/name（与源不符，属 model 不全），故本组件用
 * 局部 StepRow 类型断言访问真实字段，避免改 model（surgical scope）。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Clock,
  Info,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Progress,
} from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { TD_PERMISSIONS } from '@myorg/modules/tokenized-deposit/util';
import {
  useDeployContractMutation,
  useDeployStepDetailQuery,
} from '@myorg/modules/tokenized-deposit/data-access';

/** stepDetailList 真实行（源 el.state / el.deployProcess）。 */
interface StepRow {
  state?: number;
  deployProcess?: number;
}

/** 步骤标题数组（源 smartContractArr，tokenized_deposit_0040/0038/0039/0040_2/0040_1）。 */
const STEP_TITLE_KEYS = [
  'tokenized_deposit_0040',
  'tokenized_deposit_0038',
  'tokenized_deposit_0039',
  'tokenized_deposit_0040_2',
  'tokenized_deposit_0040_1',
];

export interface DeployContractModalProps {
  /** Modal 开关。 */
  open: boolean;
  /** taskCode（拉步骤详情 + 部署/升级 body）。 */
  taskCode: string;
  /**
   * 部署类型（源 deployInfo.deployType）：1=升级 / 其它=部署。
   * 决定标题文案 + 部署/升级分支。
   */
  deployType: number;
  /**
   * deployInfo 展示字段（源 getDeployInfo 拉取的 data[0]）。
   * tdName / blockchainName / packageName / contractVersion。
   */
  deployInfo: {
    tdName?: string;
    blockchainName?: string;
    packageName?: string;
    contractVersion?: string;
  };
  /**
   * 部署状态（源 deployInfo.deployState）：0=未部署（显示部署/升级按钮）。
   */
  deployState?: number;
  /** 升级时拉升级 taskCode 步骤（源 getDeployInfo(upgradeTaskCode)）。 */
  upgradeTaskCode?: string;
  /** 升级时拉 upgradeTaskCode 步骤的回调（Shell 调 getDeployInfo）。 */
  onUpgrade?: (upgradeTaskCode: string) => void;
  /** 取消回调。 */
  onCancel: () => void;
}

/**
 * 单步渲染（标题 + Progress + 状态图标）。
 *
 * 状态硬色（源 2232-2248）：
 * - 3 → FieldTime（Clock），text-theme。
 * - 4 → Loading（Loader2），text-[#F4AA00]。
 * - 其它 → CheckCircle（CheckCircle2），text-[#87ca87]。
 */
function StepItemView({
  index,
  title,
  progress,
  state,
}: {
  index: number;
  title: string;
  progress: number;
  state?: number;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1">
        <div>
          <span className="font-semibold">Step {index + 1}:</span> {title}
        </div>
        <div className="mt-2 pl-6">
          <Progress value={progress} />
        </div>
      </div>
      <div className="flex items-center text-primary">
        {state === 3 ? (
          <span className="flex items-center">
            <Clock className="mr-1 h-4 w-4" />
            {t(`step_status_${state}`)}
          </span>
        ) : state === 4 ? (
          <span className="flex items-center text-[#F4AA00]">
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            {t(`step_status_${state}`)}
          </span>
        ) : (
          <span className="flex items-center text-[#87ca87]">
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {t(`step_status_${state ?? 0}`)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * 合约部署/升级 Modal。
 *
 * 用法：
 * ```tsx
 * <DeployContractModal
 *   open={isModalOpenDelopy}
 *   taskCode={taskCode}
 *   deployType={deployInfo?.deployType ?? 0}
 *   deployInfo={deployInfo ?? {}}
 *   deployState={deployInfo?.deployState}
 *   upgradeTaskCode={deployInfo?.upgradeTaskCode}
 *   onUpgrade={(code) => refetchStep(code)}
 *   onCancel={() => setIsModalOpenDelopy(false)}
 * />
 * ```
 */
export function DeployContractModal({
  open,
  taskCode,
  deployType,
  deployInfo,
  deployState,
  upgradeTaskCode,
  onUpgrade,
  onCancel,
}: DeployContractModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const { mutateAsync: deployAsync, isPending } = useDeployContractMutation();

  // 拉步骤详情（源 getDeployInfo(taskCode)）。
  const { data: stepDetail } = useDeployStepDetailQuery(
    open && taskCode ? { taskCode } : undefined,
  );

  // stepDetailList（源 stepDetailList，真实字段 state/deployProcess）。
  const stepList = (stepDetail?.stepDetailList ?? []) as unknown as StepRow[];

  // 部署/升级文案（源 delopySatus===1 ? Upgrade : Deploy）。
  const actionWord = deployType === 1 ? t('PUB_Upgrade') : t('PUB_Deploy');

  // 标题（源 2136-2146）：type===1 升级分支 / 其它部署分支。
  const title =
    deployType === 1 ? t('tokenized_deposit_0131') : t('tokenized_deposit_0031');

  // 部署按钮回调（源 2187-2195）：getDeploy(taskCode, 'showSuccess')。
  const handleDeploy = async () => {
    try {
      await deployAsync({ taskCode });
      onCancel();
    } catch {
      // mutation 错误由 apiClient 拦截器统一 toast。
    }
  };

  // 升级按钮回调（源 2200-2208）：getDeployInfo(upgradeTaskCode)。
  const handleUpgrade = () => {
    if (upgradeTaskCode && onUpgrade) {
      onUpgrade(upgradeTaskCode);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        {/* deployInfo 展示（源 2153-2178） */}
        <div className="mb-4 ml-2 flex flex-col">
          <div className="mb-3 flex">
            <span className="w-2/5 text-left font-bold">
              {t('tokenized_deposit_0005')}:
            </span>
            <span>{deployInfo?.tdName ?? '--'}</span>
          </div>
          <div className="mb-3 flex">
            <span className="w-2/5 text-left font-bold">
              {t('tokenized_deposit_0007')}:
            </span>
            <span>{deployInfo?.blockchainName ?? '--'}</span>
          </div>
          <div className="mb-3 flex">
            <span className="w-2/5 text-left font-bold">
              {t('tokenized_deposit_0033')}:
            </span>
            <span>{deployInfo?.packageName ?? '--'}</span>
          </div>
          <div className="mb-3 flex">
            <span className="w-2/5 text-left font-bold">
              {t('tokenized_deposit_0034')}:
            </span>
            <span>{deployInfo?.contractVersion ?? '--'}</span>
          </div>
        </div>

        {/* 部署/升级按钮（源 2179-2211，deployState===0 时显示） */}
        {deployState === 0 ? (
          deployType === 1 ? (
            <PermissionGuard permission={TD_PERMISSIONS.UPGRADE_DEPLOY}>
              <div className="mb-2 flex justify-center">
                <Button onClick={handleUpgrade}>{t('Router_0003_13')}</Button>
              </div>
            </PermissionGuard>
          ) : (
            <PermissionGuard permission={TD_PERMISSIONS.DEPLOY}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex w-4/5 items-center">
                  <Info className="mr-2 h-5 w-5 shrink-0 text-primary" />
                  <span>{t('tokenized_deposit_0035')}</span>
                </div>
                <Button disabled={isPending} onClick={handleDeploy}>
                  {t('Router_0003_12')}
                </Button>
              </div>
            </PermissionGuard>
          )
        ) : null}

        {/* 步骤进度（源 2212-2253） */}
        <div className="p-2">
          <div className="mb-3 text-base font-bold">
            {deployType === 1
              ? t('tokenized_deposit_0041')
              : t('tokenized_deposit_0036')}
            :
          </div>
          <div className="rounded-xl bg-muted p-2">
            {stepList.map((row, index) => {
              // 标题：smartContractArr[index].replace('****', actionWord)。
              const titleKey = STEP_TITLE_KEYS[index] ?? STEP_TITLE_KEYS[0];
              const itemTitle = t(titleKey).replace('****', actionWord);
              const progress = Math.round(
                Number(row.deployProcess ?? 0) * 100,
              );
              return (
                <StepItemView
                  key={index}
                  index={index}
                  title={itemTitle}
                  progress={progress}
                  state={row.state}
                />
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-row justify-center sm:justify-center">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('PUB_Cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
