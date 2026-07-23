'use client';

import type { ApprovalComponentProps } from '@myorg/modules/approval-manage/ui';

import { MintMeltApproval } from './mint-melt-approval';

/**
 * MeltApproval — TD 销毁审核组件（迁移自 td-manage
 * `src/pages/approval-manage/components/melt.tsx`，148 行）。
 *
 * 销毁：红色 `-` 前缀，标题 Melting Information。busCode=`td_melt`（见 util BUS_CODE_MAP）。
 * 业务逻辑与 MintApproval 对称，公共实现见 {@link MintMeltApproval}（isMint=false）。
 *
 * **死代码剔除（文档 §8）**：源 melt.tsx 末尾注释的 `approvalTaskStatus` /
 * `token_task_status_*` 整段 section（行 101-131）不迁移——公共实现已无此段。
 *
 * props 经 dispatcher 注册表透传（ApprovalComponentProps），仅消费 `detailInfo`
 * （=approvedDetail.businessContent）。
 */
export function MeltApproval({ detailInfo }: ApprovalComponentProps) {
  return <MintMeltApproval detailInfo={detailInfo} isMint={false} />;
}
