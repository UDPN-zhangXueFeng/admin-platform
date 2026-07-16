'use client';

import { useTranslations } from 'next-intl';
import {
  resolveWalletStatusMeta,
  walletStatusToneClass,
  type WalletStatusTone,
} from '@myorg/modules/wallet/util';

/**
 * Wallet 通用状态 badge。
 *
 * 取代源项目 antd Tag + `approval_task_status_color_*` 配色方案。按状态族解析
 * label key 与色调（迁移自 operational-wallet / user-wallet / wallet-type 多套状态码）。
 */
type StatusFamily =
  | 'operational-wallet'
  | 'user-wallet'
  | 'wallet-type-card'
  | 'wallet-type'
  | 'mmf-daily';

export interface WalletStatusBadgeProps {
  /** 状态族（决定状态码查找表，见 util resolveWalletStatusMeta）。 */
  family: StatusFamily;
  /** 源项目状态码（数字）。 */
  status?: number | null;
}

export function WalletStatusBadge({ family, status }: WalletStatusBadgeProps) {
  const t = useTranslations('modules.wallet');
  const meta = resolveWalletStatusMeta(family, status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${walletStatusToneClass(
        meta.tone as WalletStatusTone
      )}`}
    >
      {t(meta.labelKey as never)}
    </span>
  );
}
