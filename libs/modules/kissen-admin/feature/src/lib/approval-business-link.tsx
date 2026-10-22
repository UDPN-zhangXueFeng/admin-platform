'use client';

import * as React from 'react';

import { Button } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import { Dash, ProtoStatusBadge } from './proto-ui';

/** 审批详情路由（业务键 busCode+busId 入口与任务键 taskId 入口共用）。 */
export const APPROVAL_DETAIL_PATH = '/approval/detail';

/**
 * 业务行 → 审批详情跳转链接（busCode + busId 复合键，命中审批业务键详情接口；
 * busCode 取值与后端 WorkflowBusinessTypeEnum 一致，如 kissen_lp_pair）。
 *
 * @param label 链接文案
 * @param pending true 时渲染在途徽章替代文案（审批在途行锚点，方案 §5.2）
 */
export function ApprovalBusinessLink({
  busCode,
  busId,
  label = 'View Approval',
  pending = false,
}: {
  busCode: string;
  busId: number;
  label?: string;
  pending?: boolean;
}) {
  const router = useRouter();
  const idNum = Number(busId);
  const valid = busCode !== '' && Number.isSafeInteger(idNum) && idNum > 0;
  if (!valid) return <Dash />;
  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto p-0"
      aria-label={label}
      onClick={() =>
        router.push(
          `${APPROVAL_DETAIL_PATH}?busCode=${encodeURIComponent(busCode)}&busId=${idNum}`,
        )
      }
    >
      {pending ? (
        <ProtoStatusBadge tone="warning">Under Approval</ProtoStatusBadge>
      ) : (
        label
      )}
    </Button>
  );
}
