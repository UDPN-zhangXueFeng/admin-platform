/**
 * wallet 域审核组件 barrel（迁移文档 §7 步骤 7，6 个组件）。
 *
 * 迁移自 td-manage `src/pages/approval-manage/components/`：
 * - createWallet.tsx（117 行）→ CreateWalletApproval（sp_open_wallet，walletType 直显）
 * - updateAdminWallet.tsx（119 行）→ UpdateAdminWalletApproval（字段命名独特：
 *   tokenName/blockChain/createdBy/createdOn；walletType 走 admin_wallet_type_ 映射）
 * - userWallet.tsx（123 行）→ UserWalletApproval（type 驱动 user_wallet_task_type_，多 remarks）
 * - funds.tsx（132 行）→ FundsApproval（type 驱动 funds_task_type_，reSet 金额 + operationCount/stablecoinCount）
 * - walletType.tsx（622 行）→ WalletTypeApproval（Create/Update + MMF 分支 issueType=20，
 *   透支/利率三区块条件渲染，阶梯利率遍历，∞ 魔数用 util INFINITY_AMOUNT；剔除 arrangedOverdraftFee 死代码）
 * - updateWalletType.tsx（143 行）→ UpdateWalletTypeApproval（SP 钱包类型变更，new/oldWalletType 并列）
 *
 * 组件注册到 dispatcher 的 COMPONENT_REGISTRY 由汇总阶段统一处理（避免 6 批并行冲突）。
 */
export { CreateWalletApproval } from './create-wallet-approval';
export { UpdateAdminWalletApproval } from './update-admin-wallet-approval';
export { UserWalletApproval } from './user-wallet-approval';
export { FundsApproval } from './funds-approval';
export { WalletTypeApproval } from './wallet-type-approval';
export { UpdateWalletTypeApproval } from './update-wallet-type-approval';
