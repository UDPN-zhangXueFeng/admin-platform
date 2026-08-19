/**
 * 改密表单共享校验（源 change-pwd / profile 两处 rules 完全一致，抽公共）。
 *
 * 规则 1:1：原密码必填；新密码必填且 /^(?=.*[A-Za-z])(?=.*\d).{8,}$/；
 * 确认密码仅校验与新密码一致（源无必填规则，空串即不一致提示）。
 */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export interface PwdFormState {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const EMPTY_PWD_FORM: PwdFormState = {
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/** 逐字段校验，返回字段名 → 错误文案（空对象即通过）。 */
export function validatePwdForm(
  form: PwdFormState,
): Partial<Record<keyof PwdFormState, string>> {
  const errors: Partial<Record<keyof PwdFormState, string>> = {};
  if (!form.oldPassword) errors.oldPassword = 'Please enter your current password';
  if (!form.newPassword) {
    errors.newPassword = 'Please enter a new password';
  } else if (!PASSWORD_PATTERN.test(form.newPassword)) {
    errors.newPassword = 'At least 8 characters with letters and numbers';
  }
  if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  return errors;
}
