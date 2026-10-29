/**
 * reSet - 上游千分位金额格式化的逐分支等价实现。
 *
 * 源: td-manage `libs/utils/index.ts:44-62` 的 reSet（len 固定 2；2026-10-28 逐行核对）。
 * tokenized-deposit 页面（index.tsx / view.tsx）import 的正是这个变体，页内 8 处
 * 调用全部使用默认 len=2：
 * - `!(Number(value) >= 0)`（undefined/NaN/负数）-> '--'
 * - null / 0 / '' 经 Number() 归 0 -> "0.00"
 * - 其余 -> Number(value).toFixed(2)（**四舍五入**，'1.999' -> "2.00"）+ 整数千分位
 *
 * 注意区分上游同名的 `src/utils/index.ts:24-41` 变体（falsy->"0.00"、小数截断、
 * 负数正常千分位）——它是 sp-access / financial 等模块的实现，tokenized-deposit
 * 并不使用；libs/utils 内被注释掉的旧代码恰好就是该截断变体，上游作者已明确弃用。
 * round-01 ISSUE-3 首版修复曾误锚定 src/utils 变体，本轮（round-02 review F2）修正。
 *
 * 上游 len 参数（非 2 时千分位正则不同）在本模块无调用方，不予实现。
 */
export function reSet(value: unknown): string {
  if (!(Number(value) >= 0)) {
    return '--';
  }
  return Number(value)
    .toFixed(2)
    .replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
}
