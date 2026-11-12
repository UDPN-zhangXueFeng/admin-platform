/**
 * Kissen 跨行转账模块共享常量与格式化工具（列表页、详情页共用）。
 *
 * 迁移自 td-manage `src/lib/constants/kissen-transfer.ts`；文案走 i18n key，
 * 与旧页的状态/阶段码保持一致（40 为历史完成码，仅存量数据）。
 */

/** 空值占位（与 admin 其他模块一致）。 */
export const KISSEN_EMPTY_DISPLAY = '--';

/** 列表行「Details」按钮权限码（旧列表 actions.limit）。 */
export const KISSEN_TRANSFER_PERMISSIONS = {
  DETAILS_BTN: '0f31469d73c341efb7ad2c1723837ad9',
} as const;

export type KissenStatusVariant =
  | 'mute'
  | 'info'
  | 'success'
  | 'warning'
  | 'destructive';

/** 交易状态码 → 文案 key 与 Badge variant（对齐 gateway PROTO_TX_STATUS）。 */
export const KISSEN_TX_STATUS: Record<
  number,
  { labelKey: string; variant: KissenStatusVariant }
> = {
  1: { labelKey: 'kissen_transfer_status_1', variant: 'mute' },
  5: { labelKey: 'kissen_transfer_status_5', variant: 'info' },
  10: { labelKey: 'kissen_transfer_status_10', variant: 'info' },
  20: { labelKey: 'kissen_transfer_status_20', variant: 'info' },
  25: { labelKey: 'kissen_transfer_status_25', variant: 'info' },
  30: { labelKey: 'kissen_transfer_status_30', variant: 'info' },
  35: { labelKey: 'kissen_transfer_status_35', variant: 'success' },
  40: { labelKey: 'kissen_transfer_status_40', variant: 'success' },
  50: { labelKey: 'kissen_transfer_status_50', variant: 'warning' },
  60: { labelKey: 'kissen_transfer_status_60', variant: 'warning' },
  70: { labelKey: 'kissen_transfer_status_70', variant: 'destructive' },
  80: { labelKey: 'kissen_transfer_status_80', variant: 'mute' },
  90: { labelKey: 'kissen_transfer_status_90', variant: 'destructive' },
};

/** 状态筛选下拉值（对齐旧页：排除历史码 40；空串 = All，由页面转换）。 */
export const KISSEN_STATUS_FILTER_CODES: readonly number[] = Object.keys(
  KISSEN_TX_STATUS,
)
  .map(Number)
  .filter((code) => code !== 40);

/** 终态码：完成时刻取链路终态阶段的结束时间。 */
export const KISSEN_TERMINAL_STATUSES: readonly number[] = [
  35, 40, 60, 80, 90,
];

/** 六段阶段业务标题（stageStep 1~6）。 */
export const KISSEN_STAGE_TITLE_KEYS: Record<number, string> = {
  1: 'kissen_transfer_stage_1',
  2: 'kissen_transfer_stage_2',
  3: 'kissen_transfer_stage_3',
  4: 'kissen_transfer_stage_4',
  5: 'kissen_transfer_stage_5',
  6: 'kissen_transfer_stage_6',
};

/**
 * Token 数量：千分位，按精度去尾零；空值 → '--'。
 * 迁移自旧 `formatTokenAmount`（默认精度 8）。
 */
export function formatTokenAmount(
  value?: number | string | null,
  precision = 8,
): string {
  if (value === null || value === undefined || value === '') {
    return KISSEN_EMPTY_DISPLAY;
  }
  const num = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(num)) return String(value);
  const [int, frac = ''] = num.toFixed(precision).split('.');
  const grouped = Number(int).toLocaleString('en-US');
  const fraction = frac.replace(/0+$/, '');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** 汇率：固定 4 位小数；空值 → '--'。 */
export function formatRate(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') {
    return KISSEN_EMPTY_DISPLAY;
  }
  const num = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(num) ? num.toFixed(4) : String(value);
}

/** 时长：`70 ms` / `52s` / `2m 05s` / `3h 38m`；空或负值 → '--'。 */
export function formatDuration(ms?: number | null): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) {
    return KISSEN_EMPTY_DISPLAY;
  }
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds
      ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
      : `${minutes}m`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** 布尔类字段兼容 boolean / 1 / '1'。 */
export function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}
