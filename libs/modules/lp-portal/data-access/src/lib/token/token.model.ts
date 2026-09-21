/**
 * LP Token 总览域模型。
 *
 * 行类型已在公共 `../types` 平移声明（TokenRow / BankGroupRow，源
 * `src/types/business.ts`），本域仅锚定重导出——两路 star 导出指向同一
 * symbol，不构成 TS2308 歧义（pair/rate 域同模式）。
 *
 * token 域无状态码表：pooled 为布尔标注、其余字段原值直出，故无视图级
 * 映射补充（禁臆造）。
 */
import type { BankGroupRow, TokenRow } from '../types';

export type { BankGroupRow, TokenRow };
