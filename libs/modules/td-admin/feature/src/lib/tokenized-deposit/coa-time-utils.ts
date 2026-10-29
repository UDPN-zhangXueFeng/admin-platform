'use client';

import { format, parse } from 'date-fns';

import type { CoaSetupOption } from './coa-setup-types';

/**
 * COA 卡片时间（HH:mm:ss）解析/格式化与 fallback option 构造工具
 * （parseTimeValue / formatTimeValue / buildFallbackOption / FALLBACK_SELECT_VALUE）。
 * 源: coa-setup-card.tsx 131-199（纯代码搬移；仅给跨文件共享项加 export）。
 */

// ── 时间格式（HH:mm:ss）常量与转换 ──

/** EOD 截止时间格式（与源 antd TimePicker format 一致）。 */
const EOD_TIME_FORMAT = 'HH:mm:ss';

/**
 * Radix Select 坑（arch 文档第 12 节坑 2）：SelectItem value 禁止空串。
 * fallback option 的 value 无可用 code 时，用此占位符，避免触发 Radix 警告。
 */
export const FALLBACK_SELECT_VALUE = '__coa_fallback__';

/** date-fns parse 的参考基准日期（任意合法 Date 均可，只取时分秒）。 */
const TIME_REFERENCE_DATE = new Date(1970, 0, 1);

/**
 * `HH:mm:ss`（数据层）→ 控件值（`HH:mm:ss`，原生 time input 秒级精度）。
 *
 * 用 date-fns `parse` 解析 `HH:mm:ss`（项目未装 dayjs，见 arch 文档第 6 节），
 * 再按 `HH:mm:ss` 输出。非法值回落空串，使控件显示 placeholder 而非脏值。
 *
 * `step={1}` 使原生控件显示和编辑秒位，与旧 TimePicker 的 `HH:mm:ss` 格式一致。
 */
export function parseTimeValue(value?: string): string {
  if (!value) return '';

  const parsed = parse(value, EOD_TIME_FORMAT, TIME_REFERENCE_DATE);
  if (Number.isNaN(parsed.getTime())) return '';

  return format(parsed, EOD_TIME_FORMAT);
}

/**
 * 控件值（`HH:mm:ss`）→ `data.eodCutOffTime`（`HH:mm:ss`）。
 *
 * 兼容浏览器仅返回 `HH:mm` 的情况，缺失秒位时补 `00`。
 */
export function formatTimeValue(controlValue: string): string {
  if (!controlValue) return '';

  const parsed = parse(
    controlValue,
    controlValue.length === 5 ? 'HH:mm' : EOD_TIME_FORMAT,
    TIME_REFERENCE_DATE,
  );
  if (Number.isNaN(parsed.getTime())) return '';

  return format(parsed, EOD_TIME_FORMAT);
}

// ── fallback option 构造 ──

/**
 * 当传入 options 为空但 data 有值时，构造单元素 fallback option，
 * 保证 Select 在只读/回填态仍能展示当前选中项。
 *
 * value 禁止空串（Radix 坑）：code 为空时用 {@link FALLBACK_SELECT_VALUE} 占位。
 */
export function buildFallbackOption(
  value: string | undefined,
  label: string | undefined,
): CoaSetupOption[] {
  if (!value && !label) return [];
  return [
    {
      value: value || FALLBACK_SELECT_VALUE,
      label: label || value || '',
    },
  ];
}
