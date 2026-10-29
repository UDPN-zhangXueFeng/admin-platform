/**
 * AdminWalletModal — 管理员钱包 Modal（4 态：Update / Approval / Details / History）。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的管理钱包 CustomModal
 * （源 2256-2472）+ onFinishAdminWallet（源 1092-1117）+ adminDetialCustomTable /
 * adminHistoryCustomTable（源 959-1091）。
 *
 * ## 4 态（源 adminWalletModalInfo.type）
 *
 * - **Update**：钱包更新表单（walletType/walletAddress disabled + 生成钱包入口 +
 *   chainAccountAddress/privateKey/password）。提交 useUpdateAdminWalletMutation
 *   （password AES 加密 via getEncryptionData）。
 * - **Approval**：钱包审批表单（walletType/originalWalletAddress/walletAddress disabled
 *   + status + state Radio[Approve=20/Reject=15] + remark）。提交
 *   useApprovalAdminWalletMutation（recordId/remark/state）。
 * - **Details**：钱包详情（walletType/walletAddress 静态展示 + 详情表
 *   useWalletDetailListQuery）。
 * - **History**：钱包历史表（useWalletHistoryListQuery）。
 *
 * ## 生成钱包入口（Update 态，源 2339-2422）
 *
 * storageType==='key_keystore' 时显示 keystore 路径（chainAccountAddress 可编辑 +
 * privateKey + password + "Generate Wallet" 入口）；否则 rigsec 路径
 * （chainAccountAddress disabled + "Generate Wallet" 入口）。点击入口回调 props
 * onGenerateWallet（Shell 打开 GenerateWalletModal/RigsecWalletModal，生成后回填）。
 *
 * ## AES password（与 td-11 设计一致）
 *
 * - generateWalletKeystore：API 内部 AES 加密（password 传明文）。
 * - updateAdminWallet：调用方（本组件）在提交前 AES 加密 password（getEncryptionData）。
 *
 * ## 与源差异
 *
 * - antd CustomModal + Form → shared/ui Dialog + react-hook-form。
 * - antd Radio.Group → shared/ui RadioGroup（Approve='20' / Reject='15'）。
 * - antd Table → shared/ui DataTable（详情/历史表）。
 * - adminWalletModalInfo 源在 index 内联组装，这里 props.ctx + props.row 透传。
 * - getEncryptionData（td-4 util）用于 updateAdminWallet 提交前 AES 加密 password。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@myorg/shared/ui';
import { AdminWalletApprovalForm } from './admin-wallet-approval-form';
import { AdminWalletUpdateForm } from './admin-wallet-update-form';
import { DetailsOrHistoryBody } from './admin-wallet-details-history';

/** Modal 态（源 adminWalletModalInfo.type）。 */
export type AdminWalletModalCtx = 'Update' | 'Approval' | 'Details' | 'History';

/** 调用方组装的上下文信息（源 adminWalletModalInfo）。 */
export interface AdminWalletCtx {
  /** Modal 态。 */
  type: AdminWalletModalCtx;
  /** Modal 标题。 */
  title: string;
  /** 钱包记录 ID（Update=accountId / Approval=recordId）。 */
  id: number | string;
  /** 钱包类型展示文案（源 t(`admin_wallet_type_${type}`)）。 */
  walletType: string;
  /** 钱包类型编码（详情/历史表查询参数 accountType）。 */
  accountType?: number;
  /** 稳定币 ID（详情/历史表查询参数 stablecoinId）。 */
  stablecoinId?: number | string;
  /** 钱包地址（Update/Approval/Details 展示）。 */
  walletAddress?: string;
  /** 原钱包地址（Approval 展示）。 */
  originalWalletAddress?: string;
  /** 状态文案（Approval 展示）。 */
  status?: string;
  /** storageType（决定 keystore / rigsec 路径）。 */
  storageType?: string;
}

export interface AdminWalletModalProps {
  /** Modal 开关。 */
  open: boolean;
  /** 4 态上下文（源 adminWalletModalInfo）。 */
  ctx: AdminWalletCtx;
  /** 取消回调。 */
  onCancel: () => void;
  /** 生成钱包入口回调（Update 态，Shell 打开 GenerateWallet/RigsecWallet Modal）。 */
  onGenerateWallet?: () => void;
  /**
   * 子生成 Modal 结果快照（源 generate/rigsec onSuccess → formAdminWallet
   * .setFieldsValue）。Update 表单打开且有值时回填并回调 onGeneratedConsumed。
   */
  generatedWallet?: {
    keystore?: string;
    walletAddress?: string;
    password?: string;
  } | null;
  /** 回填消费完成回调（Shell 清快照，避免重复应用）。 */
  onGeneratedConsumed?: () => void;
  /** 当前表单中的 chainAccountAddress/privateKey（用于判断是否已有钱包，决定是否确认覆盖）。 */
  currentWallet?: { chainAccountAddress?: string; privateKey?: string };
}

/**
 * 管理员钱包 Modal（4 态）。
 *
 * 用法：
 * ```tsx
 * <AdminWalletModal
 *   open={adminWalletModalOpen}
 *   ctx={adminWalletCtx}
 *   onCancel={() => setAdminWalletModalOpen(false)}
 *   onGenerateWallet={handleGenerateWallet}
 * />
 * ```
 */
export function AdminWalletModal({
  open,
  ctx,
  onCancel,
  onGenerateWallet,
  generatedWallet,
  onGeneratedConsumed,
}: AdminWalletModalProps): React.JSX.Element {
  const isForm = ctx.type === 'Update' || ctx.type === 'Approval';

  // 宽度（源 2267-2271）：Update/Approval 30%，Details/History 60%。
  const maxWidth = isForm ? 'max-w-[480px]' : 'max-w-[900px]';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className={maxWidth}>
        <DialogHeader>
          <DialogTitle>{ctx.title}</DialogTitle>
          <DialogDescription className="sr-only">{ctx.title}</DialogDescription>
        </DialogHeader>

        {/* ── Update / Approval 表单 ── */}
        {isForm ? (
          ctx.type === 'Update' ? (
            <AdminWalletUpdateForm
              open={open}
              ctx={ctx}
              onCancel={onCancel}
              onGenerateWallet={onGenerateWallet}
              generatedWallet={generatedWallet}
              onGeneratedConsumed={onGeneratedConsumed}
            />
          ) : (
            <AdminWalletApprovalForm open={open} ctx={ctx} onCancel={onCancel} />
          )
        ) : (
          <DetailsOrHistoryBody ctx={ctx} />
        )}
      </DialogContent>
    </Dialog>
  );
}
