import { CopyableEllipsisText } from '@myorg/shared/ui';

/**
 * Journal Entries 的长哈希 / 地址单元格。
 *
 * from / to / txHash 三列共用：统一默认 `maxWidth` 与 copy 文案，避免在
 * feature 层 columns 中重复传参。空值由底层 `CopyableEllipsisText` 兜底为 '--'。
 */
export interface JournalTxHashCellProps {
  /** 哈希 / 地址值。 */
  value?: string | null;
  /** 截断前的最大宽度（px）。默认 160（对齐源列表列宽 170）。 */
  maxWidth?: number;
  /** 复制动作的 tooltip 文案。 */
  copyLabel?: string;
}

export function JournalTxHashCell({
  value,
  maxWidth = 160,
  copyLabel,
}: JournalTxHashCellProps) {
  return (
    <CopyableEllipsisText value={value} maxWidth={maxWidth} copyLabel={copyLabel} />
  );
}
