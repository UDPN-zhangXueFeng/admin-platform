/**
 * OverviewActionButtons — 运营总览页 9 个操作按钮栏。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的 `buttons` useMemo
 * （源码 266-365 行）+ 按钮渲染 + onClick 分发（源码 1898-2030 行）。
 *
 * 9 个按钮（顺序固定，对齐源码 buttons useMemo 数组顺序）：
 *   1. Mint      — mintMethod===1 && pledgeType===1 才渲染；state!==1 disabled。
 *   2. Melt      — mintMethod===1 && pledgeType===1 才渲染；state!==1 || !showMelt disabled。
 *   3. Contracts — 始终渲染；applyStatus===1 disabled。
 *   4. Edit      — 始终渲染；state===1 || applyStatus===1 || applyStatus===15 可用，否则 disabled。
 *   5. Disable   — type===1 && state===1 才渲染（启用→禁用）。
 *   6. Enable    — type===1 && state===2 才渲染（禁用→启用）。
 *   7. Delete    — applyStatus===1 才渲染（仅待审批可删）。
 *   8. Transactions — state===0 disabled。
 *   9. Wallets      — state===0 disabled。
 *
 * 可见性：每个按钮外层包 `<PermissionGuard permission={TD_PERMISSIONS.X}>`，
 * 用户无该权限码时按钮整体不渲染（对齐源码 `getLimt(limit)` 过滤）。
 *
 * 禁用态：源码用内联 `background`/`color` 控制灰态（#C5C0C0 灰底白字），
 * 这里改为原生 `disabled` 属性（shared/ui Button 已带 disabled 样式），语义等价且无障碍友好。
 *
 * onClick：通过 `onAction(key)` 回调上抛，由 OverviewShell 分发到各 Modal/路由/二次确认。
 * （Modal 内逻辑由 td-18 实现，Disable/Enable/Delete 的二次确认 + 接口调用由 td-14 之外的
 * shell 写操作任务实现；本组件只负责触发，不持有 mutation。）
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';
import {
  APPLY_STATUS,
  TD_PERMISSIONS,
  TD_STATE,
} from '@myorg/modules/tokenized-deposit/util';
import type { ApplyListItem } from '@myorg/modules/tokenized-deposit/data-access';

/** 9 个操作按钮的语义 key（与源码 buttons[].key 完全一致）。 */
export type OverviewActionButtonKey =
  | 'Mint'
  | 'Melt'
  | 'Contracts'
  | 'Edit'
  | 'Disable'
  | 'Enable'
  | 'Delete'
  | 'Transactions'
  | 'Wallets';

export interface OverviewActionButtonsProps {
  /** 当前选中 TD 的概览数据（applyList[activeKey]）。 */
  td: ApplyListItem | undefined;
  /**
   * 是否有待处理销毁（控制 Melt disabled）。
   * 来源：useHasPendingMeltQuery(stablecoinCode)，仅 mintMethod===1/type===1 时有意义。
   */
  showMelt: boolean;
  /** 按钮点击回调，key 为按钮语义标识。 */
  onAction: (key: OverviewActionButtonKey) => void;
}

/**
 * 单个按钮的定义（可见性 + disabled 已在定义处计算）。
 *
 * `hidden` 为 true 的条目不渲染（源码 `{}` 空对象的等价，对应 mintMethod/pledgeType/
 * type/state 条件不满足的分支）。
 */
interface ButtonDef {
  key: OverviewActionButtonKey;
  /** i18n label key（modules.tokenized-deposit namespace 内，相对 key）。 */
  labelKey: string;
  /** 权限码（决定可见性）。 */
  permission: string;
  /** 是否隐藏（不渲染）。 */
  hidden?: boolean;
  /** 是否禁用。 */
  disabled?: boolean;
}

/**
 * 计算当前 TD 下 9 个按钮的定义数组（顺序固定）。
 *
 * 完整搬运源码 buttons useMemo（index.tsx 266-365 行）的显隐/disabled 条件，
 * 勿简化（mintMethod 四状态机 × applyStatus 状态机 × pledgeType × type 交叉）。
 */
function buildButtonDefs(
  td: ApplyListItem | undefined,
  showMelt: boolean,
): ButtonDef[] {
  const state = td?.state;
  const applyStatus = td?.applyStatus;
  const type = td?.type;
  const mintMethod = td?.mintMethod;
  const pledgeType = td?.pledgeType;

  // mintMethod===1 && pledgeType===1：质押铸造稳定币，才显示 Mint/Melt。
  const isPledgeStablecoin = mintMethod === 1 && pledgeType === 1;
  // state===1：启用态。
  const isEnabled = state === TD_STATE.ENABLED;

  return [
    // 1. Mint
    {
      key: 'Mint',
      labelKey: 'Router_0003_2',
      permission: TD_PERMISSIONS.MINT,
      hidden: !isPledgeStablecoin,
      disabled: !isEnabled,
    },
    // 2. Melt
    {
      key: 'Melt',
      labelKey: 'Router_0003_3',
      permission: TD_PERMISSIONS.MELT,
      hidden: !isPledgeStablecoin,
      disabled: !isEnabled || !showMelt,
    },
    // 3. Contracts（始终渲染，applyStatus===1 待审批时禁用）
    {
      key: 'Contracts',
      labelKey: 'Router_0003_4',
      permission: TD_PERMISSIONS.CONTRACTS,
      disabled: applyStatus === APPLY_STATUS.PENDING_REVIEW,
    },
    // 4. Edit（state===1 || applyStatus===1 || applyStatus===15 可用，否则禁用）
    {
      key: 'Edit',
      labelKey: 'Router_0003_5',
      permission: TD_PERMISSIONS.EDIT,
      disabled: !(
        isEnabled ||
        applyStatus === APPLY_STATUS.PENDING_REVIEW ||
        applyStatus === APPLY_STATUS.REVIEWING_15
      ),
    },
    // 5. Disable（type===1 && state===1）
    {
      key: 'Disable',
      labelKey: 'Router_0003_7',
      permission: TD_PERMISSIONS.DISABLE,
      hidden: !(type === 1 && isEnabled),
    },
    // 6. Enable（type===1 && state===2）
    {
      key: 'Enable',
      labelKey: 'Router_0003_6',
      permission: TD_PERMISSIONS.ENABLE,
      hidden: !(type === 1 && state === TD_STATE.DISABLED),
    },
    // 7. Delete（applyStatus===1 待审批可删）
    {
      key: 'Delete',
      labelKey: 'td_operation_type_5',
      permission: TD_PERMISSIONS.DELETE,
      hidden: applyStatus !== APPLY_STATUS.PENDING_REVIEW,
    },
    // 8. Transactions（state===0 未生效时禁用）
    {
      key: 'Transactions',
      labelKey: 'Router_0003_8',
      permission: TD_PERMISSIONS.TRANSACTIONS,
      disabled: state === TD_STATE.INACTIVE,
    },
    // 9. Wallets（state===0 未生效时禁用）
    {
      key: 'Wallets',
      labelKey: 'Router_0003_9',
      permission: TD_PERMISSIONS.WALLETS,
      disabled: state === TD_STATE.INACTIVE,
    },
  ];
}

/**
 * 渲染 9 个操作按钮（权限过滤 + 条件显隐 + 禁用态）。
 *
 * 用法：
 * ```tsx
 * <OverviewActionButtons td={currentTd} showMelt={showMelt} onAction={handleAction} />
 * ```
 */
export function OverviewActionButtons({
  td,
  showMelt,
  onAction,
}: OverviewActionButtonsProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const defs = React.useMemo(
    () => buildButtonDefs(td, showMelt),
    [td, showMelt],
  );

  const handleClick = React.useCallback(
    (key: OverviewActionButtonKey) => () => onAction(key),
    [onAction],
  );

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      {defs.map((def) => {
        if (def.hidden) return null;
        return (
          <PermissionGuard key={def.key} permission={def.permission}>
            <Button
              className="w-32"
              disabled={def.disabled}
              onClick={handleClick(def.key)}
            >
              {t(def.labelKey)}
            </Button>
          </PermissionGuard>
        );
      })}
    </div>
  );
}
