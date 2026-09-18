/**
 * Workflow stepName 展示串与传输串的互转工具（脆弱设计，勿重构）。
 *
 * 来源：td-manage edit.tsx。旧实现把「审批人名 join 串」当成数据存储字段 `stepName`，
 * 用 `' / '`（展示）与 `'-'`（传输）两种分隔符做 split/join 来回转换：
 *   - 详情回填：`stepName.replaceAll('-', ' / ')`（传输串 → 展示串）
 *   - 提交保存：`stepName.replaceAll(' / ', '-')`（展示串 → 传输串）
 *
 * 风险（workflow.md §5 / §8.3）：一旦人名本身含 `' / '` 或 `'-'`，split/join 即破。
 * 这是把展示串当数据存的脆弱设计。迁移**保留旧逻辑**（Rule 11：不重构），仅集中到
 * 此处并加注释标脆弱，避免散落多处。后端 DTO 改造（独立 userId[] 传输）后再统一替换。
 */

/** 展示分隔符（审批人名之间）。 */
export const STEP_NAME_DISPLAY_SEPARATOR = ' / ';
/** 传输分隔符（提交后端时）。 */
export const STEP_NAME_TRANSFER_SEPARATOR = '-';

/** 传输串 → 展示串（详情回填用）。等价旧码 `replaceAll('-', ' / ')`。 */
export function transferToDisplayStepName(transferName: string | undefined): string {
  if (!transferName) return '';
  return transferName
    .split(STEP_NAME_TRANSFER_SEPARATOR)
    .join(STEP_NAME_DISPLAY_SEPARATOR);
}

/** 展示串 → 传输串（提交保存用）。等价旧码 `replaceAll(' / ', '-')`。 */
export function displayToTransferStepName(displayName: string | undefined): string {
  if (!displayName) return '';
  return displayName
    .split(STEP_NAME_DISPLAY_SEPARATOR)
    .join(STEP_NAME_TRANSFER_SEPARATOR);
}

/** 传输串 → 人名数组（详情回填 selectUser 用）。等价旧码 `split('-')`。 */
export function transferToUserNames(transferName: string | undefined): string[] {
  if (!transferName) return [];
  return transferName.split(STEP_NAME_TRANSFER_SEPARATOR);
}

/** 人名数组 → 展示串（选人抽屉提交回写表单 stepName 用）。 */
export function userNamesToDisplay(userNames: string[]): string {
  return userNames.join(STEP_NAME_DISPLAY_SEPARATOR);
}
