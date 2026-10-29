/**
 * DeploymentSteps — 合约部署 Tab 顶部三步指示器（Create / Approval / Deployment Contract）。
 *
 * 源: tab-contracts.tsx 78-92（STEP_LABELS + deriveStepCurrent）、146-195
 * （DeploymentSteps 自建 Steps：flex + Progress）。td.type===0 时由
 * OverviewContractsTab 渲染。
 */
'use client';

import * as React from 'react';
import { Progress } from '@myorg/shared/ui';
import { APPLY_STATUS } from '@myorg/modules/td-admin/data-access';

/** Steps 三步标题（源码硬编码英文，按需补 i18n 可后续迭代）。 */
const STEP_LABELS = ['Create', 'Approval', 'Deployment Contract'] as const;

/**
 * 由 applyStatus 推导 Steps current（对齐源 1149-1155 行）。
 *
 * applyStatus===5(REVIEWING) → 1（Approval）
 * applyStatus===20(PENDING_DEPLOY) → 2（Deployment Contract）
 * 其它 → 3（Deployment Contract，末步/完成态）
 */
export function deriveStepCurrent(applyStatus?: number): number {
  if (applyStatus === APPLY_STATUS.REVIEWING) return 1;
  if (applyStatus === APPLY_STATUS.PENDING_DEPLOY) return 2;
  return 3;
}

// ═══════════════════════════════════════════════════════════════════
// Steps（type===0）：Create / Approval / Deployment Contract
// ═══════════════════════════════════════════════════════════════════

/**
 * 三步指示器（shared/ui 无 Steps，用 flex + Progress 自建）。
 *
 * current 为 0-base：0=Create、1=Approval、2=Deployment Contract。
 * 当前步及之前标为主色 + 勾，未来步标灰。对齐源 antd Steps size="small"。
 */
export function DeploymentSteps({ current }: { current: number }): React.JSX.Element {
  return (
    <ol className="mx-auto my-2 flex w-[80%] items-center">
      {STEP_LABELS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            className="flex flex-1 items-center last:flex-none"
            aria-current={active ? 'step' : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                className={[
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  done || active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground',
                ].join(' ')}
              >
                {done ? '✓' : index + 1}
              </span>
              <span
                className={[
                  'text-sm font-medium',
                  done || active ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {index < STEP_LABELS.length - 1 ? (
              <Progress
                value={done ? 100 : 0}
                className="mx-3 h-1 flex-1"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
