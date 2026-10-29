/**
 * StepItemView — 合约部署 Modal 单步进度渲染（标题 + Progress + 状态图标）。
 *
 * 源: deploy-contract-modal.tsx 67-80（StepRow + STEP_TITLE_KEYS，源 smartContractArr）、
 * 99-149（StepItemView）。由 DeployContractModal 步骤区逐项渲染。
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Progress } from '@myorg/shared/ui';

/** stepDetailList 真实行（源 el.state / el.deployProcess）。 */
export interface StepRow {
  state?: number;
  deployProcess?: number;
}

/** 步骤标题数组（源 smartContractArr，tokenized_deposit_0040/0038/0039/0040_2/0040_1）。 */
export const STEP_TITLE_KEYS = [
  'tokenized_deposit_0040',
  'tokenized_deposit_0038',
  'tokenized_deposit_0039',
  'tokenized_deposit_0040_2',
  'tokenized_deposit_0040_1',
];

/**
 * 单步渲染（标题 + Progress + 状态图标）。
 *
 * 状态硬色（源 2232-2248）：
 * - 3 → FieldTime（Clock），text-theme。
 * - 4 → Loading（Loader2），text-[#F4AA00]。
 * - 其它 → CheckCircle（CheckCircle2），text-[#87ca87]。
 */
export function StepItemView({
  index,
  title,
  progress,
  state,
}: {
  index: number;
  title: string;
  progress: number;
  state?: number;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1">
        <div>
          <span className="font-semibold">Step {index + 1}:</span> {title}
        </div>
        <div className="mt-2 pl-6">
          <Progress value={progress} />
        </div>
      </div>
      <div className="flex items-center text-primary">
        {state === 3 ? (
          <span className="flex items-center">
            <Clock className="mr-1 h-4 w-4" />
            {t(`step_status_${state}`)}
          </span>
        ) : state === 4 ? (
          <span className="flex items-center text-[#F4AA00]">
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            {t(`step_status_${state}`)}
          </span>
        ) : (
          <span className="flex items-center text-[#87ca87]">
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {t(`step_status_${state ?? 0}`)}
          </span>
        )}
      </div>
    </div>
  );
}
