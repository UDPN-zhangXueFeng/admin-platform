/**
 * User 模块表单校验规则与文案键（user.md §5.3）。
 *
 * 对齐 td-manage sys/user/edit.tsx 的 antd rules。旧页未用 Zod，此处亦不引入，
 * 仅提供常量 + 校验谓词，由 feature 层在 react-hook-form 的 `register`/`Controller`
 * rules 中直接引用，与 role 模块的校验风格保持一致（Rule 11）。
 *
 * 规则（user.md §5.3）：
 *  - userName：必填，正则 `/^[a-zA-Z][a-zA-Z0-9]{0,20}$/`（字母开头，字母+数字，≤20）。
 *  - email：必填 + email 类型。
 *  - phoneNumber：非必填（旧代码注释掉了 required）。
 *  - roleIds：必填 array。
 *  - tdIds：非必填 array（但被管理员角色联动时会自动全选）。
 */

/** userName 校验正则：字母开头，仅字母+数字，长度 1–20（user.md §5.3）。 */
export const USER_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{0,20}$/;

/** email 校验正则（与旧页 antd `type: 'email'` 等价的轻量实现）。 */
export const USER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** userName 最大长度（对齐旧页 Input maxLength）。 */
export const USER_NAME_MAX_LENGTH = 20;

/** 判断 userName 是否合法（非空 + 正则）。 */
export function isValidUserName(value: string | undefined | null): boolean {
  return typeof value === 'string' && USER_NAME_PATTERN.test(value);
}

/** 判断 email 是否合法（非空 + 正则）。 */
export function isValidEmail(value: string | undefined | null): boolean {
  return typeof value === 'string' && USER_EMAIL_PATTERN.test(value);
}
