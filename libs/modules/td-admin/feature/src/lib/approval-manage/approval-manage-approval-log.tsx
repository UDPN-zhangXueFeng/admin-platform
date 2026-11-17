'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Timeline, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, type TimelineItem } from '@myorg/shared/ui';

import type { ApprovalLog } from '@myorg/modules/td-admin/data-access';
import {
  formatTimestamp,
  resolveApprovalStepStatus,
} from '.';

/**
 * ApprovalManageApprovalLog — Steps 垂直审批日志。
 *
 * 迁移自 td-manage `src/pages/approval-manage/view.tsx` 的 `taskApprovedSteps`
 * useMemo（L272-439）+ Collapse 内 `<Steps direction="vertical">`（L779-793）。
 *
 * 使用共享 Timeline 呈现垂直步骤，保留源 Steps 的 title/description/current/status 语义。
 *
 * **节点标题 5 态（源 view.tsx:292-311，逐行对照）**：
 * - operationType === 0 → `Approval (1 out of {total} approvers)`（待审批N人）
 * - operationType === 1 → reviewerStatus===3 ? `Approved` : `Rejected`（record_status_2）
 * - operationType === 2 → `Escalate`
 * - operationType === 3 → `Revert`
 * - 其它             → `Withdrawn`（默认兜底）
 *
 * **approvedCurrent 同步计算（源 view.tsx:425-436 的 setTimeout 异步改 useMemo 同步，
 * 计划 §7 步骤 12 建议；源异步依赖 approvedCurrent state（加载时被 reset 为 0），
 * 同步化后等价于 `1 + 0 + stepIndex - (status===15?1:0)`，更稳）**：
 * - stepIndex = recordList.findIndex(operationType===0 || operationType===4)
 * - status===15（flag）时 current 减 1
 * - stepIndex===-1 → current = items.length - (flag?1:0)
 * - 否则            → current = 1 + stepIndex - (flag?1:0)
 *
 * **reviewerUserNameList>5 折叠**：前五人后通过可聚焦的 Tooltip 展示其余人，
 * 分隔符 `approve_type_{approveType}`（' / ' 或 ' and '）。
 *
 * **Steps.status（源 view.tsx:783-787）**：status===3||15||40 ? 'error' : 'process'
 * （util `resolveApprovalStepStatus` 已抽出，复用）。
 */

export interface ApprovalManageApprovalLogProps {
  /** taskApprovedDetailApi 返回（taskCreateInfo + recordList + approveType）。 */
  taskInfo?: ApprovalLog;
  /** 当前任务状态（决定 Steps.status error/process；detail-page 四套 status 派生结果）。 */
  status?: number;
  /** 业务码（首节点 sp_open_wallet 例外：不展示创建人，源 view.tsx:276-282）。 */
  busCode?: string;
}

/** 审批节点（首节点 taskCreateInfo + recordList 各条）。 */
interface ApprovalStep {
  /** 节点标题（ReactNode，含待审批N人插值）。 */
  title: React.ReactNode;
  /** 节点描述（时间/操作人/备注/待审人列表）。 */
  description: React.ReactNode;
}

/** 待审人列表的折叠展示（>5 截断 + Tooltip 其余）。分隔符随 approveType 变化。 */
function ReviewerNameList({
  names,
  separator,
}: {
  names: string[];
  separator: string;
}): React.JSX.Element {
  const t = useTranslations('modules.approval-manage');
  if (names.length > 5) {
    const rest = names.slice(5);
    return (
      <span className="text-foreground">
        {names.slice(0, 5).join(separator)}
        {'…'}
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="ml-1 cursor-pointer text-primary underline">
                {t('approval_manage_0050', { count: rest.length })}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs whitespace-normal">{rest.join(separator)}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </span>
    );
  }
  return <span className="text-foreground">{names.join(separator)}</span>;
}

export function ApprovalManageApprovalLog({
  taskInfo,
  status,
  busCode,
}: ApprovalManageApprovalLogProps): React.JSX.Element {
  const t = useTranslations('modules.approval-manage');

  const approveType = taskInfo?.approveType;
  // 源 view.tsx:328 `t('approve_type_${taskApprovedDetail?.approveType}')`：1=' / '，2=' and '。
  // 仅 1/2 有词条；approveType 为 undefined/未知时回落 approve_type_1（' / '），
  // 避免 next-intl 对 `approve_type_` / `approve_type_undefined` 抛 MISSING_MESSAGE（运行时坑）。
  const separatorKey = (
    approveType === 1 || approveType === 2
      ? `approve_type_${approveType}`
      : 'approve_type_1'
  ) as Parameters<typeof t>[0];
  const separator = t(separatorKey);

  // ── 节点列表 + approvedCurrent（同步 useMemo，源 view.tsx:272-436） ──────────
  const { steps, current } = React.useMemo<{
    steps: ApprovalStep[];
    current: number;
  }>(() => {
    const taskCreateInfo = taskInfo?.taskCreateInfo;
    const recordList = taskInfo?.recordList ?? [];

    // 首节点（源 view.tsx:275-285）：Create + 时间（+ 创建人，sp_open_wallet 无创建人）。
    const createUserName = taskCreateInfo?.createUserName;
    const showCreator = busCode !== 'sp_open_wallet' && !!createUserName;
    const items: ApprovalStep[] = [
      {
        title: t('approval_manage_0035'),
        description: (
          <div>
            {formatTimestamp(
              typeof taskCreateInfo?.createTime === 'number'
                ? taskCreateInfo.createTime
                : undefined,
            )}
            {showCreator ? <>{t('approval_manage_0036')}<span className="text-foreground">{createUserName}</span></> : null}
          </div>
        ),
      },
    ];

    recordList.forEach((el) => {
      const operationType = Number(el.operationType);
      const names = Array.isArray(el.reviewerUserNameList)
        ? (el.reviewerUserNameList.filter(Boolean) as string[])
        : [];

      // 节点标题 5 态（源 view.tsx:292-311）。
      let title: React.ReactNode;
      if (operationType === 0) {
        // 源 t('approval_manage_0029').replace('${total}', names.length)。
        title = (
          <div>
            {t('approval_manage_0029', { total: names.length })}
          </div>
        );
      } else if (operationType === 1) {
        title =
          Number(el.reviewerStatus) === 3
            ? t('approval_manage_0019')
            : t('record_status_2');
      } else if (operationType === 2) {
        title = t('approval_manage_0005');
      } else if (operationType === 3) {
        title = t('approval_manage_0006');
      } else {
        title = t('approval_manage_0002');
      }

      // 节点描述（源 view.tsx:312-422）。
      let description: React.ReactNode;
      if (operationType === 0) {
        // 待审批：Pending + Assignees 列表（源 view.tsx:314-358）。
        description = (
          <div>
            <div>{t('approval_manage_0030')}</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span>{`${t('approval_manage_0031')}:`}</span>
              <ReviewerNameList names={names} separator={separator} />
            </div>
          </div>
        );
      } else {
        // 已操作：时间 + 操作人 + 备注；升级(operationType===2)额外展示审批人列表
        // （源 view.tsx:360-418）。
        description = (
          <div>
            <div>
              {formatTimestamp(
                typeof el.operationTime === 'number' ? el.operationTime : undefined,
              )}
              {el.operationUserName ? <> {t('approval_manage_0036')}<span className="text-foreground">{el.operationUserName}</span></> : null}
            </div>
            <div className="mt-1">{`${t('PUB_Comment')} : `}<span className="text-foreground">{el.operationRemarks ?? ''}</span></div>
            {operationType === 2 && names.length > 0 ? (
              <div className="mt-1 flex items-start">
                <span className="max-w-[25%] pr-1">
                  {t('approval_manage_0037', { length: names.length })}
                </span>
                <ReviewerNameList names={names} separator={separator} />
              </div>
            ) : null}
          </div>
        );
      }

      items.push({ title, description });
    });

    // ── approvedCurrent 同步计算（源 view.tsx:425-436） ──────────────────────
    // 源 setTimeout 异步读 approvedCurrent state（加载时 reset 0），同步化后 state 恒 0，
    // 故 else 分支 = 1 + stepIndex - (flag?1:0)，与源等价且无时序竞态（计划 §7 步骤 12）。
    const stepIndex = recordList.findIndex(
      (el) => Number(el.operationType) === 0 || Number(el.operationType) === 4,
    );
    const flag = status === 15;
    const resolvedCurrent =
      stepIndex === -1
        ? items.length - (flag ? 1 : 0)
        : 1 + stepIndex - (flag ? 1 : 0);

    return { steps: items, current: resolvedCurrent };
  }, [taskInfo, status, t, separator, busCode]);

  const isError = resolveApprovalStepStatus(status) === 'error';
  const errorIndex = isError ? Math.min(current, steps.length - 1) : -1;
  const items: TimelineItem[] = steps.map((step, idx) => ({
    key: idx,
    title: step.title,
    description: step.description,
    status: idx === errorIndex ? 'error' : idx < current ? 'complete' : idx === current ? 'current' : 'upcoming',
  }));

  return <Timeline items={items} ariaLabel={t('approval_manage_0008')} />;
}

export default ApprovalManageApprovalLog;
