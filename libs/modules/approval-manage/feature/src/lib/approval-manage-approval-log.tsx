'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@myorg/shared/ui';

import type { ApprovalLog } from '@myorg/modules/approval-manage/data-access';
import {
  formatTimestamp,
  resolveApprovalStepStatus,
} from '@myorg/modules/approval-manage/util';

/**
 * ApprovalManageApprovalLog — Steps 垂直审批日志。
 *
 * 迁移自 td-manage `src/pages/approval-manage/view.tsx` 的 `taskApprovedSteps`
 * useMemo（L272-439）+ Collapse 内 `<Steps direction="vertical">`（L779-793）。
 *
 * **为什么自己渲染 timeline 而非用 antd Steps**：目标库 `@myorg/shared/ui` 未导出
 * Steps 组件（计划 §6.4「实现期确认，否则简单 timeline」）。此处用语义化 `<ol>` 实现
 * 垂直步骤条，逐节点保留源 Steps 的 title/description/current/status 语义：
 * - 已完成节点：实心圆 + 主色连线（源 `finish`）。
 * - 当前节点：主色描边圆（源 `process`）；status error 时整条变红（源 Steps.status）。
 * - 未来节点：灰圆。
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
 * **reviewerUserNameList>5 折叠（源 view.tsx:321-356 / 378-416）**：slice(0,5)+'...'，
 * 其余 Tooltip（trigger=click），分隔符 `approve_type_{approveType}`（' / ' 或 ' and '）。
 *
 * **Steps.status（源 view.tsx:783-787）**：status===3||15||40 ? 'error' : 'process'
 * （util `resolveApprovalStepStatus` 已抽出，复用）。
 */

export interface ApprovalManageApprovalLogProps {
  /** taskApprovedDetailApi 返回（taskCreateInfo + recordList + approveType）。 */
  taskInfo?: ApprovalLog;
  /** 当前任务状态（决定 Steps.status error/process；detail-page 四套 status 派生结果）。 */
  status?: number;
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
  if (names.length > 5) {
    const rest = names.slice(5);
    return (
      <span>
        {names.slice(0, 5).join(separator)}
        {'...'}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-1 cursor-pointer text-primary underline">
                {`${rest.length} more`}
              </span>
            </TooltipTrigger>
            <TooltipContent>{rest.join(separator)}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </span>
    );
  }
  return <span>{names.join(separator)}</span>;
}

export function ApprovalManageApprovalLog({
  taskInfo,
  status,
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

    // 首节点（源 view.tsx:275-285）：Create + 时间（+ 操作人，sp_open_wallet 无操作人）。
    const items: ApprovalStep[] = [
      {
        title: t('approval_manage_0035'),
        description: (
          <div className="mt-1 text-foreground">
            {formatTimestamp(
              typeof taskCreateInfo?.createTime === 'number'
                ? taskCreateInfo.createTime
                : undefined,
            )}
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
            <div className="mt-1">{t('approval_manage_0030')}</div>
            <div className="mt-1 flex items-start">
              <span className="mr-2">{`${t('approval_manage_0031')}:`}</span>
              <ReviewerNameList names={names} separator={separator} />
            </div>
          </div>
        );
      } else {
        // 已操作：时间 + 操作人 + 备注；升级(operationType===2)额外展示审批人列表
        // （源 view.tsx:360-418）。
        description = (
          <div className="text-foreground">
            <div className="mt-1">
              {formatTimestamp(
                typeof el.operationTime === 'number' ? el.operationTime : undefined,
              )}
              {el.operationUserName ? ` ${t('approval_manage_0036')}${el.operationUserName}` : ''}
            </div>
            <div className="mt-1">{`${t('PUB_Comment')} : ${el.operationRemarks ?? ''}`}</div>
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
  }, [taskInfo, status, t, separator]);

  const isError = resolveApprovalStepStatus(status) === 'error';
  const lineColor = isError ? 'bg-red-500' : 'bg-primary';

  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const isCurrent = idx === current;
        const isDone = idx < current;
        return (
          <li key={idx} className="flex gap-3 pb-6 last:pb-0">
            {/* 指示圆 + 连线 */}
            <div className="flex flex-col items-center">
              <span
                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  isCurrent
                    ? isError
                      ? 'border-red-500'
                      : 'border-primary'
                    : isDone
                      ? `border-primary ${lineColor}`
                      : 'border-muted-foreground/40'
                }`}
                aria-hidden="true"
              >
                {isDone ? (
                  <span className={`h-1.5 w-1.5 rounded-full ${lineColor}`} />
                ) : null}
              </span>
              {!isLast ? (
                <span
                  className={`mt-1 w-0.5 flex-1 ${isDone ? lineColor : 'bg-muted-foreground/30'}`}
                />
              ) : null}
            </div>
            {/* 内容 */}
            <div className="min-w-0 flex-1 -mt-0.5">
              <div
                className={`text-sm font-medium ${
                  isError && (isCurrent || isDone)
                    ? 'text-red-600'
                    : 'text-foreground'
                }`}
              >
                {step.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {step.description}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default ApprovalManageApprovalLog;
