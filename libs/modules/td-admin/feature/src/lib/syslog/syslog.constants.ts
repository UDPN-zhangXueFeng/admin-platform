/**
 * Syslog 模块常量与纯工具函数。
 *
 * 仅放无副作用的展示型工具（模块名格式化、分页默认值）。
 * 操作类型文案走 i18n（`modules.syslog.operationType.<code>`），不在此硬编码。
 */

/** 默认每页条数，对齐旧页 useCustomTable 的分页默认。 */
export const SYSLOG_PAGE_SIZE = 10;

/**
 * 将后端模块标识格式化为可读标题：
 * `TOKEN_MANAGEMENT` → `Token Management`。
 *
 * 与旧页 (td-manage sys/sysLog) 列渲染逻辑保持 1:1：按下划线拆分后逐词首字母大写。
 */
export function formatModuleName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
