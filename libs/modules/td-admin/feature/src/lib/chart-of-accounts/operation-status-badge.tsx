'use client';

import { Badge } from '@myorg/shared/ui';

/**
 * 审批任务状态码 → 视觉语调（源 `approval_task_status_color_*` 的 antd 色名映射）。
 * 白名单避免 next-intl 对缺失 key 抛错；未知值按源行为直接展示数字。
 */
const TASK_STATUS_TONES: Record<
  number,
  'success' | 'warning' | 'info' | 'destructive' | 'mute'
> = {
  1: 'info',
  3: 'mute',
  5: 'warning',
  10: 'warning',
  15: 'destructive',
  20: 'success',
  25: 'success',
  30: 'info',
  35: 'success',
  40: 'destructive',
  45: 'destructive',
};

export interface OperationStatusBadgeProps {
  status?: number;
  /** `common` 命名空间翻译（`common_task_status_${status}`）。 */
  tCommon: (key: string) => string;
}

/** 操作记录审批状态徽标（文案走全局 `common_task_status_*` 词条）。 */
export function OperationStatusBadge({
  status,
  tCommon,
}: OperationStatusBadgeProps) {
  if (status === undefined || status === null) {
    return <span className="text-muted-foreground">--</span>;
  }

  const tone = TASK_STATUS_TONES[status];
  if (!tone) return <span>{String(status)}</span>;

  return (
    <Badge variant={tone} dot>
      {tCommon(`common_task_status_${status}`)}
    </Badge>
  );
}
