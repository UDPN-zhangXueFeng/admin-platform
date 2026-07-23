'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@myorg/shared/ui';

import {
  useApprovedDetailQuery,
  useApprovalLogQuery,
  type ApprovedDetail,
} from '@myorg/modules/approval-manage/data-access';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@myorg/shared/ui';
import {
  BusCodeDispatcher,
  type ApprovalComponentRegistry,
} from '@myorg/modules/approval-manage/ui';
import { ApprovalManageOperationPanel } from './approval-manage-operation-panel';
import { ApprovalManageApprovalLog } from './approval-manage-approval-log';

// ── 6 子域审核组件（T6-T11）──────────────────────────────────────────────────
// 按 util BUS_CODE_MAP / FINANCIAL_FUZZY_MATCHERS 的 ApprovalComponentKey 装配注册表。
// dispatcher 按命中的 component key 查表渲染；缺失 key 走占位卡片（不崩）。
import {
  CreateWalletApproval,
  FundsApproval,
  UpdateAdminWalletApproval,
  UpdateWalletTypeApproval,
  UserWalletApproval,
  WalletTypeApproval,
} from './components/wallet';
import {
  MeltApproval,
  MintApproval,
  TokenApproval,
} from './components/tokenized-deposit';
import {
  ReserveAssetApproval,
  ReserveAssetTransactionApproval,
  ServiceProviderApproval,
  TopUpApproval,
  WithdrawalApproval,
} from './components/sp-reserve';
import {
  InterestFeeApproval,
  InterestRuleTypeApproval,
  MonitoringResultProcessApproval,
  MonitoringRuleApproval,
} from './components/monitoring-interest';
import {
  LiquidityPoolApproval,
  SettlementApproval,
  TokenPairApproval,
} from './components/crosschain-settlement';
import {
  FinancialCoaApproval,
  FinancialNormalizationApproval,
  FinancialPostingRuleApproval,
  FinancialSuspenseAdjustmentApproval,
} from './components/financial';

/**
 * ApprovalManageDetailPage — 审批详情 dispatcher（迁移自 td-manage
 * `src/pages/approval-manage/view.tsx`，1074 行的 dispatcher 核心）。
 *
 * 读 URL `?id={taskId}&busCode={businessCode}`（reserveAsset 另读 `?opType=`），
 * 调 approvedDetailApi + taskApprovedDetailApi，派生四套 status + selectType，
 * 左侧 <BusCodeDispatcher> 按 busCode 渲染对应审核组件，右侧审批操作区占位（T12）。
 *
 * **路由解析**：列表行 View 跳 `/approval-manage/view?id=&busCode=`，catch-all 路由
 * realSlug[0]='view' → pageKey='detail'（见 apps/admin [module]/[[...slug]]/page.tsx），
 * 故本组件用 useSearchParams 读 id/busCode/opType（同 statements-detail-page 模式）。
 *
 * **四套 status 字段派生（精确复制源 view.tsx:142-161）**：
 * 按 busCode 决定从 businessContent 取哪个字段作为 status：
 * - `td_new`                       → `applyStatus`
 * - `td_edit_all`/`td_disable`/`td_enable` → `operateStatus`
 * - `td_register_sp`/`td_edit_sp`/`td_add_wallet_type`/`td_edit_wallet_type`/
 *   `td_disable_wallet_type`/`td_enable_wallet_type` → `state`
 * - 其余                            → `status`
 *
 * **taskStatus 覆盖（源 view.tsx:182-186）**：taskApprovedDetailApi 返回的
 * `taskStatus` 无条件覆盖上面派生的 status（financial busCode 取此，源在 code!==0
 * return 之前执行 setStatus，此处用 query 成功后覆盖）。
 *
 * **selectType 派生（精确复制源 view.tsx:163-178）**：仅
 * `td_edit_sp`/`td_add_wallet_type`/`td_register_sp`：
 * `operationKycComplianceType==2` → push '1'；`operationPrivateKeyHostingType==2` → push '2'；
 * 挂回 `businessContent.selectType`（供 ServiceProvider/WalletType 审核组件回填勾选项）。
 *
 * **hasData 骨架（源 view.tsx:138-140）**：源用 setTimeout(300ms) 控制 hasData，
 * 骨架期渲染空。迁移保留 300ms 延迟语义（detail 数据加载完 + 300ms 后才渲染，
 * 避免 status 派生/组件挂载时序导致的闪烁）。
 *
 * **右侧审批操作区（占位）**：T12 实现（approve/remarks 表单 + MetaMask + 退回 Modal +
 * 升级 Drawer + Steps 日志）。此处渲染占位卡片。
 */

/** selectType 派生触发的 busCode 集合（源 view.tsx:163-167）。 */
const SELECT_TYPE_BUS_CODES = new Set([
  'td_edit_sp',
  'td_add_wallet_type',
  'td_register_sp',
]);

/** state 字段派生触发的 busCode 集合（源 view.tsx:150-157）。 */
const STATE_FIELD_BUS_CODES = new Set([
  'td_register_sp',
  'td_edit_sp',
  'td_add_wallet_type',
  'td_edit_wallet_type',
  'td_disable_wallet_type',
  'td_enable_wallet_type',
]);

/** operateStatus 字段派生触发的 busCode 集合（源 view.tsx:144-148）。 */
const OPERATE_STATUS_BUS_CODES = new Set([
  'td_edit_all',
  'td_disable',
  'td_enable',
]);

/**
 * 四套 status 字段派生（迁移自源 view.tsx:142-161 的 if-else 链）。
 *
 * 逐行对照源码：
 * - L142: busCode==='td_new' → businessContent.applyStatus
 * - L144-148: td_edit_all/td_disable/td_enable → operateStatus
 * - L150-157: td_register_sp/td_edit_sp/td_add/edit/disable/enable_wallet_type → state
 * - L159-160: else → status
 *
 * @param busCode          业务码
 * @param businessContent  approvedDetail.businessContent
 * @returns 派生的 status（number | undefined）
 */
function deriveStatus(
  busCode: string,
  businessContent?: Record<string, unknown>,
): number | undefined {
  if (!businessContent) return undefined;
  if (busCode === 'td_new') {
    return toNumber(businessContent.applyStatus);
  }
  if (OPERATE_STATUS_BUS_CODES.has(busCode)) {
    return toNumber(businessContent.operateStatus);
  }
  if (STATE_FIELD_BUS_CODES.has(busCode)) {
    return toNumber(businessContent.state);
  }
  return toNumber(businessContent.status);
}

/** 安全 number 化（源 setStatus 直接收后端值，此处兼容字符串数字）。 */
function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * selectType 派生（迁移自源 view.tsx:163-178）。
 *
 * 仅 td_edit_sp/td_add_wallet_type/td_register_sp：
 * - operationKycComplianceType == 2 → push '1'
 * - operationPrivateKeyHostingType == 2 → push '2'
 * 返回挂回 businessContent.selectType 的新 businessContent 引用（不可变更新）。
 *
 * 源用 `==`（宽松相等），此处保留：后端可能返回字符串 '2' 或数字 2，`== 2` 均命中。
 */
function withSelectType(
  busCode: string,
  businessContent?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!businessContent) return businessContent;
  if (!SELECT_TYPE_BUS_CODES.has(busCode)) return businessContent;

  const { operationKycComplianceType, operationPrivateKeyHostingType } =
    businessContent as {
      operationKycComplianceType?: unknown;
      operationPrivateKeyHostingType?: unknown;
    };
  // 源用 ==（宽松相等，兼容后端返回 '2'/2），保留语义（view.tsx:171/174）。
  const newSelectType: string[] = [];
  if (operationKycComplianceType == 2) {
    newSelectType.push('1');
  }
  if (operationPrivateKeyHostingType == 2) {
    newSelectType.push('2');
  }
  return { ...businessContent, selectType: newSelectType };
}

/** 解析 query 中的正整数 id（taskId）。 */
function parseTaskId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * 组件注册表：25 个 ApprovalComponentKey → 实际审核组件（T6-T11 全量接入）。
 *
 * key 照 util `BUS_CODE_MAP` / `FINANCIAL_FUZZY_MATCHERS` 的 component 字段（事实源）。
 * dispatcher 按命中的 key 查表渲染；缺失 key 走占位卡片（不崩）。
 *
 * 分组：tokenized-deposit（3）+ wallet（6）+ sp-reserve（5）+ monitoring-interest（4）
 *      + crosschain-settlement（3）+ financial（4）= 25 个，无遗漏。
 */
const COMPONENT_REGISTRY: ApprovalComponentRegistry = {
  // ── tokenized-deposit（3）
  token: TokenApproval,
  mint: MintApproval,
  melt: MeltApproval,
  // ── wallet（6）
  updateAdminWallet: UpdateAdminWalletApproval,
  walletType: WalletTypeApproval,
  updateWalletType: UpdateWalletTypeApproval,
  userWallet: UserWalletApproval,
  funds: FundsApproval,
  createWallet: CreateWalletApproval,
  // ── sp-reserve（5）
  serviceProvider: ServiceProviderApproval,
  topUp: TopUpApproval,
  withdrawal: WithdrawalApproval,
  reserveAsset: ReserveAssetApproval,
  reserveAssetTransaction: ReserveAssetTransactionApproval,
  // ── monitoring-interest（4）
  monitoringRule: MonitoringRuleApproval,
  monitoringResultProcess: MonitoringResultProcessApproval,
  interestRule: InterestRuleTypeApproval,
  interestFee: InterestFeeApproval,
  // ── crosschain-settlement（3）
  tokenPair: TokenPairApproval,
  liquidityPool: LiquidityPoolApproval,
  settlement: SettlementApproval,
  // ── financial（4，前 3 精确 + 模糊匹配族）
  financialCoa: FinancialCoaApproval,
  financialNormalization: FinancialNormalizationApproval,
  financialPostingRule: FinancialPostingRuleApproval,
  financialSuspenseAdjustment: FinancialSuspenseAdjustmentApproval,
};

export function ApprovalManageDetailPage() {
  const t = useTranslations('modules.approval-manage');
  const searchParams = useSearchParams();

  const taskId = parseTaskId(searchParams.get('id'));
  const busCode = searchParams.get('busCode') ?? '';
  const opType = searchParams.get('opType') ?? '';

  // ── 数据加载 ──────────────────────────────────────────────────────────────
  const detailQuery = useApprovedDetailQuery(taskId, busCode);
  const logQuery = useApprovalLogQuery(taskId);

  // ── hasData 骨架（源 view.tsx:138-140 setTimeout 300ms） ──────────────────────
  // 源：进页 setHasData(false)，setTimeout(300) 后 setHasData(true)。
  // 迁移：detail 数据就绪后延迟 300ms 再渲染主体（保留源时序语义，避免派生闪烁）。
  const [hasData, setHasData] = React.useState(false);
  React.useEffect(() => {
    if (!detailQuery.isSuccess) {
      setHasData(false);
      return;
    }
    setHasData(false);
    const timer = window.setTimeout(() => setHasData(true), 300);
    return () => window.clearTimeout(timer);
  }, [detailQuery.isSuccess]);

  // ── 四套 status 派生 + selectType 注入（精确复制源 view.tsx:132-186） ──────────
  const { approvedDetail, status } = React.useMemo(() => {
    const raw = detailQuery.data as ApprovedDetail | undefined;
    const businessContent = raw?.businessContent;

    // selectType 派生（源 view.tsx:163-178，挂回 businessContent.selectType）
    const enrichedContent = withSelectType(busCode, businessContent);
    const enrichedDetail: ApprovedDetail | undefined = enrichedContent
      ? { ...raw, businessContent: enrichedContent }
      : raw;

    // 四套 status 派生（源 view.tsx:142-161）
    let derived = busCode
      ? deriveStatus(busCode, enrichedContent)
      : undefined;

    // taskStatus 无条件覆盖（源 view.tsx:186 setStatus(res.data.data?.taskStatus)，
    // 在 code!==0 return 之前执行；此处 log 成功后覆盖）。
    const taskStatus = toNumber(logQuery.data?.taskStatus);
    if (logQuery.isSuccess && taskStatus !== undefined) {
      derived = taskStatus;
    }

    return { approvedDetail: enrichedDetail, status: derived };
  }, [detailQuery.data, logQuery.data, logQuery.isSuccess, busCode]);

  const detailInfo = approvedDetail?.businessContent;

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  if (!taskId || !busCode) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          {t('detail.invalidId')}
        </p>
      </div>
    );
  }

  // 源 view.tsx:508 `{hasData ? <>主体</> : null}`：数据未就绪或 300ms 骨架期渲染 loading。
  if (!hasData) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('detail.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        {/* 左侧：业务审核组件（dispatcher 按 busCode 分发） */}
        <div className="w-full rounded-lg bg-card p-4 shadow-sm lg:w-[49%]">
          <BusCodeDispatcher
            busCode={busCode}
            components={COMPONENT_REGISTRY}
            detailInfo={detailInfo}
            approvalInfo={approvedDetail}
            taskInfo={logQuery.data}
            approvalStatus={status}
            opType={opType}
          />
        </div>

        {/* 右侧：审批操作区（approveType===1 时渲染操作面板）+ Steps 审批日志（始终）。
            源 view.tsx:650-793：approveButtonDTO.approveType===1 显示操作区，
            Collapse 审批日志（taskApprovedSteps）始终显示。 */}
        <div className="w-full space-y-4 rounded-lg bg-card p-4 shadow-sm lg:w-[49%]">
          {approvedDetail?.approveButtonDTO?.approveType === 1 ? (
            <ApprovalManageOperationPanel
              approvedDetail={approvedDetail}
              taskId={taskId}
              busCode={busCode}
              onSuccess={() => {
                // mutation 成功已 invalidate(approvalManageKeys.all)，自动重取详情+日志。
                // 此处无需手动 refetch（同源 getApprovedDetail/getTaskApprovedDetail 由
                // query invalidation 触发）。
              }}
              onBack={() => window.history.back()}
            />
          ) : null}

          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold">
              <span>{t('approval_manage_0008')}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ApprovalManageApprovalLog
                taskInfo={logQuery.data}
                status={status}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <Button variant="default" onClick={() => window.history.back()}>
          {t('detail.back')}
        </Button>
      </div>
    </div>
  );
}
