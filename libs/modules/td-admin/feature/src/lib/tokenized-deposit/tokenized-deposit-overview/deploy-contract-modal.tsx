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
import { toast } from 'sonner';
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
import { usePermission } from '@myorg/shared/util-auth';
import { TD_PERMISSIONS } from '@myorg/modules/td-admin/data-access';
import {
  useDeployContractMutation,
  useDeployStepDetailQuery,
} from '@myorg/modules/td-admin/data-access';

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
  /**
   * 打开时捕获的原始任务编码（源 newSmart[0] 首行三元：upgraded===1
   * ? upgradeTaskCode : taskCode）。升级点击后仅内部切换 activeTaskCode，
   * 本 prop 恒为原始值（源 2148: taskCode={taskCode} 不变）。
   */
  taskCode: string;
  /** TD 类型（源 getUsablePrice?.type）：1=升级型 / 其它=普通部署。驱动标题 + 按钮分支。 */
  tdType?: number;
  /** 触发行的合约包 state（源 data.state）：驱动标题 Router_021/0131 与 0031 分支。 */
  contractState?: number;
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
 * 用法（Shell）：
 * ```tsx
 * <DeployContractModal
 *   open={deployModal != null}
 *   taskCode={deployModal?.taskCode ?? ''}
 *   tdType={currentTd?.type}
 *   contractState={deployModal?.state}
 *   onCancel={() => setDeployModal(null)}
 * />
 * ```
 *
 * 源差异：旧实现由 shell 级 deployInfo 驱动（deployType/deployState/
 * upgradeTaskCode props + onUpgrade 回调），升级点击后 upgradeTaskCode 从未
 * 回灌查询 key → 步骤区一直显示部署任务。现改为 Modal 内部 activeTaskCode
 * state（taskCode prop 仍为原始值，与源一致），升级点击仅切换内部查询 key，
 * 自包含无 shell 依赖；步骤详情真身（tdName/deployState/deployType/
 * upgradeTaskCode）也全部来自本 Modal 查询（源 getDeployInfo data[0]）。
 */
export function DeployContractModal({
  open,
  taskCode,
  tdType,
  contractState,
  onCancel,
}: DeployContractModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const { mutateAsync: deployAsync, isPending } = useDeployContractMutation();
  const hasUpgradeDeployPerm = usePermission(TD_PERMISSIONS.UPGRADE_DEPLOY);
  const hasDeployPerm = usePermission(TD_PERMISSIONS.DEPLOY);

  // 内部激活任务编码（源：taskCode prop 恒原始值，升级点击 → getDeployInfo(upgradeTaskCode)）。
  const [activeTaskCode, setActiveTaskCode] = React.useState(taskCode);
  React.useEffect(() => {
    if (open) setActiveTaskCode(taskCode);
  }, [open, taskCode]);

  // 拉步骤详情（源 getDeployInfo(activeTaskCode)）。
  const stepQuery = useDeployStepDetailQuery(
    open && activeTaskCode ? { taskCode: activeTaskCode } : undefined,
  );
  const rawDetail = stepQuery.data;

  // stepDetailList 真实字段 state/deployProcess；顶层真实字段 deployState/
  // deployType/upgradeTaskCode（model 未全，局部断言，surgical scope）。
  type StepDetailExtra = {
    deployState?: number | string;
    deployType?: number | string;
    upgradeTaskCode?: string;
    tdName?: string;
    blockchainName?: string;
    packageName?: string;
    contractVersion?: string;
  };
  const detail = (rawDetail ?? undefined) as
    | (NonNullable<typeof rawDetail> & StepDetailExtra)
    | undefined;
  const stepList = (detail?.stepDetailList ?? []) as unknown as StepRow[];

  const isUpgrade = Number(detail?.deployType) === 1;
  const showActionButtons = Number(detail?.deployState) === 0;

  // 部署/升级文案（源 delopySatus===1 ? Upgrade : Deploy）。
  const actionWord = isUpgrade ? t('PUB_Upgrade') : t('PUB_Deploy');

  // 标题（源 2136-2146）：tdType===1 升级分支 / 其它部署分支。
  const title =
    tdType === 1
      ? contractState === 1
        ? t('Router_021')
        : t('tokenized_deposit_0131')
      : contractState === 0
        ? t('tokenized_deposit_0031')
        : t('Router_021');

  // 部署回调（源 2187-2195 getDeploy(taskCode, 'showSuccess')）：body 用原始
  // taskCode；成功后 Modal 保持打开（源仅 toast + 步骤刷新，无关闭）。
  const handleDeploy = async () => {
    try {
      await deployAsync({ taskCode });
      // 源 message.success（PUB_Success 模板 **** → PUB_Submitted）。
      toast.success(t('PUB_Success').replace('****', t('PUB_Submitted')));
    } catch {
      // mutation 错误由 apiClient 拦截器统一 toast。
    }
  };

  // 升级回调（源 2200-2208）：切换内部查询 key 到 upgradeTaskCode。
  const handleUpgrade = () => {
    const upgradeTaskCode = detail?.upgradeTaskCode;
    if (upgradeTaskCode) setActiveTaskCode(upgradeTaskCode);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        {/* deployInfo 展示（源 2153-2178，来自步骤详情接口 data[0]） */}
        <div className="mb-4 ml-2 flex flex-col">
          <div className="mb-3 flex">
            <span className="w-2/5 text-left font-bold">
              {t('tokenized_deposit_0005')}:
            </span>
            <span>{detail?.tdName ?? '--'}</span>
          </div>
          <div className="mb-3 flex">
            <span className="w-2/5 text-left font-bold">
              {t('tokenized_deposit_0007')}:
            </span>
            <span>{detail?.blockchainName ?? '--'}</span>
          </div>
          <div className="mb-3 flex">
            <span className="w-2/5 text-left font-bold">
              {t('tokenized_deposit_0033')}:
            </span>
            <span>{detail?.packageName ?? '--'}</span>
          </div>
          <div className="mb-3 flex">
            <span className="w-2/5 text-left font-bold">
              {t('tokenized_deposit_0034')}:
            </span>
            <span>{detail?.contractVersion ?? '--'}</span>
          </div>
        </div>

        {/* 部署/升级按钮（源 2179-2211，deployState===0 时显示；无权限 → null） */}
        {showActionButtons ? (
          tdType === 1 ? (
            hasUpgradeDeployPerm ? (
              <div className="mb-2 flex justify-center">
                <Button onClick={handleUpgrade}>{t('Router_0003_13')}</Button>
              </div>
            ) : null
          ) : hasDeployPerm ? (
            <div className="mb-2 flex items-center justify-between">
              <div className="flex w-4/5 items-center">
                <Info className="mr-2 h-5 w-5 shrink-0 text-primary" />
                <span>{t('tokenized_deposit_0035')}</span>
              </div>
              <Button disabled={isPending} onClick={handleDeploy}>
                {t('Router_0003_12')}
              </Button>
            </div>
          ) : null
        ) : null}

        {/* 步骤进度（源 2212-2253） */}
        <div className="p-2">
          <div className="mb-3 text-base font-bold">
            {isUpgrade
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
