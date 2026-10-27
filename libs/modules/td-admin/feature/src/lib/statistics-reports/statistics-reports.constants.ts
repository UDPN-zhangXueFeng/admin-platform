/** Time-range presets offered by the activity filter (`custom` reveals the date pickers). */
export type TimeRangePreset = 'last7days' | 'last14days' | 'lastMonth' | 'custom';

export const DEFAULT_TIME_RANGE = 'last7days';

/** Preset list with the i18n keys used to render their labels. */
export const TIME_RANGE_OPTIONS: readonly { value: TimeRangePreset; labelKey: string }[] = [
  { value: 'last7days', labelKey: 'statistics_reports_0030' },
  { value: 'last14days', labelKey: 'statistics_reports_0031' },
  { value: 'lastMonth', labelKey: 'statistics_reports_0032' },
  { value: 'custom', labelKey: 'statistics_reports_0033' },
];

export const TABLE_PAGE_SIZE = 10;

/**
 * Every message key the page (and the print/export flow) may need. The page
 * resolves them once via `t.raw` and hands the plain record to
 * `downloadStatisticsReport`, which renders outside any i18n provider.
 */
export const STATISTICS_REPORT_MESSAGE_KEYS: readonly string[] = [
  ...Array.from({ length: 47 }, (_, index) => `statistics_reports_${String(index + 1).padStart(4, '0')}`),
  'date',
  'index',
  'invalidDateRange',
  'loadFailed',
  'loading',
  'popupBlocked',
  'preparingReport',
  'printReport',
  'reportTitle',
  'retry',
  'spTitle',
  'topUp',
  'transfer',
  'walletTitle',
  'withdrawal',
];
