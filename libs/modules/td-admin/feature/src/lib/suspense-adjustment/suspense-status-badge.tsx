/**
 * Suspense Status Badge — 通用状态标签。
 *
 * 把 util 层 StatusTone.color（语义色名：red/orange/green/gold/blue/default）
 * 映射到 Tailwind badge class。clearStatus / adjustmentStatus / age 三类状态共用。
 *
 * 迁移自源的 antd `<Tag color>` 渲染（CLEAR_STATUS_MAP / ADJUSTMENT_STATUS_MAP /
 * AGE_TAG_TONES 的 color 字段）。
 */
const TONE_CLASS: Record<string, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  green: 'border-green-200 bg-green-50 text-green-700',
  gold: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  default: 'border-gray-200 bg-gray-50 text-gray-600',
};

export interface SuspenseStatusBadgeProps {
  /** 语义色名（util StatusTone.color 或 AGE_TAG_TONES 值）。 */
  tone: string;
  /** 展示文案。 */
  label: string;
}

export function SuspenseStatusBadge({ tone, label }: SuspenseStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        TONE_CLASS[tone] ?? TONE_CLASS.default
      }`}
    >
      {label}
    </span>
  );
}
