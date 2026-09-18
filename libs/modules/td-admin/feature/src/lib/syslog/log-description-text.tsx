'use client';

import * as React from 'react';

export interface LogDescriptionTextProps {
  /** 日志描述原文。 */
  desc?: string | null;
  /** 触发截断的字符数阈值，默认 50（对齐旧页）。 */
  max?: number;
  /** 展开/收起按钮文案。 */
  moreLabel: string;
}

/**
 * 日志描述单元格：超长文本截断 + 行内展开/收起。
 *
 * 复刻旧页 (td-manage sys/sysLog) `desc` 列的截断交互（substring(0, 50) + "..." + 更多），
 * 但把"更多"从无效 `<a>` 改为可控按钮，并补齐收起能力。
 */
export function LogDescriptionText({ desc, max = 50, moreLabel }: LogDescriptionTextProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (!desc) {
    return <span className="text-muted-foreground">--</span>;
  }

  if (desc.length <= max) {
    return <span>{desc}</span>;
  }

  return (
    <span>
      {expanded ? desc : `${desc.substring(0, max)}... `}
      <button
        type="button"
        className="text-primary hover:underline"
        onClick={() => setExpanded((v) => !v)}
      >
        {moreLabel}
      </button>
    </span>
  );
}
