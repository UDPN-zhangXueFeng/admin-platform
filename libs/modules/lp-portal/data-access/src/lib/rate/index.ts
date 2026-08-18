/**
 * rate 域 barrel（model / keys / api / queries）。
 *
 * 只读域：源 rate 页无任何写端点，故无 mutations 五件套成员。
 * 域内导出由收口员在 data-access 主 barrel 补 `export * from './lib/rate'`。
 */
export * from './rate.model';
export * from './rate.keys';
export * from './rate.api';
export * from './rate.queries';
