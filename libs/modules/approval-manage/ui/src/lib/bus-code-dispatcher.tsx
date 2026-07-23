'use client';

import * as React from 'react';

import {
  resolveApprovalComponent,
  type ApprovalComponentKey,
} from '@myorg/modules/approval-manage/util';

/**
 * BusCodeDispatcher — 按 busCode 分发到对应审核组件（封装源 view.tsx:506-647 的 if-else 长链）。
 *
 * 这是 approval-manage 详情页的核心：busCode（30+ 种精确 + 4 组 financial 模糊匹配）
 * 决定左侧渲染哪个业务审核组件。dispatcher 本身不做映射（映射在 util
 * `BUS_CODE_MAP` + `FINANCIAL_FUZZY_MATCHERS`，经 `resolveApprovalComponent` 查询），
 * 只负责把命中的组件标识符 → 实际 React 组件 + 透传 props。
 *
 * **顺序敏感**：精确匹配优先于模糊匹配（由 util resolveApprovalComponent 保证，
 * 见 bus-code-map.ts 注释）。dispatcher 不重写映射，只做渲染分发（Rule 3：surgical）。
 *
 * **占位策略**：T6-T11 的 25 个审核组件尚未实现。dispatcher 接收一个「组件注册表」
 * （Record<ApprovalComponentKey, ComponentType>）；注册表项缺失时渲染占位卡片
 * （显示 busCode + "TODO: <ComponentName>"），不报错。T6-T11 接入时把实现填入注册表即可，
 * dispatcher 与 detail-page 无需改动。
 *
 * **props 透传**：源 dispatcher 各组件接收的字段子集不同（有的只 detailInfo，financial
 * 五件套 detailInfo+approvalInfo+taskInfo+approvalStatus+busCode，reserveAsset 多 opType）。
 * 此处统一透传全集，未消费的 prop 由各组件忽略（React 自动丢弃未声明的 prop）。
 */

/**
 * approvedDetail 的结构化宽松类型（ui 层不能依赖 data-access 层，故本地定义；
 * 结构与 data-access 的 ApprovedDetail 兼容，feature 层传入时类型匹配）。
 * financial 组件从中读 businessContent / approveButtonDTO / transCode 等。
 */
export interface ApprovalInfoLike {
  businessContent?: Record<string, unknown>;
  approveButtonDTO?: Record<string, unknown>;
  transCode?: string;
  [k: string]: unknown;
}

/**
 * taskApprovedDetail 的结构化宽松类型（同上，与 data-access ApprovalLog 兼容）。
 * Steps 日志 + financial 组件从中读 taskCreateInfo / recordList / approveType / taskStatus。
 */
export interface TaskInfoLike {
  taskCreateInfo?: Record<string, unknown>;
  recordList?: Array<Record<string, unknown>>;
  approveType?: number;
  taskStatus?: number;
  [k: string]: unknown;
}

/**
 * 各审核组件接收的统一 props（源 dispatcher 透传字段的并集）。
 *
 * 字段对照源 view.tsx:506-647：
 * - detailInfo = approvedDetail.businessContent（所有组件都收）
 * - type = busCode 派生的操作类型（token/walletType/monitoringRule/interestRule/userWallet/funds/serviceProvider）
 * - approvalInfo = approvedDetail（financial posting-rule / normalization 收）
 * - taskInfo = taskApprovedDetail（financial posting-rule / normalization 收）
 * - approvalStatus = status（四套 status 派生结果；financial posting-rule / normalization 收）
 * - busCode = query.busCode（financial coa / posting-rule / normalization 收）
 * - opType = query.opType（reserveAsset 收，来自 URL 非 busCode 派生）
 */
export interface ApprovalComponentProps {
  detailInfo?: Record<string, unknown>;
  type?: number;
  approvalInfo?: ApprovalInfoLike;
  taskInfo?: TaskInfoLike;
  approvalStatus?: number;
  busCode?: string;
  opType?: string;
}

/** 审核组件类型（接收统一 props）。 */
export type ApprovalComponent = React.ComponentType<ApprovalComponentProps>;

/**
 * 组件注册表：ApprovalComponentKey → 实际组件。
 *
 * detail-page 构建此注册表；未填入的 key 由 dispatcher 渲染占位卡片。
 * T6-T11 实现各组件后填入对应项即可。
 */
export type ApprovalComponentRegistry = Partial<
  Record<ApprovalComponentKey, ApprovalComponent>
>;

/** 组件标识符 → 展示名（占位卡片 + 日志用，迁移自源组件文件名/导出名）。 */
const COMPONENT_DISPLAY_NAME: Record<ApprovalComponentKey, string> = {
  token: 'TokenApproval',
  mint: 'MintApproval',
  melt: 'MeltApproval',
  updateAdminWallet: 'UpdateAdminWalletApproval',
  walletType: 'WalletTypeApproval',
  updateWalletType: 'UpdateWalletTypeApproval',
  userWallet: 'UserWalletApproval',
  funds: 'FundsApproval',
  createWallet: 'CreateWalletApproval',
  serviceProvider: 'ServiceProviderApproval',
  topUp: 'TopUpApproval',
  withdrawal: 'WithdrawalApproval',
  monitoringRule: 'MonitoringRuleApproval',
  monitoringResultProcess: 'MonitoringResultProcessApproval',
  interestRule: 'InterestRuleTypeApproval',
  interestFee: 'InterestFeeApproval',
  tokenPair: 'TokenPairApproval',
  liquidityPool: 'LiquidityPoolApproval',
  settlement: 'SettlementApproval',
  reserveAsset: 'ReserveAssetApproval',
  reserveAssetTransaction: 'ReserveAssetTransactionApproval',
  financialCoa: 'FinancialCoaApproval',
  financialNormalization: 'FinancialNormalizationApproval',
  financialPostingRule: 'FinancialPostingRuleApproval',
  financialSuspenseAdjustment: 'FinancialSuspenseAdjustmentApproval',
};

export interface BusCodeDispatcherProps extends ApprovalComponentProps {
  /** busCode（dispatcher 分发依据，来自 URL ?busCode=）。 */
  busCode: string;
  /** 组件注册表（detail-page 提供，缺失项渲染占位卡片）。 */
  components: ApprovalComponentRegistry;
}

/**
 * 占位卡片：busCode 未命中映射、或命中组件尚未实现时渲染（不崩）。
 *
 * 两种场景：
 * 1. resolveApprovalComponent 返回 null（busCode 不在任何精确/模糊匹配中）→ "Unknown busCode"。
 * 2. 命中但注册表无该组件（T6-T11 未实现）→ "TODO: <ComponentName>"。
 */
function PlaceholderCard({
  busCode,
  componentName,
  resolved,
}: {
  busCode: string;
  componentName?: string;
  resolved: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6">
      <p className="text-sm font-medium text-muted-foreground">
        {resolved
          ? `TODO: ${componentName ?? 'Approval Component'}`
          : `Unknown busCode: ${busCode || '(empty)'}`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground/70">
        {resolved
          ? `busCode=${busCode}（审核组件待 T6-T11 接入）`
          : '该 busCode 未在 BUS_CODE_MAP / FINANCIAL_FUZZY_MATCHERS 中注册'}
      </p>
    </div>
  );
}

/**
 * 按 busCode 分发审核组件。
 *
 * 流程：resolveApprovalComponent(busCode) → 命中 key → 查注册表 → 渲染或占位。
 * 顺序由 util 保证（精确优先，4 模糊兜底），dispatcher 不干预。
 */
export function BusCodeDispatcher({
  busCode,
  components,
  detailInfo,
  type,
  approvalInfo,
  taskInfo,
  approvalStatus,
  opType,
}: BusCodeDispatcherProps) {
  const resolved = resolveApprovalComponent(busCode);

  if (!resolved) {
    return <PlaceholderCard busCode={busCode} resolved={false} />;
  }

  const Component = components[resolved.component];
  const displayName = COMPONENT_DISPLAY_NAME[resolved.component];

  if (!Component) {
    // 命中映射但组件未实现（T6-T11 待接入）→ 占位，不崩。
    return (
      <PlaceholderCard
        busCode={busCode}
        componentName={displayName}
        resolved={true}
      />
    );
  }

  return (
    <Component
      detailInfo={detailInfo}
      // type 优先用 busCode 派生值（util resolve），调用方传入的 type 作为兜底
      // （源 dispatcher 直接用 `type={map[busCode]}`，reserveAsset 等无 type 族不传）。
      type={resolved.type ?? type}
      approvalInfo={approvalInfo}
      taskInfo={taskInfo}
      approvalStatus={approvalStatus}
      busCode={busCode}
      opType={opType}
    />
  );
}
