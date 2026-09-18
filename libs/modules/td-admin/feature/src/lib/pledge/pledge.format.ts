/**
 * pledge 模块格式化工具。
 *
 * - formatValue：银行卡号 4 位分组（源 reserve-asset-list/index.tsx:592 + view.tsx:244 + edit.tsx:85）
 * - formatCurrency：Intl.NumberFormat 货币格式化，含 USDT 等非法 ISO code 的降级处理（源 new-view.tsx:153）
 * - formatDecimalInput：限制两位小数（源 asset-transaction/edit.tsx:303 getValueFromEvent）
 */

/**
 * 银行卡号格式化：移除所有空白 → 每 4 位分组加空格。
 *
 * @example formatValue('6222021234567890') → '6222 0212 3456 7890'
 */
export function formatValue(value: string): string {
  const cleanValue = value.replace(/\s/g, '');
  return cleanValue.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * 安全的货币金额格式化。
 *
 * 优先使用 Intl.NumberFormat 按 ISO 4217 货币码格式化；
 * 如果货币码非法（如 USDT 非 ISO 标准）导致 Intl 抛异常，降级为纯数字
 * 两位小数 + 货币码后缀。
 *
 * @param amount 金额数值
 * @param currency 货币码（如 'HKD', 'USD', 'USDT'）
 * @returns 格式化字符串，如 '1,234.56 HKD'
 */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
      })
        .format(amount)
        // 去掉 Intl 自动追加的货币码，统一用后缀格式
        .replace(currency.toUpperCase(), '') + ` ${currency.toUpperCase()}`
    );
  } catch {
    // 货币码非法（如 USDT），降级为纯数字 + 后缀
    return (
      new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount) + ` ${currency.toUpperCase()}`
    );
  }
}

/**
 * 限制输入仅允许两位小数。
 *
 * 用于 asset-transaction/edit.tsx 的 Asset Value getValueFromEvent，
 * 在 react-hook-form register 的 onChange 前调用。
 *
 * @param raw 原始输入值（string | number | undefined | null）
 * @returns 清理后的字符串（仅允许数字 + 至多两位小数）
 *
 * @example formatDecimalInput('123.456') → '123.45'
 * @example formatDecimalInput('abc12.3def') → '12.3'
 */
export function formatDecimalInput(
  raw: string | number | undefined | null,
): string {
  if (raw === undefined || raw === null) return '';
  let value = String(raw).replace(/[^\d.]/g, '');
  // 只保留第一个小数点
  const firstDot = value.indexOf('.');
  if (firstDot !== -1) {
    const intPart = value.slice(0, firstDot);
    const decPart = value.slice(firstDot + 1).replace(/\./g, '');
    value = `${intPart}.${decPart.slice(0, 2)}`;
  }
  return value;
}
