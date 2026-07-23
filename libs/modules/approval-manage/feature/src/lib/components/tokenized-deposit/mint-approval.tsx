'use client';

import type { ApprovalComponentProps } from '@myorg/modules/approval-manage/ui';

import { MintMeltApproval } from './mint-melt-approval';

/**
 * MintApproval — TD 增发审核组件（迁移自 td-manage
 * `src/pages/approval-manage/components/mint.tsx`，117 行）。
 *
 * 增发：绿色 `+` 前缀，标题 Minting Information。busCode=`td_mint`（见 util BUS_CODE_MAP）。
 * 业务逻辑与 MeltApproval 对称，公共实现见 {@link MintMeltApproval}（isMint=true）。
 *
 * props 经 dispatcher 注册表透传（ApprovalComponentProps），仅消费 `detailInfo`
 * （=approvedDetail.businessContent）。其余 prop 忽略（mint/melt 不需要 type/approvalStatus 等）。
 */
export function MintApproval({ detailInfo }: ApprovalComponentProps) {
  return <MintMeltApproval detailInfo={detailInfo} isMint />;
}
