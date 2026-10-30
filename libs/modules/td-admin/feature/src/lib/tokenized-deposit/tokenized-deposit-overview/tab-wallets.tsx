/**
 * OverviewWalletsTab — 运营总览页 Tab3 钱包。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的 customTable2
 * （active==='3'，tokenized_deposit_0054「Wallets」）+ Additional Wallets 静态 mock 表。
 *
 * ## 双 URL 切换（文档 8.6，对齐源 678-747 行）—— 核心难点
 *
 * 钱包列表有 2 个 endpoint：
 * - `useWalletQuery`（listPage）：默认场景（isOnclick=false）。
 * - `useWalletBalanceQuery`（balance）：刷新按钮触发场景（isOnclick=true）。
 *
 * 两个 hook 按 `isOnclick` 在调用方切换（同一组件内条件渲染不同的子表组件，
 * 避免在同一 hook 间动态切 URL 导致 query key 错乱）。
 *
 * 时序（对齐源 735-744 行刷新按钮 onClick）：
 * 1. 点刷新按钮 → setDoRe(true) + setIsOnclick(true) + mutate balance query。
 * 2. 3s 后 setDoRe(false) 复位旋转动画。
 * 3. 切 TD（td.code 变化）→ useEffect 复位 isOnclick=false（走回 listPage）。
 *
 * 源 useEffect 1764-1767：`setIsOnclick(false)` 在 `[active, activeKey]` 变化时触发，
 * 即切 TD 时复位。这里等价：td.code 变化时复位。
 *
 * ## 钱包表列（对齐源 694-725 行，逐列）
 *
 * - tokenized_deposit_0176：type → admin_wallet_type_${type}（纯文案）
 * - tokenized_deposit_0049：blockchainName
 * - tokenized_deposit_0053：walletAddress（源无 Copy，但地址长，加 Copy + ellipsis 提升可读性）
 * - tokenized_deposit_0051：balance → '∞' 或 balance + ' ' + unit
 * - tokenized_deposit_0052：updateTime → formatAdminTimestamp
 *
 * 源 walletAddress 列无 render（纯文本），但钱包地址普遍超长，迁移时统一用
 * TokenizedDepositCopy ellipsis（与 SP 记录表 walletAddress 列保持一致）。
 *
 * ## 行操作（对齐源 748-774 行 actions，逐项）
 *
 * - Edit（权限 EDIT_WALLET）：disabled = !(approvalStatus===0 && operateStatus===35)。
 *   回调 → onOpenAdminWalletModal(type='Update', row)。
 * - View（权限 VIEW_WALLET）：disabled: false。
 *   回调 → onOpenAdminWalletModal(type='Details', row)。
 * - History（权限 HISTORY）：disabled: false。
 *   回调 → onOpenAdminWalletModal(type='History', row)。
 *
 * 死代码 `Examine` action（源 750-755 注释）不迁移，但权限码 EXAMINE 保留勿删。
 * Modal 实际渲染在 td-18 的 admin-wallet-modal.tsx，本 tab 只负责通过回调上报打开意图。
 *
 * ## Additional Wallets 静态 mock 表（对齐源 1451-1635 行）
 *
 * 9 行角色钱包（Force Transfer 第 10 行注释，不迁移）。blockchain 取当前 TD 的
 * blockchainName，fallback 'Hyperledger Besu'。status 恒 'Unconfigured'，
 * Badge dimension="roleWallet"。updatedTime 恒 null → '--'。
 *
 * 列：role_name / wallet_address / Chain Name（英文硬编码标题，源 t('role_name') 等
 * i18n key 在 tokenized-deposit 命名空间；'Chain Name' 源直接传英文字符串给 t() ——
 * 无对应 i18n key 时 next-intl 会回落显示 key 本身，故保持英文 key 一致）。
 *
 * ## 死代码（不迁移）
 *
 * - customTable2 `Examine` action 注释（TD_PERMISSIONS.EXAMINE 权限码保留）
 * - Additional Wallets Force Transfer 第 10 行注释
 * - Additional Wallets `Actions` 列注释（源 1622-1631，无入口）
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import type {
  ApplyListItem,
  WalletItem,
} from '@myorg/modules/td-admin/data-access';
import { WalletsTableInner } from './wallets-table-inner';
import { AdditionalWalletsTable } from './additional-wallets-table';

/** 刷新按钮旋转动画复位延迟（源 3000ms）。 */
const REFRESH_SPIN_DURATION_MS = 3000;

/**
 * AdminWalletModal 打开意图类型（对齐源 adminWalletModalInfo.type）。
 *
 * 源 actionClick 按分支设置 type 字段：
 * - 'Update'：Edit action（源 type: 'Update'）
 * - t('PUB_Detail')：View action（源 type: t('PUB_Detail')）
 * - t('tokenized_deposit_0077')：History action（源 type: t('tokenized_deposit_0077')）
 *
 * td-18 的 admin-wallet-modal.tsx 按此 type 渲染 4 态（Update/Approval/Details/History）。
 * 这里用语义常量 'Update' | 'Details' | 'History'（Approval 态由 td-18 死代码
 * Examine 触发，本 tab 不上报）。
 */
export type AdminWalletModalActionType = 'Update' | 'Details' | 'History';

/**
 * AdminWalletModal 打开上下文（对齐源 adminWalletModalInfo 关键字段）。
 *
 * td-18 消费：按 action 渲染对应 Modal 态，并预填 formAdminWallet。
 * 此处只传 row 原始数据 + 语义 action，Modal 内部按需取字段（accountId/walletAddress/
 * storageType/chainType/virtualMachineCode/blockchainCode/tdName/type 等），
 * 避免在 tab 层复制源 adminWalletModalInfo 的 13 字段手动组装（td-18 自行组装更内聚）。
 */
export interface AdminWalletModalActionContext {
  /** 打开态（对齐源 adminWalletModalInfo.type 的语义子集）。 */
  action: AdminWalletModalActionType;
  /** 触发行原始数据（源 actionClick 的 data）。 */
  row: WalletItem;
}

export interface OverviewWalletsTabProps {
  /** 当前选中 TD（源 getUsablePrice）。提供 code（注入 stablecoinCode 过滤）+ blockchainName。 */
  td: ApplyListItem;
  /**
   * 打开管理钱包 Modal 回调（td-18 实现）。
   * 传入打开意图（Update/Details/History）+ 触发行数据。
   */
  onOpenAdminWalletModal: (ctx: AdminWalletModalActionContext) => void;
}

/**
 * 渲染 Tab3 钱包（双 URL 钱包表 + Additional Wallets 静态 mock 表）。
 *
 * 用法（在 OverviewShell TabsContent value="3" 内）：
 * ```tsx
 * <OverviewWalletsTab
 *   td={currentTd}
 *   onOpenAdminWalletModal={({ action, row }) => {
 *     setAdminWalletModalAction(action);
 *     setAdminWalletModalRow(row);
 *     setAdminWalletModalOpen(true);
 *   }}
 * />
 * ```
 */
export function OverviewWalletsTab({
  td,
  onOpenAdminWalletModal,
}: OverviewWalletsTabProps): React.JSX.Element {
  // ── 双 URL 切换 state ──
  // isOnclick：false→listPage，true→balance（刷新按钮触发）。
  // 源 useState(false) + useEffect [active, activeKey] 复位。
  const [isOnclick, setIsOnclick] = React.useState(false);
  // doRe：刷新按钮旋转动画标志（源 useState(false)）。
  const [doRe, setDoRe] = React.useState(false);

  // 切 TD（td.code 变化）复位 isOnclick=false（源 useEffect 1764-1767 等价）。
  React.useEffect(() => {
    setIsOnclick(false);
  }, [td?.code]);

  // 刷新按钮 onClick（对齐源 735-744）：
  // setDoRe(true) + setIsOnclick(true) + balance query refetch + 3s 后 setDoRe(false)。
  const handleRefresh = React.useCallback(
    (refetchBalance: () => void) => {
      setDoRe(true);
      setIsOnclick(true);
      void refetchBalance();
      window.setTimeout(() => setDoRe(false), REFRESH_SPIN_DURATION_MS);
    },
    [],
  );

  return (
    <div className="space-y-8">
      {isOnclick ? (
        <WalletsTableInner
          td={td}
          variant="balance"
          doRe={doRe}
          onRefresh={handleRefresh}
          onOpenAdminWalletModal={onOpenAdminWalletModal}
        />
      ) : (
        <WalletsTableInner
          td={td}
          variant="listPage"
          doRe={doRe}
          onRefresh={handleRefresh}
          onOpenAdminWalletModal={onOpenAdminWalletModal}
        />
      )}

      {/* Additional Wallets 静态 mock 表 */}
      <AdditionalWalletsTable td={td} />
    </div>
  );
}
