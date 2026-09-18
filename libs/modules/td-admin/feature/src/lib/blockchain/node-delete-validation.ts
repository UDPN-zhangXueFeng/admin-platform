/**
 * 节点删除 Modal URL 严格校验 —— 纯函数（无 React 依赖，可单测）。
 *
 * 迁移自 td-manage src/pages/blockchain/node/index.tsx 的删除确认 CustomModal
 * 校验逻辑（文档步骤 9 / bc-10）。
 *
 * 业务规则（硬约束：URL 严格相等校验）：
 * - 用户输入必须**严格 === modalInfo.url**（含协议/路径完整）才通过校验。
 * - 源码逻辑：`value !== modalInfo.url` 即报错，错误文案动态拼接
 *   `Please fill in ${url}`。
 * - 空 → deleteInputRequired（必填）；
 * - 非空但不等 → deleteInputMismatch（{url} 插值）。
 *
 * 返回 react-hook-form `validate` 约定的结果：true = 通过，string = 错误文案。
 *
 * 抽离为纯函数以便覆盖空/严格相等/差一字符/前后空格边界，对齐
 * mmf batch-apply-selection 的抽离模式。
 */

/**
 * 校验用户输入是否严格等于目标 URL。
 *
 * @param value    用户输入（react-hook-form note 字段值）。
 * @param target   modalInfo.url（校验基准）。
 * @param messages 错误文案工厂：
 *   - required：空输入错误文案。
 *   - mismatch：不匹配错误文案（接收 {url} 用于插值）。
 * @returns `true` 通过；否则返回错误文案（string）。
 */
export function validateDeleteUrl(
  value: string,
  target: string,
  messages: { required: string; mismatch: (url: string) => string },
): true | string {
  if (!value) {
    return messages.required;
  }
  // 严格相等：含协议/路径完整（源码 value !== modalInfo.url）。
  return value === target || messages.mismatch(target);
}
